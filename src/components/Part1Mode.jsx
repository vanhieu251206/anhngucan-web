import { useEffect, useState } from "react";
import { speak } from "../lib/speech.js";

const PRAISES = ["Well done!", "Great job!", "Excellent!", "Good job!", "Nice one!"];
const NEXT_DELAY_MS = 1300;

export default function Part1Mode({ steps, onFinish }) {
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(false);
  const [wrongId, setWrongId] = useState(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  useEffect(() => {
    setCorrect(false);
    setWrongId(null);
    speak(step.question);
  }, [index]);

  function choose(id) {
    if (correct) return;
    const ok = step.type === "scene-click" ? id === step.target.id : id === step.correctId;

    if (ok) {
      setCorrect(true);
      setWrongId(null);
      const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      speak(praise);
      setTimeout(() => {
        if (isLast) {
          onFinish();
          return;
        }
        setCorrect(false);
        setWrongId(null);
        setIndex(i => i + 1);
      }, NEXT_DELAY_MS);
    } else {
      setWrongId(id ?? "scene");
      setTimeout(() => setWrongId(null), 700);
    }
  }

  const options =
    step.type === "scene-click"
      ? [{ id: step.target.id, label: step.target.label }, ...(step.distractors || []).map(d => ({ id: d, label: d }))]
      : step.options;

  return (
    <div className="sentence-box">
      <div className="speaking-progress">
        Câu {index + 1} / {steps.length}
      </div>
      <div className="sentence-text">{step.question}</div>

      {step.sceneImage ? (
        <div
          className={`part1-scene${wrongId === "scene" ? " is-shake" : ""}`}
          onClick={() => choose(null)}
        >
          <img
            className="part1-scene-img"
            src={step.sceneImage}
            onError={e => (e.currentTarget.style.display = "none")}
          />
          <button
            className={`part1-hotspot${correct ? " is-correct" : ""}`}
            style={{
              left: `${step.target.x}%`,
              top: `${step.target.y}%`,
              width: `${step.target.w}%`,
              height: `${step.target.h}%`,
            }}
            onClick={e => {
              e.stopPropagation();
              choose(step.target.id);
            }}
            aria-label={step.target.label}
          />
        </div>
      ) : (
        <div className="part1-options">
          {options.map(opt => (
            <button
              key={opt.id}
              className={`part1-option${correct && opt.id === step.correctId ? " is-correct" : ""}${
                wrongId === opt.id ? " is-wrong is-shake" : ""
              }`}
              onClick={() => choose(opt.id)}
            >
              {opt.image ? (
                <img src={opt.image} onError={e => (e.currentTarget.style.display = "none")} />
              ) : (
                <span className="part1-option-placeholder">🖼️</span>
              )}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className={correct ? "result-ok" : wrongId ? "result-bad" : "result-hint"}>
        {correct ? "✅ Đúng rồi, giỏi quá!" : wrongId ? "❌ Chưa đúng, thử lại nhé!" : "Chạm vào đáp án đúng nhé"}
      </div>
    </div>
  );
}
