import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { playLine, normalize, stopCurrent, fuzzyIncludesWord } from "../lib/speech.js";
import { transcribeBlob, isRecordingSupported } from "../lib/whisperSpeech.js";

const BEE = `${import.meta.env.BASE_URL}assets/img/mascot/bee.png`;
const MIC_ICON = `${import.meta.env.BASE_URL}assets/img/icons/mic.png`;
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

function ExaminerLine({ text }) {
  return (
    <div className="examiner-line">
      <img className="examiner-bee" src={BEE} alt="Giám khảo" />
      <div className="sentence-text">{text}</div>
    </div>
  );
}

// Tính kích thước khung ảnh Scene theo ĐÚNG tỉ lệ gốc 1200:896, luôn vừa khít cả chiều rộng
// lẫn chiều cao đang có (không tràn, không cần cuộn) — đo bằng ResizeObserver trên khung cha
// (.part1-scene-stage) thay vì dùng CSS aspect-ratio, vì aspect-ratio kết hợp flexbox khi thiếu
// chỗ theo chiều dọc từng chỉ co HEIGHT mà giữ nguyên width, làm ảnh bị bóp méo/lệch hẳn khỏi
// toạ độ % của highlight/hotspot (bug đã gặp thật, xem lịch sử B3-Code-scene.md).
const SCENE_RATIO = 1200 / 896;
function useFitBoxSize(stageRef) {
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    function measure() {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      let boxW = w;
      let boxH = boxW / SCENE_RATIO;
      if (boxH > h) {
        boxH = h;
        boxW = boxH * SCENE_RATIO;
      }
      setSize({ width: boxW, height: boxH });
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return size;
}

// Khung bọc ảnh Scene, dùng chung cho MỌI scene có ảnh + toạ độ % bên trong (highlight/hotspot
// click/kéo-thả) — luôn giữ đúng tỉ lệ 1200:896 nhờ useFitBoxSize, để toạ độ % không bao giờ lệch.
function SceneStage({ extraClassName = "", onClick, innerRef, cursor, children }) {
  const stageRef = useRef(null);
  const size = useFitBoxSize(stageRef);
  return (
    <div ref={stageRef} className="part1-scene-stage">
      <div
        ref={innerRef}
        className={`part1-scene${extraClassName ? ` ${extraClassName}` : ""}`}
        style={{ ...(size ? { width: size.width, height: size.height } : undefined), cursor }}
        onClick={onClick}
      >
        {children}
      </div>
    </div>
  );
}

// Ảnh Scene + khung khoanh vùng gợi ý (không bấm được) — dùng chung cho Huong-dan và
// câu hỏi mic Yes/No có chỉ vào 1 vật cụ thể trong ảnh (vd "Is this the monkey?").
// scene.demoCard: dùng cho Huong-dan giám khảo LÀM MẪU đặt thẻ vào 1 vị trí (vd trước khi
// yêu cầu học sinh tự kéo-thả) — hiện sẵn ảnh thẻ tại đúng vị trí target, không tương tác được.
function SceneImageWithHighlight({ scene }) {
  if (!scene.sceneImage) return null;
  if (!scene.highlight && !scene.demoCard) {
    return (
      <img
        className="speaking-img"
        src={scene.sceneImage}
        onError={e => (e.currentTarget.style.display = "none")}
      />
    );
  }
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
      {scene.type === "mic" && <MicScene key={index} scene={scene} onNext={goNext} />}
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

// ---------- Chao-hoi / câu hỏi mic: hiện mẫu câu trả lời trước khi bấm mic ----------
function MicScene({ scene, onNext }) {
  const [phase, setPhase] = useState("ask"); // ask | recording | busy | done
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState(null); // null | true | false — chỉ dùng khi scene.expectedYesNo
  const [praise, setPraise] = useState(null);
  const [wrongPraise, setWrongPraise] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

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
        let said = "";
        try {
          said = await transcribeBlob(blob);
        } catch {
          said = "";
        }

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
            setResult(false);
            const w = pickWrong();
            setWrongPraise(w);
            playLine(w.text, { audioUrl: w.audioUrl });
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
          const ok = fuzzyIncludesWord(saidNorm, scene.expectedKeyword);
          if (!ok) {
            setResult(false);
            const w = pickWrong();
            setWrongPraise(w);
            playLine(w.text, { audioUrl: w.audioUrl });
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
        {result === false && wrongPraise && (
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

  useEffect(() => {
    playLine(scene.examinerLine, { audioUrl: scene.audioUrl });
  }, [scene]);

  function choose(hit) {
    if (correct) return;
    if (hit) {
      setCorrect(true);
      const p = pickPraise();
      setPraise(p);
      playLine(p.text, { audioUrl: p.audioUrl, onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
    } else {
      setWrong(true);
      const w = pickWrong();
      setWrongPraise(w);
      playLine(w.text, { audioUrl: w.audioUrl });
      setTimeout(() => setWrong(false), 1500);
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
            className="part1-hotspot"
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
        <div className={correct ? "result-ok" : wrong ? "result-bad" : "result-hint"}>
          {correct
            ? `${praise.emoji} ${praise.text}`
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

  useEffect(() => {
    playLine(scene.examinerLine, { audioUrl: scene.audioUrl });
  }, [scene]);

  function choose(id) {
    if (correct) return;
    if (id === scene.correctId) {
      setCorrect(true);
      const p = pickPraise();
      setPraise(p);
      playLine(p.text, { audioUrl: p.audioUrl, onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
    } else {
      setWrongId(id);
      const w = pickWrong();
      setWrongPraise(w);
      playLine(w.text, { audioUrl: w.audioUrl });
      setTimeout(() => setWrongId(null), 1500);
    }
  }

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
              className={`part1-option${correct && opt.id === scene.correctId ? " is-correct" : ""}${
                wrongId === opt.id ? " is-wrong is-shake" : ""
              }`}
              onClick={() => choose(opt.id)}
              aria-label={opt.label}
            >
              <img src={opt.image} onError={e => (e.currentTarget.style.display = "none")} />
            </button>
          ))}
        </div>
        <div className={correct ? "result-ok" : wrongId ? "result-bad" : "result-hint"}>
          {correct
            ? `${praise.emoji} ${praise.text}`
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
  const sceneRef = useRef(null);
  const draggingRef = useRef(false);

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
        const t = scene.target;
        hit = relX >= t.x && relX <= t.x + t.w && relY >= t.y && relY <= t.y + t.h;
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
      setWrong(true);
      setDragPos(null);
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
    if (correct) return;
    draggingRef.current = true;
    const p = e.touches ? e.touches[0] : e;
    setDragPos({ x: p.clientX, y: p.clientY });
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
          {correct && (
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
        {!correct && (
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
        <div className={correct ? "result-ok" : wrong ? "result-bad" : "result-hint"}>
          {correct
            ? `${praise.emoji} ${praise.text}`
            : wrong
              ? `${wrongPraise.emoji} ${wrongPraise.text}`
              : `Kéo ${scene.card.label} vào đúng vị trí nhé`}
        </div>
      </div>
    </>
  );
}
