import { useMemo, useState } from "react";

// Runner học sinh cho Reading & Writing — 1 TRANG SCROLL DÀI duy nhất cho cả Test (mọi Part nối
// tiếp nhau), có sidebar trái "Danh sách câu hỏi" để nhảy nhanh đến từng câu, giống bố cục các
// nền tảng luyện thi thật (vd YourHomework) — khác với SceneRunner của Speaking (chạy tuần tự
// từng scene kiểu Duolideo, không cuộn được cả bài 1 lượt). Nộp bài 1 LẦN cho toàn bộ Test.

function normalizeAnswer(s) {
  return (s ?? "").trim().toLowerCase();
}

function splitGapfillText(text) {
  return (text ?? "").split("___");
}

// Gộp mọi câu hỏi của mọi Part thành 1 danh sách phẳng, đánh số "Question N." liên tục xuyên suốt
// Test — dùng để đồng bộ số thứ tự giữa nội dung chính và sidebar.
function flattenQuestions(parts) {
  const flat = [];
  let n = 1;
  parts.forEach((part, partIndex) => {
    (part.questions ?? []).forEach((q, qIndex) => {
      flat.push({ question: q, partIndex, qIndex, qNumber: n });
      n += 1;
    });
  });
  return flat;
}

function isAnswered(question, value) {
  if (question.type === "gapfill") return (value ?? []).some(v => (v ?? "").trim());
  return !!(value ?? "").toString().trim();
}

function YesNoQuestion({ question, qNumber, value, onChange, checked }) {
  const isCorrect = checked && value === question.answer;
  const isWrong = checked && value && value !== question.answer;
  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <div className="reading-question-body">
        <p className="reading-question-text"><span className="reading-question-label">Question {qNumber}.</span> {question.text}</p>
        {question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <div className="reading-yesno-btns">
          {["yes", "no"].map(opt => (
            <button
              key={opt}
              type="button"
              className={`reading-yesno-btn${value === opt ? " is-selected" : ""}${
                checked && opt === question.answer ? " is-correct" : ""
              }${checked && value === opt && opt !== question.answer ? " is-wrong" : ""}`}
              disabled={checked}
              onClick={() => onChange(opt)}
            >
              {opt === "yes" ? "Yes" : "No"}
            </button>
          ))}
        </div>
        {isCorrect && <p className="reading-feedback reading-feedback-ok">✓ Chính xác!</p>}
        {isWrong && <p className="reading-feedback reading-feedback-bad">Đáp án đúng: {question.answer === "yes" ? "Yes" : "No"}</p>}
      </div>
    </div>
  );
}

function GapfillQuestion({ question, qNumber, values, onChange, checked }) {
  const segments = useMemo(() => splitGapfillText(question.text), [question.text]);
  const answers = question.answers ?? [];

  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <div className="reading-question-body">
        <p className="reading-question-label">Question {qNumber}.</p>
        {question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <p className="reading-gapfill-text">
          {segments.map((seg, i) => {
            const isLast = i === segments.length - 1;
            const gapIndex = i;
            if (isLast) return <span key={i}>{seg}</span>;
            const answered = values[gapIndex] ?? "";
            const correct = answers[gapIndex];
            const isOk = checked && normalizeAnswer(answered) === normalizeAnswer(correct);
            const isBad = checked && !isOk;
            return (
              <span key={i}>
                {seg}
                <input
                  className={`reading-gap-input${isOk ? " is-correct" : ""}${isBad ? " is-wrong" : ""}`}
                  value={answered}
                  disabled={checked}
                  onChange={e => onChange(gapIndex, e.target.value)}
                  size={Math.max(4, (correct?.length ?? 6) + 2)}
                />
                {isBad && <span className="reading-gap-answer"> ({correct})</span>}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}

function ShortAnswerQuestion({ question, qNumber, value, onChange, checked }) {
  const isOk = checked && normalizeAnswer(value) === normalizeAnswer(question.answer);
  const isBad = checked && !isOk;
  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <div className="reading-question-body">
        <p className="reading-question-label">Question {qNumber}.</p>
        {question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <p className="reading-question-text">
          {(question.prompt ?? "").includes("___") ? (
            (question.prompt ?? "").split("___").map((seg, i, arr) => (
              <span key={i}>
                {seg}
                {i < arr.length - 1 && (
                  <input
                    className={`reading-gap-input${isOk ? " is-correct" : ""}${isBad ? " is-wrong" : ""}`}
                    value={value ?? ""}
                    disabled={checked}
                    onChange={e => onChange(e.target.value)}
                    size={10}
                  />
                )}
              </span>
            ))
          ) : (
            <>
              {question.prompt}{" "}
              <input
                className={`reading-gap-input${isOk ? " is-correct" : ""}${isBad ? " is-wrong" : ""}`}
                value={value ?? ""}
                disabled={checked}
                onChange={e => onChange(e.target.value)}
                size={10}
              />
            </>
          )}
        </p>
        {isBad && <p className="reading-feedback reading-feedback-bad">Đáp án đúng: {question.answer}</p>}
      </div>
    </div>
  );
}

// Sidebar trái — danh sách số thứ tự câu hỏi, bấm vào nhảy (scroll) đến đúng câu trong trang.
// Câu đã trả lời hiện chấm xanh đậm (giống chấm "Đã làm" ở ảnh tham khảo).
function QuestionListSidebar({ flat, answers, checked }) {
  function goTo(qNumber) {
    document.getElementById(`rq-${qNumber}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="reading-sidebar">
      <h3 className="reading-sidebar-title">Danh sách câu hỏi</h3>
      <div className="reading-sidebar-grid">
        {flat.map(({ qNumber, question, partIndex, qIndex }) => {
          const answered = isAnswered(question, answers[partIndex]?.[qIndex]);
          return (
            <button
              key={qNumber}
              type="button"
              className={`reading-sidebar-dot${answered ? " is-answered" : ""}`}
              onClick={() => goTo(qNumber)}
            >
              {qNumber}
            </button>
          );
        })}
      </div>
      {!checked && <p className="reading-sidebar-hint">● Đã làm</p>}
    </div>
  );
}

// Component chính — hiện TOÀN BỘ Test (mọi Part nối tiếp) trên 1 trang cuộn được, nộp bài 1 lần.
export default function ReadingRunner({ parts, onFinish }) {
  const flat = useMemo(() => flattenQuestions(parts), [parts]);
  // answers[partIndex][qIndex] = giá trị trả lời — giữ cấu trúc lồng theo Part/câu để khớp đúng
  // dữ liệu gốc (parts[].questions[]), dễ tính điểm theo từng Part nếu cần sau này.
  const [answers, setAnswers] = useState(() => parts.map(p => (p.questions ?? []).map(() => undefined)));
  const [checked, setChecked] = useState(false);

  function setAnswer(partIndex, qIndex, val) {
    setAnswers(a => {
      const next = a.map(row => [...row]);
      next[partIndex][qIndex] = val;
      return next;
    });
  }

  function score() {
    let correct = 0;
    let total = 0;
    flat.forEach(({ question, partIndex, qIndex }) => {
      const value = answers[partIndex]?.[qIndex];
      if (question.type === "yesno") {
        total += 1;
        if (value === question.answer) correct += 1;
      } else if (question.type === "gapfill") {
        const gapAnswers = question.answers ?? [];
        gapAnswers.forEach((a, gi) => {
          total += 1;
          if (normalizeAnswer(value?.[gi]) === normalizeAnswer(a)) correct += 1;
        });
      } else if (question.type === "short-answer") {
        total += 1;
        if (normalizeAnswer(value) === normalizeAnswer(question.answer)) correct += 1;
      }
    });
    return { correct, total };
  }

  const { correct, total } = checked ? score() : { correct: 0, total: 0 };

  if (!flat.length) return null;

  return (
    <div className="reading-runner reading-runner-page">
      <QuestionListSidebar flat={flat} answers={answers} checked={checked} />

      <div className="reading-runner-main">
        {parts.map((part, partIndex) => (
          <div className="reading-part" key={partIndex}>
            <div className="reading-part-head">
              <h2>{part.title}</h2>
              {part.instruction && <p className="reading-part-instruction">{part.instruction}</p>}
            </div>
            <div className="reading-question-list">
              {(part.questions ?? []).map((q, qIndex) => {
                const { qNumber } = flat.find(f => f.partIndex === partIndex && f.qIndex === qIndex);
                const value = answers[partIndex]?.[qIndex];
                if (q.type === "yesno") {
                  return (
                    <YesNoQuestion
                      key={qIndex}
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      checked={checked}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                }
                if (q.type === "gapfill") {
                  return (
                    <GapfillQuestion
                      key={qIndex}
                      question={q}
                      qNumber={qNumber}
                      values={value ?? []}
                      checked={checked}
                      onChange={(gapIndex, val) =>
                        setAnswer(partIndex, qIndex, (() => {
                          const cur = [...(value ?? [])];
                          cur[gapIndex] = val;
                          return cur;
                        })())
                      }
                    />
                  );
                }
                return (
                  <ShortAnswerQuestion
                    key={qIndex}
                    question={q}
                    qNumber={qNumber}
                    value={value}
                    checked={checked}
                    onChange={val => setAnswer(partIndex, qIndex, val)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="reading-part-footer reading-runner-footer">
          {!checked ? (
            <button type="button" className="btn btn-primary" onClick={() => setChecked(true)}>
              Nộp bài
            </button>
          ) : (
            <>
              <p className="reading-score">Đúng {correct}/{total} câu</p>
              <button type="button" className="btn btn-primary" onClick={onFinish}>
                Hoàn thành
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
