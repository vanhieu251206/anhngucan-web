import { useEffect, useRef, useState } from "react";
import { speak, normalize } from "../lib/speech.js";

const GREETING = {
  image: "",
  question: "Hello! What's your name?",
  answer_keywords: "",
};

export default function SpeakingMode({ lesson, onFinish }) {
  const queue = useRef([GREETING, ...lesson.speaking]).current;
  const [index, setIndex] = useState(0);
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState({ text: "", ok: null });
  const [recording, setRecording] = useState(false);
  const [answered, setAnswered] = useState(false);
  const recognitionRef = useRef(null);

  const step = queue[index];
  const isLast = index === queue.length - 1;

  useEffect(() => {
    setHeard("");
    setResult({ text: "", ok: null });
    setAnswered(false);
    speak(step.question);
  }, [index]);

  function startHold(e) {
    e.preventDefault();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setResult({ text: "Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome.", ok: false });
      return;
    }
    if (recognitionRef.current) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setRecording(true);
    setHeard("");
    setResult({ text: "", ok: null });

    recognition.start();

    recognition.onresult = event => {
      const said = event.results[0][0].transcript;
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
    };

    recognition.onerror = event => {
      setResult({ text: `Không nghe rõ, hãy thử lại (${event.error})`, ok: false });
    };

    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
  }

  function stopHold(e) {
    e.preventDefault();
    if (recognitionRef.current) recognitionRef.current.stop();
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
