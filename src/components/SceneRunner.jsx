import { useEffect, useRef, useState } from "react";
import { speak } from "../lib/speech.js";
import { transcribeBlob, isRecordingSupported } from "../lib/whisperSpeech.js";

const BEE = `${import.meta.env.BASE_URL}assets/img/mascot/bee.png`;
const PRAISES = ["Well done!", "Great job!", "Excellent!", "Good job!", "Nice one!"];
const NEXT_DELAY_MS = 1300;
const NARRATION_PAUSE_MS = 1000;

function ExaminerLine({ text }) {
  return (
    <div className="examiner-line">
      <img className="examiner-bee" src={BEE} alt="Giám khảo" />
      <div className="sentence-text">{text}</div>
    </div>
  );
}

export default function SceneRunner({ scenes, onFinish }) {
  const [index, setIndex] = useState(0);
  const scene = scenes[index];
  const isLast = index === scenes.length - 1;

  function goNext() {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex(i => i + 1);
  }

  return (
    <div className="sentence-box">
      <div className="speaking-progress">
        Câu {index + 1} / {scenes.length}
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
    speak(scene.examinerLine, {
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
    <>
      <ExaminerLine text={scene.examinerLine} />
      {scene.sceneImage && (
        <img
          className="speaking-img"
          src={scene.sceneImage}
          onError={e => (e.currentTarget.style.display = "none")}
        />
      )}
    </>
  );
}

// ---------- Chao-hoi / câu hỏi mic: hiện mẫu câu trả lời trước khi bấm mic ----------
function MicScene({ scene, onNext }) {
  const [phase, setPhase] = useState("ask"); // ask | recording | busy | done
  const [heard, setHeard] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    speak(scene.examinerLine);
  }, [scene]);

  async function startHold(e) {
    e.preventDefault();
    if (phase !== "ask") return;
    if (!isRecordingSupported()) {
      setHeard("Trình duyệt không hỗ trợ ghi âm.");
      return;
    }
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
        try {
          const said = await transcribeBlob(blob);
          setHeard(said);
        } catch {
          setHeard("");
        }
        const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
        speak(praise, {
          onEnd: () => {
            if (scene.followupQuestion) {
              speak(scene.followupQuestion, {
                onEnd: () => setTimeout(onNext, NEXT_DELAY_MS),
              });
            } else {
              setTimeout(onNext, NEXT_DELAY_MS);
            }
          },
        });
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

  return (
    <>
      <ExaminerLine text={scene.examinerLine} />
      {scene.answerTemplate && (
        <div className="answer-template">
          Gợi ý trả lời: <strong>{scene.answerTemplate}</strong>
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
        🎤
      </button>
      {phase === "busy" && <div className="heard-text">Đang nhận diện...</div>}
      {heard && <div className="heard-text">Bạn nói: "{heard}"</div>}
      {phase === "done" && <div className="result-ok">✅ Cảm ơn bạn đã trả lời!</div>}
      {scene.followupQuestion && phase === "done" && (
        <div className="answer-template">
          Gợi ý trả lời: <strong>{scene.followupAnswerTemplate}</strong>
        </div>
      )}
    </>
  );
}

// ---------- Canh-click: click vào vật trong ảnh Scene ----------
function SceneClickScene({ scene, onNext }) {
  const [correct, setCorrect] = useState(false);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    speak(scene.examinerLine);
  }, [scene]);

  function choose(hit) {
    if (correct) return;
    if (hit) {
      setCorrect(true);
      const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      speak(praise, {
        onEnd: () => {
          if (scene.followupQuestion) {
            speak(scene.followupQuestion, { onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
          } else {
            setTimeout(onNext, NEXT_DELAY_MS);
          }
        },
      });
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 700);
    }
  }

  return (
    <>
      <ExaminerLine text={scene.examinerLine} />
      <div className={`part1-scene${wrong ? " is-shake" : ""}`} onClick={() => choose(false)}>
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
      </div>
      <div className={correct ? "result-ok" : wrong ? "result-bad" : "result-hint"}>
        {correct ? "✅ Đúng rồi, giỏi quá!" : wrong ? "❌ Chưa đúng, thử lại nhé!" : "Chạm vào đáp án đúng nhé"}
      </div>
    </>
  );
}

// ---------- The-chon: chọn đúng thẻ trong 4 lựa chọn ----------
function CardSelectScene({ scene, onNext }) {
  const [correct, setCorrect] = useState(false);
  const [wrongId, setWrongId] = useState(null);

  useEffect(() => {
    speak(scene.examinerLine);
  }, [scene]);

  function choose(id) {
    if (correct) return;
    if (id === scene.correctId) {
      setCorrect(true);
      const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      speak(praise, {
        onEnd: () => {
          if (scene.followupQuestion) {
            speak(scene.followupQuestion, { onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
          } else {
            setTimeout(onNext, NEXT_DELAY_MS);
          }
        },
      });
    } else {
      setWrongId(id);
      setTimeout(() => setWrongId(null), 700);
    }
  }

  return (
    <>
      <ExaminerLine text={scene.examinerLine} />
      <div className="part1-options">
        {scene.options.map(opt => (
          <button
            key={opt.id}
            className={`part1-option${correct && opt.id === scene.correctId ? " is-correct" : ""}${
              wrongId === opt.id ? " is-wrong is-shake" : ""
            }`}
            onClick={() => choose(opt.id)}
          >
            <img src={opt.image} onError={e => (e.currentTarget.style.display = "none")} />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
      <div className={correct ? "result-ok" : wrongId ? "result-bad" : "result-hint"}>
        {correct ? "✅ Đúng rồi, giỏi quá!" : wrongId ? "❌ Chưa đúng, thử lại nhé!" : "Chạm vào đáp án đúng nhé"}
      </div>
    </>
  );
}

// ---------- Dat-vi-tri: kéo-thả thẻ vào đúng vị trí trên ảnh Scene ----------
function DragDropScene({ scene, onNext }) {
  const [correct, setCorrect] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [dragPos, setDragPos] = useState(null); // {x,y} client coords khi đang kéo
  const sceneRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    speak(scene.examinerLine);
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
        const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
        speak(praise, {
          onEnd: () => {
            speak(scene.followupLine, { onEnd: () => setTimeout(onNext, NEXT_DELAY_MS) });
          },
        });
        return;
      }
      setWrong(true);
      setDragPos(null);
      setTimeout(() => setWrong(false), 700);
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
      <ExaminerLine text={scene.examinerLine} />
      <div className={`part1-scene${wrong ? " is-shake" : ""}`} ref={sceneRef}>
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
      </div>
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
        {correct ? "✅ Đúng rồi, giỏi quá!" : wrong ? "❌ Chưa đúng, thử lại nhé!" : `Kéo ${scene.card.label} vào đúng vị trí nhé`}
      </div>
    </>
  );
}
