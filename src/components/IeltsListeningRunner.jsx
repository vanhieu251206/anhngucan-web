import { useEffect, useMemo, useState } from "react";

// Màn làm bài IELTS Listening (Test 1-4 → Section 1-4) — mô phỏng cấu trúc IeltsPracticeRunner.jsx
// (Reading): audio + câu hỏi cuộn riêng bên phải, tab chuyển Section, timer, nộp bài chấm điểm
// ngay. Không giới hạn lượt làm (cùng tinh thần Luyện đề Reading, chốt 2026-09-10/11).

function normalizeAnswer(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}

function flattenQuestions(sections) {
  const flat = [];
  let n = 1;
  (sections ?? []).forEach((section, si) => {
    (section.groups ?? []).forEach((group, gi) => {
      (group.questions ?? []).forEach((q, qi) => {
        flat.push({ number: n, sectionIndex: si, groupIndex: gi, questionIndex: qi, type: group.type, q });
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

export default function IeltsListeningRunner({ test, onBack }) {
  const flat = useMemo(() => flattenQuestions(test.sections), [test]);
  const [activeSection, setActiveSection] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(test.maxAttempts ? null : null);

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

  const score = useMemo(() => {
    if (!submitted) return null;
    let correct = 0;
    flat.forEach(entry => {
      if (isCorrect(entry, answers[entry.number])) correct++;
    });
    return { correct, total: flat.length };
  }, [submitted, flat, answers]);

  const section = test.sections[activeSection];
  const sectionQuestions = flat.filter(e => e.sectionIndex === activeSection);

  return (
    <div className="ielts-practice-screen">
      <div className="ielts-practice-topbar">
        <button className="speaking-fullscreen-back" onClick={onBack}>⬅ Quay lại</button>
        <h1 className="ielts-practice-title">{test.title}</h1>
      </div>

      <div className="ielts-practice-body">
        <div className="ielts-practice-passage-tabs">
          {test.sections.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`ielts-practice-tab${activeSection === i ? " is-active" : ""}`}
              onClick={() => setActiveSection(i)}
            >
              Recording {i + 1}
            </button>
          ))}
        </div>

        <div className="ielts-practice-columns">
          <div className="ielts-practice-passage-col">
            <h2>{section.title}</h2>
            {section.audioUrl ? (
              <audio className="ielts-full-audio" src={section.audioUrl} controls />
            ) : (
              <p className="ielts-full-audio-empty">Chưa có audio cho section này.</p>
            )}
            {section.note && <p className="ielts-practice-note">{section.note}</p>}
          </div>

          <div className="ielts-practice-questions-col">
            {(section.groups ?? []).map((g, gi) => (
              <div className="ielts-practice-group" key={gi}>
                {g.instruction && <p className="ielts-practice-instruction">{g.instruction}</p>}
                {g.questions.map((q, qi) => {
                  const entry = sectionQuestions.find(e => e.groupIndex === gi && e.questionIndex === qi);
                  const number = entry.number;
                  const value = answers[number];
                  const correct = submitted ? isCorrect(entry, value) : null;
                  return (
                    <div className={`ielts-practice-question${submitted ? (correct ? " is-correct" : " is-wrong") : ""}`} key={qi}>
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
              onClick={() => setActiveSection(entry.sectionIndex)}
            >
              {entry.number}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
