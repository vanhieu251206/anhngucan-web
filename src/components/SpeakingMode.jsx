import { useEffect, useRef, useState } from "react";
import { speak, normalize } from "../lib/speech.js";
import { transcribeBlob, isRecordingSupported } from "../lib/whisperSpeech.js";

export default function SpeakingMode({ lesson, onFinish }) {
  // Chào hỏi đã có sẵn ở Part 1 (SceneRunner, scene 1-2) — không lặp lại ở đây.
  const queue = useRef(lesson.speaking).current;
  const [index, setIndex] = useState(0);
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState({ text: "", ok: null });
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const step = queue[index];
  const isLast = index === queue.length - 1;

  useEffect(() => {
    setHeard("");
    setResult({ text: "", ok: null });
    setAnswered(false);
    speak(step.question);
  }, [index]);

  async function startHold(e) {
    e.preventDefault();
    if (busy || recording) return;
    if (!isRecordingSupported()) {
      setResult({ text: "Trình duyệt không hỗ trợ ghi âm.", ok: false });
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
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        if (blob.size < 500) return; // ghi âm quá ngắn, bỏ qua

        setBusy(true);
        setResult({ text: "Đang nhận diện...", ok: null });
        try {
          const said = await transcribeBlob(blob);
          setHeard(`Bạn nói: "${said}"`);

          const keywords = step.answer_keywords
            ? step.answer_keywords.split(",").map(k => normalize(k)).filter(Boolean)
            : [];

          if (keywords.length === 0) {
            setResult({ text: "👍 Cảm ơn bạn đã trả lời!", ok: true });
          } else {
            const saidNorm = normalize(said);
            const ok = keywords.some(k => saidNorm.includes(k));
            setResult({
              text: ok ? "✅ Đúng rồi, giỏi quá!" : "❌ Chưa đúng, thử lại nhé!",
              ok,
            });
          }
          setAnswered(true);
        } catch {
          setResult({ text: "Không nhận diện được, hãy thử lại.", ok: false });
        } finally {
          setBusy(false);
        }
      };

      setRecording(true);
      setHeard("");
      setResult({ text: "", ok: null });
      recorder.start();
    } catch {
      setResult({ text: "Không dùng được micro. Kiểm tra quyền truy cập micro.", ok: false });
    }
  }

  function stopHold(e) {
    e.preventDefault();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function handleNext() {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex(i => i + 1);
  }

  return (
    <div className="sentence-box">
      <div className="speaking-progress">
        Câu {index + 1} / {queue.length}
      </div>
      {step.image && (
        <img
          className="speaking-img"
          src={step.image}
          onError={e => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="sentence-text">{step.question}</div>
      <button
        className={`mic-btn${recording ? " recording" : ""}`}
        title="Bấm giữ để nói"
        disabled={busy}
        onMouseDown={startHold}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={startHold}
        onTouchEnd={stopHold}
      >
        🎤
      </button>
      <div className="heard-text">{heard}</div>
      <div className={result.ok === true ? "result-ok" : result.ok === false ? "result-bad" : ""}>
        {result.text}
      </div>
      {answered && (
        <button className="next-btn" onClick={handleNext}>
          {isLast ? "Hoàn thành ✅" : "Câu tiếp theo ➡"}
        </button>
      )}
    </div>
  );
}
