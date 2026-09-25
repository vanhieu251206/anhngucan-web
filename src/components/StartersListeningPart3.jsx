import { useEffect, useState } from "react";
import { optimizeImage } from "../lib/cloudinaryImage.js";

// Luyện đề Listening Starters — Part 3 (nghe và tick vào ô đúng). Trình bày y như trang sách: tiêu đề,
// đề bài, 1 câu ví dụ đã tick sẵn, rồi 5 câu, mỗi câu có 3 ảnh A/B/C và 3 ô vuông để tick. Dùng chung cho
// màn làm bài (học sinh) và xem trước trong CMS (`preview` = tick sẵn đáp án đúng).
// Dữ liệu (soạn ở StartersListeningPart3Editor.jsx): { audioUrl, example: { question, images: [a,b,c],
// answer }, questions: [{ question, images: [a,b,c], answer: "A"|"B"|"C" }] }.
export const LETTERS = ["A", "B", "C"];

function Options({ images, value, onPick, correct, submitted, reveal = true, locked }) {
  return (
    <div className="p3s-opts">
      {LETTERS.map((L, i) => {
        const picked = value === L;
        const isCorrect = correct === L;
        const state = submitted && reveal ? (isCorrect ? " is-correct" : picked ? " is-wrong" : "") : picked ? " is-picked" : "";
        return (
          <div className={`p3s-opt${state}`} key={L}>
            <button type="button" className="p3s-img-btn" disabled={locked || submitted} onClick={() => onPick(L)}>
              {images?.[i] ? <img src={optimizeImage(images[i])} alt="" draggable={false} /> : <span className="p3s-img-empty" />}
            </button>
            <button type="button" className="p3s-choice" disabled={locked || submitted} onClick={() => onPick(L)}>
              <span className="p3s-letter">{L}</span>
              <span className="p3s-box">{picked || (submitted && reveal && isCorrect) ? "✓" : ""}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Part3Sheet({ part, values = [], onChange, submitted = false, reveal = true, preview = false }) {
  const questions = (part.questions ?? []).filter(q => q.question?.trim());
  const ex = part.example;
  return (
    <div className="p3s">
      <h2 className="p2s-title">Part {part.partNo ?? 3}</h2>
      <p className="p2s-count">– {questions.length} questions –</p>
      <p className="p2s-instr">Listen and tick (✓) the box. There is one example.</p>
      {part.audioUrl && <audio className="p2r-audio" src={part.audioUrl} controls />}

      {ex?.question?.trim() && (
        <div className="p3s-q">
          <p className="p3s-qtext">{ex.question}</p>
          <Options images={ex.images} value={ex.answer} correct={ex.answer} locked onPick={() => {}} />
        </div>
      )}

      {questions.map((q, i) => (
        <div className="p3s-q" key={i}>
          <p className="p3s-qtext"><span className="p3s-num">{i + 1}</span>{q.question}</p>
          <Options
            images={q.images}
            value={preview ? q.answer : values[i]}
            correct={q.answer}
            submitted={submitted}
            reveal={reveal}
            locked={preview}
            onPick={L => onChange?.(i, L)}
          />
        </div>
      ))}
    </div>
  );
}

export default function StartersListeningPart3Runner({ part, submitted, reveal = true, onScore }) {
  const questions = (part.questions ?? []).filter(q => q.question?.trim());
  const [values, setValues] = useState([]);

  const score = questions.filter((q, i) => values[i] != null && values[i] === q.answer).length;
  useEffect(() => {
    onScore?.({ score, total: questions.length, answers: values });
  }, [score, questions.length, values]); // eslint-disable-line react-hooks/exhaustive-deps

  function setValue(i, v) {
    setValues(vs => {
      const next = [...vs];
      next[i] = v;
      return next;
    });
  }

  return (
    <div className="p2r">
      <Part3Sheet part={part} values={values} onChange={setValue} submitted={submitted} reveal={reveal} />
    </div>
  );
}
