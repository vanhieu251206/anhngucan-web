import { useEffect, useMemo, useRef, useState } from "react";
import { playLine, normalize, stopCurrent, fuzzyIncludesWord, isRecordingSupported } from "../lib/speech.js";
import { assessPronunciation, describePronunciationError } from "../lib/pronunciationApi.js";
import { ExaminerLine, SceneStage, MIC_ICON } from "./sceneVisuals.jsx";
import { SpeakingReportView } from "./SpeakingReportView.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { logSpeechAttempt } from "../lib/speechLog.js";
import { startSpeakingSession, finishSpeakingSession, logSpeakingEvent } from "../lib/speakingSessions.js";
import { saveRecording, submitRun, getRunRecordings, cleanupExpiredAudio, isWithinViewWindow } from "../lib/audioReviewCache.js";

// Lời khen dùng chung cho MỌI bài (không riêng lesson nào) — audio thật lấy từ
// Bài học/_dung-chung/praises/voice.txt, KHÔNG có TTS trình duyệt dự phòng.
const PRAISE_AUDIO = `${import.meta.env.BASE_URL}assets/audio/praises`;
const PRAISES = [
  { emoji: "👏", text: "Excellent!", audioUrl: `${PRAISE_AUDIO}/01-excellent.mp3` },
  { emoji: "⭐", text: "Great job!", audioUrl: `${PRAISE_AUDIO}/02-great-job.mp3` },
  { emoji: "🎉", text: "Well done!", audioUrl: `${PRAISE_AUDIO}/03-well-done.mp3` },
  { emoji: "💯", text: "That's correct!", audioUrl: `${PRAISE_AUDIO}/04-thats-correct.mp3` },
  { emoji: "🔥", text: "Awesome!", audioUrl: `${PRAISE_AUDIO}/05-awesome.mp3` },
  { emoji: "🌟", text: "You got it!", audioUrl: `${PRAISE_AUDIO}/06-you-got-it.mp3` },
  { emoji: "🥳", text: "Yes! That's right!", audioUrl: `${PRAISE_AUDIO}/07-yes-thats-right.mp3` },
];
function pickPraise() {
  return PRAISES[Math.floor(Math.random() * PRAISES.length)];
}
// Phản hồi khi trả lời sai — cũng chọn ngẫu nhiên + có audio riêng, không dùng text tiếng Việt cố định.
const WRONG_PRAISES = [
  { emoji: "💪", text: "Almost there!", audioUrl: `${PRAISE_AUDIO}/08-almost-there.mp3` },
  { emoji: "🔄", text: "Try again!", audioUrl: `${PRAISE_AUDIO}/09-try-again.mp3` },
  { emoji: "🌱", text: "Keep trying!", audioUrl: `${PRAISE_AUDIO}/10-keep-trying.mp3` },
];
function pickWrong() {
  return WRONG_PRAISES[Math.floor(Math.random() * WRONG_PRAISES.length)];
}
const NEXT_DELAY_MS = 1300;
const NARRATION_PAUSE_MS = 3000;
// Sai liên tục 3 lần ở scene-click/card-select/drag-drop (chốt 2026-08-24, đồng bộ với
// MIC_MAX_ATTEMPTS = 3 của scene mic) → tự hiện đáp án đúng (không phát audio khen vì chưa làm
// đúng) rồi tự chuyển scene sau 1 khoảng nghỉ, để học sinh không bị kẹt mãi ở 1 câu không làm được.
const WRONG_LIMIT = 3;
const REVEAL_DELAY_MS = 3000;
// Chốt 2026-08-24 (yêu cầu trung tâm): MỌI câu hỏi mic đều được CHẤM theo từng từ trong câu đáp
// án hoàn chỉnh (ghép answerTemplate + từ đáp án nếu có) — riêng cho mic, học sinh được thử tối
// đa 3 lần (khác WRONG_LIMIT=2 dùng cho scene-click/card-select/drag-drop), mỗi lần chỉ cần sửa
// lại những từ còn sai, từ đã đúng giữ nguyên không bị chấm lại.
const MIC_MAX_ATTEMPTS = 3;

function testYes(normText) {
  return /\b(yes|yeah|yep|yup|uh-?huh)\b/.test(normText);
}
function testNo(normText) {
  return /\b(no|nope|nah)\b/.test(normText);
}
function splitYesNoTemplate(template) {
  if (!template) return [null, null];
  const [yesPart, noPart] = template.split("/").map(s => s.trim());
  return [yesPart || null, noPart || null];
}
// Câu hoàn chỉnh dùng để CHẤM: ghép answerTemplate với từ đáp án thật (nếu có) — áp dụng cho MỌI
// scene mic. branch ("yes"|"no"|null) chỉ có ý nghĩa khi scene.expectedYesNo === "either" (chưa
// biết học sinh sẽ trả lời Yes hay No trước — chốt theo lần nói đầu tiên, xem chooseBranch()).
function buildExpectedSentence(scene, branch) {
  if (scene.expectedYesNo && scene.expectedYesNo !== "either") {
    const [yesPart, noPart] = splitYesNoTemplate(scene.answerTemplate);
    return (scene.expectedYesNo === "yes" ? yesPart : noPart) ?? scene.answerTemplate ?? "";
  }
  if (scene.expectedYesNo === "either") {
    const [yesPart, noPart] = splitYesNoTemplate(scene.answerTemplate);
    return (branch === "no" ? noPart : yesPart) ?? scene.answerTemplate ?? "";
  }
  if (scene.expectedKeyword) {
    const keyword = Array.isArray(scene.expectedKeyword) ? scene.expectedKeyword[0] : scene.expectedKeyword;
    return scene.answerTemplate?.includes("....") ? scene.answerTemplate.replace("....", keyword) : (scene.answerTemplate || keyword);
  }
  return scene.answerTemplate ?? "";
}
// Tách câu chấm thành từng token: "blank" (chỗ trống "...." của câu hỏi mở không chấm được, tự
// coi là đúng), "yesno" (đúng từ Yes/No của câu — chấp nhận thêm cách nói tắt phổ biến), "word"
// (so khớp gần đúng bình thường qua fuzzyIncludesWord).
function tokenizeForGrading(sentence, isYesNoSentence) {
  return sentence
    .split(/\s+/)
    .filter(Boolean)
    .map(text => {
      if (text === "....") return { text, kind: "blank" };
      const norm = normalize(text);
      if (isYesNoSentence && (norm === "yes" || norm === "no")) return { text, kind: "yesno", isYes: norm === "yes" };
      return { text, kind: "word" };
    });
}
// Chấm 1 lượt nói: trả về mảng đúng/sai MỚI đã gộp với lượt trước — từ đã xanh (đúng) giữ mãi
// xanh, chỉ những từ còn đỏ mới được nghe lại ở lượt này (theo đúng yêu cầu khách).
// Câu có từ Yes/No (isYesNoSentence): phải bắt ĐÚNG được chữ "Yes"/"No" (hoặc cách nói tắt phổ
// biến) mới tính — nếu chưa bắt được đúng chiều Yes/No, các từ khung câu còn lại (vd "it", "is")
// KHÔNG được tô xanh dù trùng ngẫu nhiên với câu nói (chốt 2026-08-24: từng bị báo lỗi hiện "it"
// xanh dù học sinh nói "Yes, it is." trong khi đáp án đúng là "No, it isn't.").
function gradeAttempt(tokens, priorCorrect, said) {
  const saidNorm = normalize(said);
  const yesnoIndex = tokens.findIndex(t => t.kind === "yesno");
  const yesnoTok = yesnoIndex >= 0 ? tokens[yesnoIndex] : null;
  const yesnoOk =
    !yesnoTok ||
    priorCorrect[yesnoIndex] ||
    (yesnoTok.isYes ? testYes(saidNorm) && !testNo(saidNorm) : testNo(saidNorm) && !testYes(saidNorm));

  return tokens.map((tok, i) => {
    if (priorCorrect[i]) return true;
    if (tok.kind === "blank") return true;
    if (tok.kind === "yesno") return yesnoOk;
    if (!yesnoOk) return false;
    return fuzzyIncludesWord(saidNorm, normalize(tok.text));
  });
}

// Ảnh Scene + khung khoanh vùng gợi ý (không bấm được) — dùng chung cho Huong-dan và
// câu hỏi mic Yes/No có chỉ vào 1 vật cụ thể trong ảnh (vd "Is this the monkey?").
// scene.demoCard: dùng cho Huong-dan giám khảo LÀM MẪU đặt thẻ vào 1 vị trí (vd trước khi
// yêu cầu học sinh tự kéo-thả) — hiện sẵn ảnh thẻ tại đúng vị trí target, không tương tác được.
function SceneImageWithHighlight({ scene }) {
  if (!scene.sceneImage) return null;
  return (
    <SceneStage cursor="default">
      <img
        className="part1-scene-img"
        src={scene.sceneImage}
        onError={e => (e.currentTarget.style.display = "none")}
      />
      {scene.highlight && (
        <div
          className="part1-highlight"
          style={{
            left: `${scene.highlight.x}%`,
            top: `${scene.highlight.y}%`,
            width: `${scene.highlight.w}%`,
            height: `${scene.highlight.h}%`,
          }}
        />
      )}
      {scene.demoCard && (
        <img
          className="dropped-card"
          src={scene.demoCard.card.image}
          alt={scene.demoCard.card.label}
          style={{
            left: `${scene.demoCard.target.x + scene.demoCard.target.w / 2}%`,
            top: `${scene.demoCard.target.y + scene.demoCard.target.h / 2}%`,
          }}
        />
      )}
    </SceneStage>
  );
}

// Tiền tố key sessionStorage lưu scene đang làm dở — theo audit 2026-08-23 P3: refresh giữa bài
// trước đây luôn quay về scene 0. progressKey (do LessonsPage truyền vào, vd "starters-1-test1")
// định danh đúng 1 bài Speaking cụ thể, tránh lẫn tiến độ giữa các bài khác nhau. Chỉ lưu trong
// sessionStorage (mất khi đóng tab hẳn) — đúng mức "sống sót qua F5", không phải lưu tiến độ dài
// hạn (tính năng đó thuộc Phase 3 theo dõi tiến độ, chưa làm — xem CLAUDE.md mục 6).
const PROGRESS_KEY_PREFIX = "speaking-scene-index-";

function loadSavedIndex(progressKey, sceneCount) {
  if (!progressKey) return 0;
  const raw = sessionStorage.getItem(PROGRESS_KEY_PREFIX + progressKey);
  const saved = Number(raw);
  return Number.isInteger(saved) && saved >= 0 && saved < sceneCount ? saved : 0;
}

export default function SceneRunner({
  scenes,
  onFinish,
  progressKey,
  studentName,
  seriesId,
  level,
  testId,
  lessonLabel,
}) {
  const { isStaff } = useAuth();
  const [index, setIndex] = useState(() => loadSavedIndex(progressKey, scenes.length));
  const scene = scenes[index];
  const sessionIdRef = useRef(null);
  // Định danh riêng cho MỖI lượt làm bài (dùng để nhóm audio ghi âm cho màn "Nghe lại" cuối bài,
  // xem lib/audioReviewCache.js) — không dùng progressKey trực tiếp vì làm lại bài nhiều lần
  // trong ngày vẫn phải tách riêng từng lượt.
  const runIdRef = useRef(crypto.randomUUID());
  const [reviewOpen, setReviewOpen] = useState(false);
  // Mốc bắt đầu làm bài — dùng tính "Thời gian làm bài" hiện ở màn tổng kết.
  const startedAtRef = useRef(Date.now());

  // Dọn audio "Nghe lại" đã quá hạn (>48h) khi bắt đầu 1 bài mới — đỡ tồn đọng dữ liệu vô thời hạn.
  useEffect(() => {
    cleanupExpiredAudio();
  }, []);

  function saveMicRecording(sceneIndex, examinerLine, blob) {
    saveRecording(runIdRef.current, sceneIndex, examinerLine, blob);
  }

  // Ghi lại scene hiện tại mỗi khi đổi — đọc lại ở lần mount sau (F5 giữa bài) qua loadSavedIndex.
  useEffect(() => {
    if (!progressKey) return;
    sessionStorage.setItem(PROGRESS_KEY_PREFIX + progressKey, String(index));
  }, [progressKey, index]);
  const isLast = index === scenes.length - 1;

  // Báo cáo quá trình làm bài (chốt 2026-08-24): chỉ tạo session khi có studentName — học sinh
  // đã nhập họ tên (xem LessonsPage.jsx), hoặc admin/teacher tự test (LessonsPage.jsx tự gắn tên
  // "[Test - Admin]"/"[Test - Giáo viên]" để phân biệt với học sinh thật trong báo cáo, chốt
  // 2026-08-24 theo yêu cầu người dùng). Chỉ tạo 1 lần khi mount, không tạo lại khi đổi scene.
  useEffect(() => {
    if (!studentName) return;
    let cancelled = false;
    startSpeakingSession({ studentName, seriesId, level, testId, lessonLabel, sceneCount: scenes.length }).then(
      id => {
        if (!cancelled) sessionIdRef.current = id;
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kết quả từng câu (keyed theo sceneIndex) — dùng để hiện màn tổng kết cuối bài. Mỗi câu có thể
  // gọi onAttempt() NHIỀU LẦN (thử sai rồi thử lại) — giữ lại `history` đầy đủ từng lần thử (để
  // màn tổng kết hiện rõ quá trình làm bài, không chỉ kết quả cuối), còn result/recognizedText/
  // attemptNumber ở ngoài luôn là của lần gọi GẦN NHẤT (kết quả chốt trước khi qua scene tiếp theo).
  const [results, setResults] = useState({});

  function recordAttempt(sceneIndex, sceneType, examinerLine, attemptNumber, result, recognizedText) {
    logSpeakingEvent(sessionIdRef.current, { sceneIndex, sceneType, examinerLine, attemptNumber, result, recognizedText });
    setResults(r => {
      const prevHistory = r[sceneIndex]?.history ?? [];
      return {
        ...r,
        [sceneIndex]: {
          sceneType,
          examinerLine,
          attemptNumber,
          result,
          recognizedText,
          history: [...prevHistory, { attemptNumber, result, recognizedText }],
        },
      };
    });
  }

  // Rời bài Speaking bằng bất kỳ cách nào (không chỉ nút quay lại, vd bấm logo/menu) đều phải
  // ngưng audio đang phát ngay, không để tiếng tiếp tục phát sau khi đã thoát màn hình.
  useEffect(() => {
    return () => stopCurrent();
  }, []);

  function goNext() {
    if (isLast) {
      if (progressKey) sessionStorage.removeItem(PROGRESS_KEY_PREFIX + progressKey);
      finishSpeakingSession(sessionIdRef.current);
      if (progressKey) submitRun(progressKey, runIdRef.current);
      setReviewOpen(true);
      return;
    }
    setIndex(i => i + 1);
  }

  // Nút Skip/Quay lại CHỈ để test nhanh khi đang soạn bài — bỏ đi khi bài đã hoàn thiện xong xuôi
  // (bài thi thật của Cambridge YLE không cho quay lại scene trước).
  function skipScene() {
    stopCurrent();
    goNext();
  }

  function prevScene() {
    if (index === 0) return;
    stopCurrent();
    setIndex(i => i - 1);
  }

  if (reviewOpen) {
    return (
      <ReviewScreen
        runId={runIdRef.current}
        results={results}
        elapsedMs={Date.now() - startedAtRef.current}
        onDone={onFinish}
      />
    );
  }

  return (
    <div className="sentence-box">
      <div className="speaking-progress">
        Câu {index + 1} / {scenes.length}
        {isStaff && (
          // Nút Skip/Quay lại CHỈ dành cho admin/teacher test nhanh khi soạn bài — guest/học sinh
          // không thấy (bài thi thật của Cambridge YLE không cho quay lại scene trước).
          <span className="dev-test-btns">
            <button
              className="dev-skip-btn"
              onClick={prevScene}
              disabled={index === 0}
              title="Chỉ dùng khi test — bỏ khi bài xong"
            >
              ⏮ Trước
            </button>
            <button className="dev-skip-btn" onClick={skipScene} title="Chỉ dùng khi test — bỏ khi bài xong">
              Skip ⏭
            </button>
          </span>
        )}
      </div>
      {scene.type === "narration" && <NarrationScene key={index} scene={scene} onNext={goNext} />}
      {scene.type === "mic" && (
        <MicScene
          key={index}
          scene={scene}
          onNext={goNext}
          lessonId={progressKey}
          sceneIndex={index}
          onAttempt={recordAttempt}
          onSaveRecording={saveMicRecording}
        />
      )}
      {scene.type === "scene-click" && (
        <SceneClickScene key={index} scene={scene} onNext={goNext} sceneIndex={index} onAttempt={recordAttempt} />
      )}
      {scene.type === "card-select" && (
        <CardSelectScene key={index} scene={scene} onNext={goNext} sceneIndex={index} onAttempt={recordAttempt} />
      )}
      {scene.type === "drag-drop" && (
        <DragDropScene key={index} scene={scene} onNext={goNext} sceneIndex={index} onAttempt={recordAttempt} />
      )}
    </div>
  );
}

// ---------- Màn tổng kết cuối bài: kết quả TẤT CẢ câu đã làm, audio (nếu có) chỉ là 1 phần ----------
// Phần hiển thị dùng chung với StudentResultsPage.jsx (giáo viên/admin xem lại sau — KHÔNG có
// audio) qua SpeakingReportView.jsx (xem file đó để biết lý do). Ở đây (học sinh xem NGAY sau khi
// nộp bài) mới có thêm audio nghe lại (đọc từ IndexedDB trên chính máy này, xem
// lib/audioReviewCache.js — chỉ dùng được 24h đầu, hoàn toàn không upload lên đâu).
function ReviewScreen({ runId, results, elapsedMs, onDone }) {
  const [recordings, setRecordings] = useState(null); // null = đang tải

  useEffect(() => {
    let cancelled = false;
    getRunRecordings(runId).then(list => {
      if (!cancelled) setRecordings(list || []);
    });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const items = Object.entries(results)
    .map(([sceneIndex, r]) => ({ sceneIndex: Number(sceneIndex), ...r }))
    .sort((a, b) => a.sceneIndex - b.sceneIndex);

  return (
    <div className="sentence-box review-screen">
      <SpeakingReportView items={items} elapsedMs={elapsedMs} showAudio recordings={recordings} />
      <div className="review-footer">
        <p className="review-footer-note">
          🎧 Câu đã nói (🎤) nghe lại được trong <strong>24 giờ</strong> kể từ bây giờ, sau đó tự xoá khỏi
          thiết bị này.
        </p>
        <button className="btn btn-primary review-done-btn" onClick={onDone}>
          Xong
        </button>
      </div>
    </div>
  );
}

// ---------- Huong-dan: lời dẫn, tự động chuyển sau khi đọc xong + nghỉ 1s ----------
function NarrationScene({ scene, onNext }) {
  useEffect(() => {
    let cancelled = false;
    playLine(scene.examinerLine, {
      audioUrl: scene.audioUrl,
      onEnd: () => {
        if (cancelled) return;
        setTimeout(() => {
          if (!cancelled) onNext();
        }, NARRATION_PAUSE_MS);
      },
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return (
    <div className="scene-body">
      <ExaminerLine text={scene.examinerLine} />
      <SceneImageWithHighlight scene={scene} />
    </div>
  );
}

// ---------- Chao-hoi / câu hỏi mic: hiện mẫu câu trả lời trước khi bấm mic ----------
// Chốt 2026-08-24 (yêu cầu trung tâm): MỌI scene mic đều được CHẤM theo từng từ của câu đáp án
// hoàn chỉnh (xem buildExpectedSentence/tokenizeForGrading/gradeAttempt ở trên) — kể cả câu hỏi
// cá nhân dạng Yes/No ("either") hay câu chào hỏi mở, chỉ riêng phần "...." (thông tin cá nhân
// không biết trước) là luôn coi như đúng. Học sinh được thử tối đa MIC_MAX_ATTEMPTS lần, mỗi lần
// chỉ cần sửa lại từ còn đỏ — từ đã xanh giữ nguyên không bị chấm lại.
function MicScene({ scene, onNext, lessonId, sceneIndex, onAttempt, onSaveRecording }) {
  const { isAdmin } = useAuth();
  const [phase, setPhase] = useState("ask"); // ask | recording | busy | done
  const [heard, setHeard] = useState("");
  const [lastSaid, setLastSaid] = useState(null); // debug: nguyên văn máy nghe được lượt gần nhất — CHỈ hiện cho admin
  const [attempts, setAttempts] = useState(0);
  const [branch, setBranch] = useState(null); // "yes"|"no"|null — chỉ dùng khi expectedYesNo === "either"
  const [praise, setPraise] = useState(null);
  const [wrongPraise, setWrongPraise] = useState(null);
  const [outcome, setOutcome] = useState(null); // null | "correct" | "revealed"
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const isYesNoSentence = Boolean(scene.expectedYesNo);
  const expectedSentence = buildExpectedSentence(scene, branch);
  const tokens = useMemo(
    () => tokenizeForGrading(expectedSentence, isYesNoSentence),
    [expectedSentence, isYesNoSentence]
  );
  const [correct, setCorrect] = useState(() => tokens.map(t => t.kind === "blank"));

  useEffect(() => {
    playLine(scene.examinerLine, { audioUrl: scene.audioUrl });
  }, [scene]);

  async function startHold(e) {
    e.preventDefault();
    if (phase !== "ask") return;
    if (!isRecordingSupported()) {
      setHeard("Trình duyệt không hỗ trợ ghi âm.");
      return;
    }
    // Học sinh bấm mic nói ngay khi giám khảo còn đang đọc — phải ngưng ngay, không để phát
    // tiếp đè lên lúc học sinh đang nói.
    stopCurrent();
    // KHÔNG xoá kết quả của lượt trước ở đây — giữ nguyên các từ đã xanh trên màn hình, chỉ cập
    // nhật đè khi có kết quả nhận diện MỚI (xem recorder.onstop bên dưới).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = ev => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        if (blob.size < 500) {
          // Ghi âm quá ngắn (bấm-thả quá nhanh) — báo rõ cho học sinh biết để bấm giữ lại,
          // không được lặng lẽ không làm gì (trẻ nhỏ sẽ không hiểu vì sao không có phản hồi).
          setHeard("Ghi âm quá ngắn, hãy bấm giữ mic lâu hơn rồi thử lại nhé!");
          setPhase("ask");
          return;
        }
        setPhase("busy");
        setHeard("");
        // Nhận diện qua AssemblyAI (Cloudflare Worker, xem pronunciationApi.js). Nếu lỗi (mất
        // mạng, Worker chưa cấu hình, hết hạn mức...) thì báo rõ cho học sinh thay vì âm thầm bỏ qua.
        let said = "";
        try {
          const result = await assessPronunciation(blob, scene.expectedKeyword || scene.expectedYesNo || "");
          said = result.text || "";
        } catch (err) {
          setHeard(describePronunciationError(err));
          setPhase("ask");
          return;
        }

        const saidNorm = normalize(said);
        setLastSaid(said);

        // Scene "either" (chưa biết học sinh trả lời Yes hay No, vd "Is your name HENRY?") — chốt
        // nhánh NGAY lần nói đầu tiên có nhắc rõ yes/no, tính luôn cho lượt chấm này (không đợi
        // qua lượt sau mới áp dụng, tránh lệch 1 nhịp).
        let effectiveBranch = branch;
        if (scene.expectedYesNo === "either" && !branch) {
          if (testYes(saidNorm) && !testNo(saidNorm)) effectiveBranch = "yes";
          else if (testNo(saidNorm) && !testYes(saidNorm)) effectiveBranch = "no";
        }
        const branchJustChosen = effectiveBranch !== branch;
        if (branchJustChosen) setBranch(effectiveBranch);
        const gradingSentence = branchJustChosen ? buildExpectedSentence(scene, effectiveBranch) : expectedSentence;
        const gradingTokens = branchJustChosen ? tokenizeForGrading(gradingSentence, isYesNoSentence) : tokens;
        const priorCorrect = branchJustChosen ? gradingTokens.map(t => t.kind === "blank") : correct;

        const nextCorrect = gradeAttempt(gradingTokens, priorCorrect, said);
        setCorrect(nextCorrect);
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        const attemptAllCorrect = nextCorrect.every(Boolean);
        // Log THUẦN TEXT (không audio) mỗi lượt để sau này phân tích lỗi phát âm/nhận diện thường
        // gặp của trẻ Việt Nam — không chặn luồng học nếu lỗi (xem speechLog.js).
        logSpeechAttempt({
          lessonId,
          sceneIndex,
          examinerLine: scene.examinerLine,
          expectedSentence: gradingSentence,
          saidText: said,
          attemptNumber: nextAttempts,
          correct: attemptAllCorrect,
        });

        if (attemptAllCorrect) {
          setOutcome("correct");
          setPhase("done");
          onAttempt?.(sceneIndex, "mic", scene.examinerLine, nextAttempts, "correct", said);
          onSaveRecording?.(sceneIndex, scene.examinerLine, blob);
          const p = pickPraise();
          setPraise(p);
          playLine(p.text, { audioUrl: p.audioUrl, onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
          return;
        }
        if (nextAttempts >= MIC_MAX_ATTEMPTS) {
          // Hết lượt mà vẫn còn từ sai — vẫn cho qua scene (không bắt học sinh nói mãi không
          // được), không phát lời khen vì chưa nói đúng hết, chỉ hiện rõ đáp án rồi tự chuyển tiếp.
          setOutcome("revealed");
          setPhase("done");
          onAttempt?.(sceneIndex, "mic", scene.examinerLine, nextAttempts, "revealed", said);
          onSaveRecording?.(sceneIndex, scene.examinerLine, blob);
          setTimeout(onNext, REVEAL_DELAY_MS);
          return;
        }
        onAttempt?.(sceneIndex, "mic", scene.examinerLine, nextAttempts, "wrong", said);
        const w = pickWrong();
        setWrongPraise(w);
        playLine(w.text, { audioUrl: w.audioUrl });
        setPhase("ask");
      };
      setPhase("recording");
      recorder.start();
    } catch {
      setHeard("Không dùng được micro. Kiểm tra quyền truy cập micro.");
    }
  }

  function stopHold(e) {
    e.preventDefault();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  // Không có ảnh/thẻ minh hoạ (vd "Hello. My name's Jane.", "What's your name?") → câu hỏi
  // căn giữa cả vùng trên, tránh khoảng trắng trống trải phía dưới câu thoại.
  const hasMedia = Boolean(scene.sceneImage || scene.card);
  const attemptsLeft = MIC_MAX_ATTEMPTS - attempts;

  return (
    <>
      <div className={`scene-body${hasMedia ? "" : " scene-body-center"}`}>
        <ExaminerLine text={scene.examinerLine} />
        <SceneImageWithHighlight scene={scene} />
        {scene.card && (
          <img className="part1-single-card" src={scene.card.image} alt={scene.card.label} />
        )}
      </div>
      <div className="scene-foot">
        {tokens.length > 0 && (
          <div className="answer-template">
            {attempts === 0 ? (
              // Gợi ý TRƯỚC khi nói lần đầu luôn hiện NGUYÊN VĂN answerTemplate gốc (soạn từ PDF)
              // — có chỗ trống "...." cho câu hỏi mở, hoặc ĐỦ CẢ 2 lựa chọn "Yes, .../No, ..." cho
              // câu Yes/No (kể cả expectedYesNo cố định "yes"/"no", không riêng "either") — TUYỆT
              // ĐỐI không lộ sẵn đáp án thật (expectedSentence) ra gợi ý (chốt 2026-08-24).
              <>💡 Gợi ý: <strong>{scene.answerTemplate}</strong></>
            ) : (
              <>
                {outcome === "correct" ? "✅" : outcome === "revealed" ? "❌" : "💡"} Đáp án:{" "}
                {tokens.map((tok, i) =>
                  tok.kind === "blank" ? null : (
                    <strong key={i} className={correct[i] ? "word-correct" : "word-wrong"}>
                      {tok.text}{" "}
                    </strong>
                  )
                )}
              </>
            )}
          </div>
        )}
        <button
          className={`mic-btn${phase === "recording" ? " recording" : ""}`}
          title="Bấm giữ để nói"
          disabled={phase === "busy" || phase === "done"}
          onMouseDown={startHold}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={startHold}
          onTouchEnd={stopHold}
        >
          <img src={MIC_ICON} alt="Bấm giữ để nói" />
        </button>
        {phase === "busy" && <div className="heard-text">Đang nhận diện...</div>}
        {heard && <div className="heard-text">{heard}</div>}
        {outcome === "correct" && praise && (
          <div className="result-ok">{praise.emoji} {praise.text}</div>
        )}
        {outcome === "revealed" && (
          <div className="result-hint">Đáp án đúng: <strong>{expectedSentence}</strong></div>
        )}
        {outcome === null && attempts > 0 && wrongPraise && (
          <div className="result-bad">
            {wrongPraise.emoji} {wrongPraise.text} ({attemptsLeft} {attemptsLeft === 1 ? "try" : "tries"} left)
          </div>
        )}
      </div>
      {isAdmin && lastSaid !== null && (
        // Debug: nguyên văn máy nghe được (chưa qua chấm) — CHỈ hiện cho tài khoản admin, để
        // kiểm chứng ASR/logic chấm, đặt góc riêng tách khỏi khu vực đáp án chính học sinh nhìn.
        <div className="mic-debug-heard">🎤 Máy nghe: "{lastSaid || "(im lặng)"}"</div>
      )}
    </>
  );
}

// ---------- Canh-click: click vào vật trong ảnh Scene ----------
function SceneClickScene({ scene, onNext, sceneIndex, onAttempt }) {
  const [correct, setCorrect] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [praise, setPraise] = useState(null);
  const [wrongPraise, setWrongPraise] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    playLine(scene.examinerLine, { audioUrl: scene.audioUrl });
  }, [scene]);

  // Scene soạn dở trong CMS (chưa kéo chọn vùng bấm đúng qua CoordinatePicker) không có
  // scene.target — hiện thông báo rõ thay vì crash trắng trang khi học sinh lỡ vào phải.
  if (!scene.target) {
    return (
      <div className="scene-body">
        <ExaminerLine text={scene.examinerLine} />
        <p className="mock-banner">Scene này chưa cấu hình vùng bấm đúng — vào CMS chỉnh lại.</p>
      </div>
    );
  }

  function choose(hit) {
    if (correct || revealed) return;
    if (hit) {
      setCorrect(true);
      onAttempt?.(sceneIndex, "scene-click", scene.examinerLine, wrongCount + 1, "correct", null);
      const p = pickPraise();
      setPraise(p);
      playLine(p.text, { audioUrl: p.audioUrl, onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 1500);
      const nextWrongCount = wrongCount + 1;
      setWrongCount(nextWrongCount);
      if (nextWrongCount >= WRONG_LIMIT) {
        setRevealed(true);
        onAttempt?.(sceneIndex, "scene-click", scene.examinerLine, nextWrongCount, "revealed", null);
        setTimeout(onNext, REVEAL_DELAY_MS);
        return;
      }
      onAttempt?.(sceneIndex, "scene-click", scene.examinerLine, nextWrongCount, "wrong", null);
      const w = pickWrong();
      setWrongPraise(w);
      playLine(w.text, { audioUrl: w.audioUrl });
    }
  }

  return (
    <>
      <div className="scene-body">
        <ExaminerLine text={scene.examinerLine} />
        {!correct && !revealed && !wrong && <div className="scene-hint-inline">Chạm vào đáp án đúng</div>}
        <SceneStage extraClassName={wrong ? "is-shake" : ""} onClick={() => choose(false)}>
          <img
            className="part1-scene-img"
            src={scene.sceneImage}
            onError={e => (e.currentTarget.style.display = "none")}
          />
          <button
            className={`part1-hotspot${correct || revealed ? " is-correct" : ""}`}
            style={{
              left: `${scene.target.x}%`,
              top: `${scene.target.y}%`,
              width: `${scene.target.w}%`,
              height: `${scene.target.h}%`,
            }}
            onClick={e => {
              e.stopPropagation();
              choose(true);
            }}
            aria-label={scene.target.label}
          />
        </SceneStage>
      </div>
      <div className="scene-foot">
        {(correct || revealed || wrong) && (
          <div className={correct ? "result-ok" : revealed ? "result-hint" : "result-bad"}>
            {correct
              ? `${praise.emoji} ${praise.text}`
              : revealed
                ? <>Đáp án đúng: <strong>{scene.target.label}</strong></>
                : `${wrongPraise.emoji} ${wrongPraise.text}`}
          </div>
        )}
      </div>
    </>
  );
}

// ---------- The-chon: chọn đúng thẻ trong 4 lựa chọn ----------
function CardSelectScene({ scene, onNext, sceneIndex, onAttempt }) {
  const [correct, setCorrect] = useState(false);
  const [wrongId, setWrongId] = useState(null);
  const [praise, setPraise] = useState(null);
  const [wrongPraise, setWrongPraise] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    playLine(scene.examinerLine, { audioUrl: scene.audioUrl });
  }, [scene]);

  // Vài scene chấp nhận NHIỀU đáp án đúng (vd đề thi thật giám khảo chỉ hỏi 1 trong 2 vật, xem
  // scene "Which is the book/pen?") — dùng scene.correctIds (mảng); scene chỉ có 1 đáp án vẫn
  // dùng scene.correctId như cũ.
  const correctIds = scene.correctIds ?? [scene.correctId];

  // Scene soạn dở trong CMS (chưa thêm đủ 4 thẻ lựa chọn) — hiện thông báo rõ thay vì crash
  // trắng trang khi học sinh lỡ vào phải.
  if (!scene.options?.length) {
    return (
      <div className="scene-body">
        <ExaminerLine text={scene.examinerLine} />
        <p className="mock-banner">Scene này chưa có đủ thẻ lựa chọn — vào CMS chỉnh lại.</p>
      </div>
    );
  }

  function choose(id) {
    if (correct || revealed) return;
    if (correctIds.includes(id)) {
      setCorrect(true);
      onAttempt?.(sceneIndex, "card-select", scene.examinerLine, wrongCount + 1, "correct", null);
      const p = pickPraise();
      setPraise(p);
      playLine(p.text, { audioUrl: p.audioUrl, onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
    } else {
      setWrongId(id);
      setTimeout(() => setWrongId(null), 1500);
      const nextWrongCount = wrongCount + 1;
      setWrongCount(nextWrongCount);
      if (nextWrongCount >= WRONG_LIMIT) {
        setRevealed(true);
        onAttempt?.(sceneIndex, "card-select", scene.examinerLine, nextWrongCount, "revealed", null);
        setTimeout(onNext, REVEAL_DELAY_MS);
        return;
      }
      onAttempt?.(sceneIndex, "card-select", scene.examinerLine, nextWrongCount, "wrong", null);
      const w = pickWrong();
      setWrongPraise(w);
      playLine(w.text, { audioUrl: w.audioUrl });
    }
  }

  const correctOption = scene.options.find(o => correctIds.includes(o.id));

  return (
    <>
      <div className="scene-body scene-body-center">
        <ExaminerLine text={scene.examinerLine} />
        {!correct && !revealed && !wrongId && <div className="scene-hint-inline">Chạm vào đáp án đúng</div>}
      </div>
      <div className="scene-foot">
        <div className="part1-options">
          {scene.options.map(opt => (
            <button
              key={opt.id}
              className={`part1-option${(correct || revealed) && correctIds.includes(opt.id) ? " is-correct" : ""}${
                wrongId === opt.id ? " is-wrong is-shake" : ""
              }`}
              onClick={() => choose(opt.id)}
              aria-label={opt.label}
            >
              <img src={opt.image} onError={e => (e.currentTarget.style.display = "none")} />
            </button>
          ))}
        </div>
        {(correct || revealed || wrongId) && (
          <div className={correct ? "result-ok" : revealed ? "result-hint" : "result-bad"}>
            {correct
              ? `${praise.emoji} ${praise.text}`
              : revealed
                ? <>Đáp án đúng: <strong>{correctOption.label}</strong></>
                : `${wrongPraise.emoji} ${wrongPraise.text}`}
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Dat-vi-tri: kéo-thả thẻ vào đúng vị trí trên ảnh Scene ----------
function DragDropScene({ scene, onNext, sceneIndex, onAttempt }) {
  const [correct, setCorrect] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [dragPos, setDragPos] = useState(null); // {x,y} client coords khi đang kéo
  const [praise, setPraise] = useState(null);
  const [wrongPraise, setWrongPraise] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const sceneRef = useRef(null);
  const draggingRef = useRef(false);
  // Dùng ref thay vì state cho số lần sai — handleUp bên dưới được tạo trong useEffect chỉ phụ
  // thuộc [scene] (không tạo lại mỗi lần kéo-thả), nên đọc state thường sẽ bị "stale closure"
  // (luôn thấy giá trị lúc effect chạy lần đầu). Ref luôn đọc được giá trị mới nhất.
  const wrongCountRef = useRef(0);

  useEffect(() => {
    playLine(scene.examinerLine, { audioUrl: scene.audioUrl });
  }, [scene]);

  // Dùng listener trên window khi đang kéo, thay vì Pointer Capture — capture không nhận
  // sự kiện đều đặn với chuột giả lập (đã gặp khi test), gắn trên window ổn định hơn nhiều.
  useEffect(() => {
    function handleMove(e) {
      if (!draggingRef.current) return;
      const p = e.touches ? e.touches[0] : e;
      setDragPos({ x: p.clientX, y: p.clientY });
    }
    function handleUp(e) {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const p = e.changedTouches ? e.changedTouches[0] : e;
      const container = sceneRef.current;
      let hit = false;
      if (container) {
        const rect = container.getBoundingClientRect();
        const relX = ((p.clientX - rect.left) / rect.width) * 100;
        const relY = ((p.clientY - rect.top) / rect.height) * 100;
        // Nới thêm biên dung sai quanh vùng đích (tính theo %) — trẻ nhỏ thả tay không chính xác
        // tới từng pixel, vùng đích gốc quá khít khiến "kéo hoài không được" dù thả gần đúng chỗ.
        const DROP_TOLERANCE = 4;
        const t = scene.target;
        hit =
          relX >= t.x - DROP_TOLERANCE &&
          relX <= t.x + t.w + DROP_TOLERANCE &&
          relY >= t.y - DROP_TOLERANCE &&
          relY <= t.y + t.h + DROP_TOLERANCE;
      }
      if (hit) {
        setCorrect(true);
        setDragPos(null);
        onAttempt?.(sceneIndex, "drag-drop", scene.examinerLine, wrongCountRef.current + 1, "correct", null);
        const p = pickPraise();
        setPraise(p);
        playLine(p.text, {
          audioUrl: p.audioUrl,
          onEnd: () => {
            playLine(scene.followupLine, {
              audioUrl: scene.followupAudioUrl,
              onEnd: () => setTimeout(onNext, NEXT_DELAY_MS),
            });
          },
        });
        return;
      }
      setDragPos(null);
      wrongCountRef.current += 1;
      if (wrongCountRef.current >= WRONG_LIMIT) {
        setRevealed(true);
        onAttempt?.(sceneIndex, "drag-drop", scene.examinerLine, wrongCountRef.current, "revealed", null);
        setTimeout(onNext, REVEAL_DELAY_MS);
        return;
      }
      onAttempt?.(sceneIndex, "drag-drop", scene.examinerLine, wrongCountRef.current, "wrong", null);
      setWrong(true);
      const w = pickWrong();
      setWrongPraise(w);
      playLine(w.text, { audioUrl: w.audioUrl });
      setTimeout(() => setWrong(false), 1500);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  function onDragStart(e) {
    if (correct || revealed) return;
    draggingRef.current = true;
    const p = e.touches ? e.touches[0] : e;
    setDragPos({ x: p.clientX, y: p.clientY });
  }

  // Scene soạn dở trong CMS (chưa kéo chọn vùng thả đúng hoặc chưa gán thẻ) — hiện thông báo rõ
  // thay vì crash trắng trang khi học sinh lỡ vào phải.
  if (!scene.target || !scene.card) {
    return (
      <div className="scene-body">
        <ExaminerLine text={scene.examinerLine} />
        <p className="mock-banner">Scene này chưa cấu hình đầy đủ (vị trí đích/thẻ) — vào CMS chỉnh lại.</p>
      </div>
    );
  }

  return (
    <>
      <div className="scene-body">
        <ExaminerLine text={scene.examinerLine} />
        <SceneStage extraClassName={wrong ? "is-shake" : ""} innerRef={sceneRef}>
          <img
            className="part1-scene-img"
            src={scene.sceneImage}
            onError={e => (e.currentTarget.style.display = "none")}
          />
          {(correct || revealed) && (
            <img
              className="dropped-card"
              src={scene.card.image}
              style={{
                left: `${scene.target.x + scene.target.w / 2}%`,
                top: `${scene.target.y + scene.target.h / 2}%`,
              }}
            />
          )}
        </SceneStage>
      </div>
      <div className="scene-foot">
        {!correct && !revealed && (
          <img
            className="drag-card"
            src={scene.card.image}
            alt={scene.card.label}
            draggable={false}
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
            style={
              dragPos
                ? { position: "fixed", left: dragPos.x, top: dragPos.y, transform: "translate(-50%, -50%)", zIndex: 100 }
                : undefined
            }
          />
        )}
        <div className={correct ? "result-ok" : revealed ? "result-hint" : wrong ? "result-bad" : "result-hint"}>
          {correct
            ? `${praise.emoji} ${praise.text}`
            : revealed
              ? <>Đáp án đúng: <strong>{scene.target.label}</strong></>
              : wrong
                ? `${wrongPraise.emoji} ${wrongPraise.text}`
                : `Kéo ${scene.card.label} vào đúng vị trí nhé`}
        </div>
      </div>
    </>
  );
}
