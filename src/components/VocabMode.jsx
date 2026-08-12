import { useState } from "react";
import { speak } from "../lib/speech.js";

export default function VocabMode({ lesson }) {
  const [flipped, setFlipped] = useState(() => new Set());

  function toggle(index, word) {
    setFlipped(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
    speak(word);
  }

  return (
    <div id="vocab-cards" className="cards">
      {lesson.vocab.map((v, i) => (
        <div
          key={i}
          className={`vocab-card${flipped.has(i) ? " flipped" : ""}`}
          onClick={() => toggle(i, v.word)}
        >
          <img
            src={v.image}
            alt={v.word}
            onError={e => (e.currentTarget.style.display = "none")}
          />
          <div className="word">{v.word}</div>
          <div className="meaning">{v.meaning}</div>
        </div>
      ))}
    </div>
  );
}
