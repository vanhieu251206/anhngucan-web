import { useEffect, useState } from "react";

// Luyện đề Listening Movers — Part 3 (nghe và chọn chữ cái A–H cho từng người). Trình bày như trang sách: đề bài,
// 1 dòng ví dụ điền sẵn + 5 dòng (ảnh người, nhãn, ô chữ cái), rồi lưới 8 tranh A–H. Dùng chung cho màn làm bài
// và xem trước trong CMS (`preview` = điền sẵn đáp án). Dữ liệu (soạn ở MoversListeningPart3Editor.jsx):
// { variant: "movers", audioUrl, intro, pictures: [8 url], example: { question, image, answer },
//   questions: [{ question, image, answer: "A".."H" }] } — `question` là nhãn (vd "her mum").
export const MOVERS_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function Row({ row, num, value, correct, submitted, locked, onPick }) {
  const ok = submitted && value === correct;
  const wrong = submitted && !ok;
  return (
    <div className="p3m-row">
      <div className="p3m-photo">{row.image ? <img src={row.image} alt="" draggable={false} /> : <span className="p3s-img-empty" />}</div>
      <div className="p3m-main">
        <div className="p3m-label">
          {num != null && <span className="p3s-num">{num}</span>}
          {row.question}
          <span className={`p3m-box${ok ? " is-ok" : ""}${wrong ? " is-wrong" : ""}`}>{value || ""}</span>
          {wrong && <span className="p2s-correct">{correct}</span>}
        </div>
        {!locked && (
          <div className="p3m-chips">
            {MOVERS_LETTERS.map(L => (
              <button
                key={L}
                type="button"
                className={`p3m-chip${value === L ? " is-picked" : ""}`}
                disabled={submitted}
                onClick={() => onPick(L)}
              >
                {L}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MoversPart3Sheet({ part, values = [], onChange, submitted = false, preview = false }) {
  const questions = (part.questions ?? []).filter(q => q.question?.trim());
  const ex = part.example;
  return (
    <div className="p3s">
      <h2 className="p2s-title">Part 3</h2>
      <p className="p2s-count">– {questions.length} questions –</p>
      {part.intro?.trim() && <p className="p2s-instr" style={{ fontWeight: 700 }}>{part.intro}</p>}
      <p className="p2s-instr">Listen and write a letter in each box. There is one example.</p>
      {part.audioUrl && <audio className="p2r-audio" src={part.audioUrl} controls />}

      {ex?.question?.trim() && <Row row={ex} value={ex.answer} correct={ex.answer} locked />}
      {questions.map((q, i) => (
        <Row
          key={i}
          row={q}
          num={i + 1}
          value={preview ? q.answer : values[i]}
          correct={q.answer}
          submitted={submitted}
          locked={preview}
          onPick={L => onChange?.(i, L)}
        />
      ))}

      <div className="p3m-pics">
        {MOVERS_LETTERS.map((L, i) => (
          <div className="p3m-pic" key={L}>
            {part.pictures?.[i] ? <img src={part.pictures[i]} alt="" draggable={false} /> : <span className="p3s-img-empty" />}
            <strong>{L}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MoversListeningPart3Runner({ part, submitted, onScore }) {
  const questions = (part.questions ?? []).filter(q => q.question?.trim());
  const [values, setValues] = useState([]);

  const score = questions.filter((q, i) => values[i] === q.answer).length;
  useEffect(() => {
    onScore?.({ score, total: questions.length });
  }, [score, questions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function setValue(i, v) {
    setValues(vs => {
      const next = [...vs];
      next[i] = v;
      return next;
    });
  }

  return (
    <div className="p2r">
      <MoversPart3Sheet part={part} values={values} onChange={setValue} submitted={submitted} />
    </div>
  );
}
