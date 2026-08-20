import { useEffect, useRef, useState } from "react";
import { playLine, normalize, stopCurrent, fuzzyIncludesWord, isRecordingSupported } from "../lib/speech.js";
import { assessPronunciation } from "../lib/pronunciationApi.js";
import { ExaminerLine, SceneStage, MIC_ICON } from "./sceneVisuals.jsx";

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
// Sai liên tục 2 lần ở BẤT KỲ loại scene nào (mic/scene-click/card-select/drag-drop) → tự hiện
// đáp án đúng (không phát audio khen vì chưa làm đúng) rồi tự chuyển scene sau 1 khoảng nghỉ, để
// học sinh không bị kẹt mãi ở 1 câu không làm được.
const WRONG_LIMIT = 2;
const REVEAL_DELAY_MS = 3000;

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

export default function SceneRunner({ scenes, onFinish }) {
  const [index, setIndex] = useState(0);
  const scene = scenes[index];
  const isLast = index === scenes.length - 1;

  // Rời bài Speaking bằng bất kỳ cách nào (không chỉ nút quay lại, vd bấm logo/menu) đều phải
  // ngưng audio đang phát ngay, không để tiếng tiếp tục phát sau khi đã thoát màn hình.
  useEffect(() => {
    return () => stopCurrent();
  }, []);

  function goNext() {
    if (isLast) {
      onFinish();
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

  return (
    <div className="sentence-box">
      <div className="speaking-progress">
        Câu {index + 1} / {scenes.length}
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
      </div>
      {scene.type === "narration" && <NarrationScene key={index} scene={scene} onNext={goNext} />}
      {scene.type === "mic" && (
        <MicScene key={index} scene={scene} onNext={goNext} />
      )}
      {scene.type === "scene-click" && <SceneClickScene key={index} scene={scene} onNext={goNext} />}
      {scene.type === "card-select" && <CardSelectScene key={index} scene={scene} onNext={goNext} />}
      {scene.type === "drag-drop" && <DragDropScene key={index} scene={scene} onNext={goNext} />}
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

// Nhãn đáp án hiện ra khi sai đủ WRONG_LIMIT lần ở scene mic có đáp án xác định — scene mic
// không có đáp án xác định (chào hỏi, "either"...) không bao giờ vào nhánh sai nên không cần nhãn.
function micAnswerLabel(scene) {
  if (scene.expectedYesNo && scene.expectedYesNo !== "either") {
    // answerTemplate luôn có dạng "Yes, ... . / No, ... ." (vd "Yes, it is. / No, it isn't.",
    // "Yes, they are. / No, they aren't.") — tách lấy đúng nửa câu khớp với đáp án đúng, hiện
    // NGUYÊN CÂU thay vì chỉ mỗi "Yes"/"No".
    if (scene.answerTemplate) {
      const [yesPart, noPart] = scene.answerTemplate.split("/").map(s => s.trim());
      return (scene.expectedYesNo === "yes" ? yesPart : noPart) ?? yesPart;
    }
    return scene.expectedYesNo === "yes" ? "Yes, it is." : "No, it isn't.";
  }
  if (scene.expectedKeyword) {
    // Vài câu có nhiều đáp án đều đúng (vd "She's phoning."/"She's talking.") — expectedKeyword
    // khi đó là mảng, hiện đáp án ĐẦU TIÊN trong mảng làm gợi ý (các đáp án khác vẫn được chấm
    // đúng khi trả lời qua mic, chỉ không hiện hết trong nhãn reveal).
    const keyword = Array.isArray(scene.expectedKeyword) ? scene.expectedKeyword[0] : scene.expectedKeyword;
    // answerTemplate dạng "It's a ....'/"There are ...." — thay chỗ trống bằng từ khoá đáp án
    // để hiện nguyên câu, không chỉ mỗi từ khoá trơ trọi.
    if (scene.answerTemplate?.includes("....")) {
      return scene.answerTemplate.replace("....", keyword);
    }
    return keyword;
  }
  return "";
}

// ---------- Chao-hoi / câu hỏi mic: hiện mẫu câu trả lời trước khi bấm mic ----------
function MicScene({ scene, onNext }) {
  const [phase, setPhase] = useState("ask"); // ask | recording | busy | done
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState(null); // null | true | false — chỉ dùng khi scene.expectedYesNo
  const [praise, setPraise] = useState(null);
  const [wrongPraise, setWrongPraise] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    playLine(scene.examinerLine, { audioUrl: scene.audioUrl });
  }, [scene]);

  // Trả về true nếu đã chạm giới hạn sai (đã tự hiện đáp án + chuyển scene, không cho thử lại
  // nữa) — false nếu còn lượt, gọi nơi dùng tự set lại phase "ask" để học sinh thử lại.
  function handleWrong() {
    setResult(false);
    const nextWrongCount = wrongCount + 1;
    setWrongCount(nextWrongCount);
    if (nextWrongCount >= WRONG_LIMIT) {
      setRevealed(true);
      setPhase("done");
      setTimeout(onNext, REVEAL_DELAY_MS);
      return true;
    }
    const w = pickWrong();
    setWrongPraise(w);
    playLine(w.text, { audioUrl: w.audioUrl });
    return false;
  }

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
    setResult(null);
    setWrongPraise(null);
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
        // Nhận diện qua Whisper (client-side, xem pronunciationApi.js). Nếu lỗi (model chưa tải
        // xong, treo quá timeout...) thì báo rõ cho học sinh thay vì âm thầm bỏ qua.
        let said = "";
        let debugInfo = null;
        try {
          const result = await assessPronunciation(blob, scene.expectedKeyword || scene.expectedYesNo || "");
          said = result.text || "";
          debugInfo = result.debug || null;
        } catch (err) {
          const friendly =
            err?.message === "model-load-timeout"
              ? "Đang tải mô hình nhận diện (lần đầu có thể hơi lâu), đợi chút rồi thử lại nhé!"
              : "Không nghe rõ, thử bấm mic nói lại lần nữa nhé!";
          // TẠM THỜI hiện thêm chi tiết lỗi thật (tên/message) để debug lỗi mic trên thiết bị
          // thật — xoá dòng debugDetail này sau khi xác định xong nguyên nhân.
          const debugDetail = err ? ` [debug: ${err.name || "Error"}: ${err.message || String(err)}]` : "";
          setHeard(friendly + debugDetail);
          setPhase("ask");
          return;
        }

        // Hiện lại đúng chữ Whisper nghe được (không phải giọng máy đọc lại) — để phụ huynh/giáo
        // viên kiểm tra máy có nghe đúng những gì học sinh nói không, nhất là lúc mới bật tính
        // năng nhận diện giọng nói qua Whisper, độ chính xác chưa được kiểm chứng nhiều.
        // TẠM THỜI thêm debug (thiết bị dùng WebGPU/WASM, độ dài audio, biên độ lớn nhất) để xác
        // định nguyên nhân Whisper thỉnh thoảng trả về "..." dù đã nói rõ — xoá phần debug này
        // sau khi xác định xong nguyên nhân.
        const debugText = debugInfo
          ? ` [debug: ${debugInfo.device}, ${debugInfo.durationSec}s, đỉnh âm ${debugInfo.maxAmplitude}, ${debugInfo.blobBytes}B]`
          : "";
        setHeard((said ? `Máy nghe được: "${said}"` : "Máy không nghe thấy gì.") + debugText);

        // Câu hỏi Yes/No có đáp án xác định (expectedYesNo: "yes"|"no") → chấm đúng/sai thật,
        // sai thì cho thử lại. "either" (phụ thuộc thông tin cá nhân học sinh) → luôn chấp nhận.
        // Chấp nhận thêm các cách nói tắt phổ biến (yeah/yep/uh-huh, nope/nah) — trẻ nhỏ ít khi
        // nói "yes"/"no" chuẩn, Whisper cũng hay nhận nhầm các từ này.
        if (scene.expectedYesNo && scene.expectedYesNo !== "either") {
          const saidNorm = normalize(said);
          const saidYes = /\b(yes|yeah|yep|yup|uh-?huh)\b/.test(saidNorm);
          const saidNo = /\b(no|nope|nah)\b/.test(saidNorm);
          const ok =
            (scene.expectedYesNo === "yes" && saidYes && !saidNo) ||
            (scene.expectedYesNo === "no" && saidNo && !saidYes);
          if (!ok) {
            if (handleWrong()) return;
            setPhase("ask");
            return;
          }
          setResult(true);
        }

        // Câu hỏi mở có từ khoá đáp án cụ thể (expectedKeyword, vd "yellow"/"three") — chấm đúng
        // khi lời nói có từ GẦN GIỐNG từ khoá đó (không cần khớp tuyệt đối, xem fuzzyIncludesWord),
        // để không bắt lỗi oan khi Whisper nhận nhầm 1-2 ký tự do bé phát âm chưa chuẩn.
        if (scene.expectedKeyword) {
          const saidNorm = normalize(said);
          // Vài câu có nhiều đáp án đều đúng (vd "She's phoning."/"She's talking.") —
          // expectedKeyword là mảng thì chấp nhận khớp BẤT KỲ từ khoá nào trong đó.
          const keywords = Array.isArray(scene.expectedKeyword) ? scene.expectedKeyword : [scene.expectedKeyword];
          const ok = keywords.some(k => fuzzyIncludesWord(saidNorm, k));
          if (!ok) {
            if (handleWrong()) return;
            setPhase("ask");
            return;
          }
          setResult(true);
        }

        const p = pickPraise();
        setPraise(p);
        playLine(p.text, { audioUrl: p.audioUrl, onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
        setPhase("done");
      };
      setPhase("recording");
      recorder.start();
    } catch (err) {
      // TẠM THỜI hiện thêm chi tiết lỗi thật để debug lỗi mic trên thiết bị thật — xoá phần
      // debug này sau khi xác định xong nguyên nhân.
      const debugDetail = err ? ` [debug: ${err.name || "Error"}: ${err.message || String(err)}]` : "";
      setHeard("Không dùng được micro. Kiểm tra quyền truy cập micro." + debugDetail);
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
        {scene.answerTemplate && (
          <div className="answer-template">
            💡 Gợi ý: <strong>{scene.answerTemplate}</strong>
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
        {phase === "done" && praise && (
          <div className="result-ok">{praise.emoji} {praise.text}</div>
        )}
        {revealed && (
          <div className="result-hint">Đáp án đúng: <strong>{micAnswerLabel(scene)}</strong></div>
        )}
        {!revealed && result === false && wrongPraise && (
          <div className="result-bad">{wrongPraise.emoji} {wrongPraise.text}</div>
        )}
      </div>
    </>
  );
}

// ---------- Canh-click: click vào vật trong ảnh Scene ----------
function SceneClickScene({ scene, onNext }) {
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
        setTimeout(onNext, REVEAL_DELAY_MS);
        return;
      }
      const w = pickWrong();
      setWrongPraise(w);
      playLine(w.text, { audioUrl: w.audioUrl });
    }
  }

  return (
    <>
      <div className="scene-body">
        <ExaminerLine text={scene.examinerLine} />
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
        <div className={correct ? "result-ok" : revealed ? "result-hint" : wrong ? "result-bad" : "result-hint"}>
          {correct
            ? `${praise.emoji} ${praise.text}`
            : revealed
              ? <>Đáp án đúng: <strong>{scene.target.label}</strong></>
              : wrong
                ? `${wrongPraise.emoji} ${wrongPraise.text}`
                : "Chạm vào đáp án đúng nhé"}
        </div>
      </div>
    </>
  );
}

// ---------- The-chon: chọn đúng thẻ trong 4 lựa chọn ----------
function CardSelectScene({ scene, onNext }) {
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
        setTimeout(onNext, REVEAL_DELAY_MS);
        return;
      }
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
        <div className={correct ? "result-ok" : revealed ? "result-hint" : wrongId ? "result-bad" : "result-hint"}>
          {correct
            ? `${praise.emoji} ${praise.text}`
            : revealed
              ? <>Đáp án đúng: <strong>{correctOption.label}</strong></>
              : wrongId
                ? `${wrongPraise.emoji} ${wrongPraise.text}`
                : "Chạm vào đáp án đúng nhé"}
        </div>
      </div>
    </>
  );
}

// ---------- Dat-vi-tri: kéo-thả thẻ vào đúng vị trí trên ảnh Scene ----------
function DragDropScene({ scene, onNext }) {
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
        setTimeout(onNext, REVEAL_DELAY_MS);
        return;
      }
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
