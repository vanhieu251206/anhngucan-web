import { useEffect, useState } from "react";
import { optimizeImage } from "../lib/cloudinaryImage.js";
import { isPart2Right as isRight } from "../lib/grading/listeningExam.js";

// Luyện đề Listening Starters — Part 2 (nghe và viết tên hoặc số). Trình bày y như trang sách: tiêu đề,
// đề bài, tranh, 2 câu Examples đã điền sẵn (chữ viết tay trên dòng chấm), rồi 5 Questions có dòng chấm
// để điền. Dùng chung cho màn làm bài (học sinh) và xem trước trong CMS (`preview`).
// Dữ liệu (soạn ở StartersListeningExamStudio.jsx): { audioUrl, imageUrl, examples: [{ question, answer }],
// questions: [{ question, prefix, answer }] } — `answer` có thể gồm nhiều đáp án chấp nhận, cách nhau bằng "/".
// Quy tắc chấm (isRight) ở lib/grading/listeningExam.js — dùng chung với Worker chấm bài phía máy chủ.
export function Part2Sheet({ part, values = [], onChange, submitted = false, reveal = true, preview = false }) {
  const questions = (part.questions ?? []).filter(q => q.question?.trim());
  const examples = (part.examples ?? []).filter(e => e.question?.trim());
  const movers = part.variant === "movers"; // Movers: 1 ví dụ, có tiêu đề tranh + chữ in sẵn sau dòng, không chia mục Examples/Questions
  return (
    <div className="p2s">
      <h2 className="p2s-title">Part 2</h2>
      <p className="p2s-count">– {questions.length} questions –</p>
      {movers ? (
        <p className="p2s-instr">Listen and write. There is one example.</p>
      ) : (
        <p className="p2s-instr">
          Read the question. Listen and write a name or a number.
          <br />
          There are two examples.
        </p>
      )}
      {part.audioUrl && <audio className="p2r-audio" src={part.audioUrl} controls />}

      {part.imageUrl && <img className="p2s-img" src={optimizeImage(part.imageUrl)} alt="" draggable={false} />}

      {movers && part.heading?.trim() && <h3 className="p2s-head" style={{ textAlign: "center" }}>{part.heading}</h3>}

      {examples.length > 0 && (
        <>
          {!movers && <h3 className="p2s-head">Examples</h3>}
          {examples.map((e, i) => (
            <div className="p2s-row" key={i}>
              <span className="p2s-q">{e.question}</span>
              <span className="p2s-line"><span className="p2s-hand">{e.answer}</span></span>
            </div>
          ))}
        </>
      )}

      {!movers && <h3 className="p2s-head">Questions</h3>}
      {questions.map((q, i) => {
        const value = values[i] ?? "";
        const ok = submitted && reveal && isRight(q, value);
        const wrong = submitted && reveal && !ok;
        return (
          <div className="p2s-row p2s-row-q" key={i}>
            <span className="p2s-num">{i + 1}</span>
            <span className="p2s-q">{q.question}</span>
            {q.prefix && <span className="p2s-prefix">{q.prefix}</span>}
            <span className={`p2s-line${ok ? " is-ok" : ""}${wrong ? " is-wrong" : ""}`}>
              {preview ? (
                <span className="p2s-hand">{q.answer?.split("/")[0]?.trim()}</span>
              ) : (
                <input
                  className="p2s-input"
                  value={value}
                  disabled={submitted}
                  onChange={e => onChange(i, e.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              )}
            </span>
            {q.suffix && <span className="p2s-prefix">{q.suffix}</span>}
            {wrong && <span className="p2s-correct">{q.answer?.split("/")[0]?.trim()}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function StartersListeningPart2Runner({ part, submitted, reveal = true, onScore }) {
  const questions = (part.questions ?? []).filter(q => q.question?.trim());
  const [values, setValues] = useState([]);

  const score = questions.filter((q, i) => isRight(q, values[i])).length;
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
      <Part2Sheet part={part} values={values} onChange={setValue} submitted={submitted} reveal={reveal} />
    </div>
  );
}
