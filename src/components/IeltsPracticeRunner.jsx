import { useEffect, useMemo, useRef, useState } from "react";

// Màn làm bài "LUYỆN ĐỀ" IELTS Reading — mô phỏng giao diện đề thi thật: đồng hồ đếm giờ, khung
// đoạn văn cuộn riêng bên trái, khung câu hỏi cuộn riêng bên phải, ô điều hướng số câu hỏi, bật/tắt
// highlight, nộp bài rồi xem điểm + đáp án đúng. KHÁC ReadingRunner (Reading & Writing YLE, không
// timer/không highlight) — đây là màn CÓ chấm điểm nhưng KHÔNG dùng attempts.js (mục Luyện đề cho
// làm lại thoải mái để luyện tập, không giới hạn lượt như Speaking/Reading YLE — chốt 2026-09-10).

function normalizeAnswer(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}

// Đánh số câu hỏi liên tục xuyên suốt cả Test (giống đề thi thật, không reset về 1 ở mỗi passage).
function flattenQuestions(passages) {
  const flat = [];
  let n = 1;
  (passages ?? []).forEach((passage, pi) => {
    (passage.groups ?? []).forEach((group, gi) => {
      (group.questions ?? []).forEach((q, qi) => {
        flat.push({ number: n, passageIndex: pi, groupIndex: gi, questionIndex: qi, type: group.type, q });
        n++;
      });
    });
  });
  return flat;
}

function isCorrect(entry, value) {
  const { type, q } = entry;
  if (value == null || value === "") return false;
  if (type === "multiple-choice") return Number(value) === q.answerIndex;
  if (type === "tfng") return value === q.answer;
  const accepted = String(q.acceptedAnswers ?? "").split("|").map(normalizeAnswer).filter(Boolean);
  return accepted.includes(normalizeAnswer(value));
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function HighlightablePassage({ text, highlightOn }) {
  const ref = useRef(null);

  function handleMouseUp() {
    if (!highlightOn) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !ref.current) return;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;
    try {
      const mark = document.createElement("mark");
      mark.className = "ielts-practice-highlight";
      range.surroundContents(mark);
      sel.removeAllRanges();
    } catch {
      // Vùng chọn chạy qua nhiều thẻ (không đơn giản) — bỏ qua, không chặn thao tác đọc.
    }
  }

  return (
    <p ref={ref} onMouseUp={handleMouseUp}>
      {text}
    </p>
  );
}

export default function IeltsPracticeRunner({ test, onBack }) {
  const flat = useMemo(() => flattenQuestions(test.passages), [test]);
  const [activePassage, setActivePassage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [highlightOn, setHighlightOn] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    test.timeLimitMinutes ? test.timeLimitMinutes * 60 : null
  );
  const questionRefs = useRef({});

  useEffect(() => {
    if (secondsLeft == null || submitted) return;
    if (secondsLeft <= 0) {
      setSubmitted(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted]);

  function setAnswer(number, value) {
    setAnswers(a => ({ ...a, [number]: value }));
  }

  function jumpTo(number) {
    const entry = flat.find(e => e.number === number);
    if (!entry) return;
    setActivePassage(entry.passageIndex);
    setTimeout(() => {
      questionRefs.current[number]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  const score = useMemo(() => {
    if (!submitted) return null;
    let correct = 0;
    flat.forEach(entry => {
      if (isCorrect(entry, answers[entry.number])) correct++;
    });
    return { correct, total: flat.length };
  }, [submitted, flat, answers]);

  const passage = test.passages[activePassage];
  const passageQuestions = flat.filter(e => e.passageIndex === activePassage);

  return (
    <div className="ielts-practice-screen">
      <div className="ielts-practice-topbar">
        <button className="speaking-fullscreen-back" onClick={onBack}>⬅ Quay lại</button>
        <h1 className="ielts-practice-title">{test.title}</h1>
        <label className="ielts-practice-highlight-toggle">
          <input type="checkbox" checked={highlightOn} onChange={e => setHighlightOn(e.target.checked)} />
          Highlight nội dung
        </label>
      </div>

      <div className="ielts-practice-body">
        <div className="ielts-practice-passage-tabs">
          {test.passages.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`ielts-practice-tab${activePassage === i ? " is-active" : ""}`}
              onClick={() => setActivePassage(i)}
            >
              Passage {i + 1}
            </button>
          ))}
        </div>

        <div className="ielts-practice-columns">
          <div className="ielts-practice-passage-col">
            <h2>{passage.title}</h2>
            {passage.note && <p className="ielts-practice-note">{passage.note}</p>}
            {(passage.paragraphs ?? []).map((p, i) => (
              <HighlightablePassage key={i} text={p} highlightOn={highlightOn} />
            ))}
          </div>

          <div className="ielts-practice-questions-col">
            {(passage.groups ?? []).map((g, gi) => (
              <div className="ielts-practice-group" key={gi}>
                {g.instruction && <p className="ielts-practice-instruction">{g.instruction}</p>}
                {g.questions.map((q, qi) => {
                  const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === qi);
                  const number = entry.number;
                  const value = answers[number];
                  const correct = submitted ? isCorrect(entry, value) : null;
                  return (
                    <div
                      className={`ielts-practice-question${submitted ? (correct ? " is-correct" : " is-wrong") : ""}`}
                      key={qi}
                      ref={el => (questionRefs.current[number] = el)}
                    >
                      <span className="ielts-practice-qnum">{number}</span>
                      <div className="ielts-practice-qbody">
                        {g.type === "multiple-choice" && (
                          <>
                            <p>{q.text}</p>
                            {q.options.map((opt, oi) => (
                              <label className="ielts-practice-option" key={oi}>
                                <input
                                  type="radio"
                                  name={`q-${number}`}
                                  checked={value === oi}
                                  disabled={submitted}
                                  onChange={() => setAnswer(number, oi)}
                                />
                                {String.fromCharCode(65 + oi)}. {opt}
                              </label>
                            ))}
                            {submitted && !correct && (
                              <p className="ielts-practice-correct-answer">Đáp án đúng: {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}</p>
                            )}
                          </>
                        )}
                        {g.type === "tfng" && (
                          <>
                            <p>{q.text}</p>
                            <select className="admin-input" value={value ?? ""} disabled={submitted} onChange={e => setAnswer(number, e.target.value)}>
                              <option value="" disabled>— Chọn —</option>
                              <option value="TRUE">TRUE</option>
                              <option value="FALSE">FALSE</option>
                              <option value="NOT GIVEN">NOT GIVEN</option>
                            </select>
                            {submitted && !correct && <p className="ielts-practice-correct-answer">Đáp án đúng: {q.answer}</p>}
                          </>
                        )}
                        {g.type === "short-answer" && (
                          <>
                            {q.label && <p>{q.label}</p>}
                            <input
                              className="admin-input"
                              value={value ?? ""}
                              disabled={submitted}
                              onChange={e => setAnswer(number, e.target.value)}
                            />
                            {submitted && !correct && (
                              <p className="ielts-practice-correct-answer">
                                Đáp án đúng: {String(q.acceptedAnswers ?? "").split("|")[0]}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ielts-practice-sidebar">
        {secondsLeft != null && (
          <div className="ielts-practice-timer">
            <span>Thời gian làm bài:</span>
            <strong>{formatTime(Math.max(secondsLeft, 0))}</strong>
          </div>
        )}
        {!submitted ? (
          <button type="button" className="btn btn-primary ielts-practice-submit" onClick={() => setSubmitted(true)}>
            NỘP BÀI
          </button>
        ) : (
          <div className="ielts-practice-score">
            Điểm: {score.correct}/{score.total}
          </div>
        )}
        <div className="ielts-practice-navgrid">
          {flat.map(entry => (
            <button
              key={entry.number}
              type="button"
              className={`ielts-practice-navbtn${answers[entry.number] != null && answers[entry.number] !== "" ? " is-answered" : ""}${submitted ? (isCorrect(entry, answers[entry.number]) ? " is-correct" : " is-wrong") : ""}`}
              onClick={() => jumpTo(entry.number)}
            >
              {entry.number}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
