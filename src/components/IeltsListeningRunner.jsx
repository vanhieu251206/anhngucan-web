import { useMemo, useState } from "react";
import ExamTimer, { useExamTimer } from "./ExamTimer.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { useTestSubmission } from "../lib/testSubmit.js";
import SubmitStatus from "./SubmitStatus.jsx";
import { flattenSections as flattenQuestions, isIeltsCorrect as isCorrect } from "../lib/grading/ielts.js";

// Màn làm bài IELTS Listening (Test 1-4 → Section 1-4) — mô phỏng cấu trúc IeltsPracticeRunner.jsx
// (Reading): audio + câu hỏi cuộn riêng bên phải, tab chuyển Section, timer, nộp bài chấm điểm
// ngay. Không giới hạn lượt làm (cùng tinh thần Luyện đề Reading, chốt 2026-09-10/11).

// Quy tắc chấm nằm ở lib/grading/ielts.js — dùng chung với Worker chấm bài phía máy chủ.

export default function IeltsListeningRunner({ test, onBack, studentUid, studentName, studentClass, seriesId, level, openingId }) {
  const flat = useMemo(() => flattenQuestions(test.sections), [test]);
  const [activeSection, setActiveSection] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const { isStaff, isTester } = useAuth();
  const reveal = isStaff || isTester; // học sinh thật chỉ thấy điểm; admin/giáo viên/tài khoản đặc biệt thấy đáp án
  // Đồng hồ chung (ExamTimer.jsx): hết giờ tự nộp bài.
  // Học sinh: máy chủ chấm (lib/testSubmit.js) → điểm trả về. submitState: { error? } khi đang nộp/lỗi.
  const [serverScore, setServerScore] = useState(null);
  const [submitState, setSubmitState] = useState(null);
  const submitToServer = useTestSubmission({ kind: "ielts-listening", seriesId, level, testId: test.id, openingId, lessonLabel: test.title, studentName });
  const timer = useExamTimer({ limitMinutes: test.timeLimitMinutes, running: !submitted && !submitState, onExpire: submitNow });

  function setAnswer(number, value) {
    setAnswers(a => ({ ...a, [number]: value }));
  }

  // Chốt bài: khoá + lưu chi tiết từng câu cho giáo viên/admin (học sinh chỉ thấy điểm). Không lưu ở Preview CMS.
  async function submitNow() {
    if (submitted) return;
    const payload = { answers, elapsedMs: timer.getElapsedMs() };
    if (reveal) {
      setSubmitted(true);
      submitToServer(payload).catch(() => {});
      return;
    }
    setSubmitState({});
    try {
      const r = await submitToServer(payload);
      setServerScore({ correct: r.correct, total: r.total });
      setSubmitted(true);
      setSubmitState(null);
    } catch (error) {
      setSubmitState({ error });
    }
  }

  const score = useMemo(() => {
    if (!submitted) return null;
    if (!reveal) return serverScore;
    let correct = 0;
    flat.forEach(entry => {
      if (isCorrect(entry, answers[entry.number])) correct++;
    });
    return { correct, total: flat.length };
  }, [submitted, flat, answers, reveal, serverScore]);

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
                  const correct = (submitted && reveal) ? isCorrect(entry, value) : null;
                  return (
                    <div className={`ielts-practice-question${(submitted && reveal) ? (correct ? " is-correct" : " is-wrong") : ""}`} key={qi}>
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
                            {submitted && reveal && !correct && (
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
                            {submitted && reveal && !correct && <p className="ielts-practice-correct-answer">Đáp án đúng: {q.answer}</p>}
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
                            {submitted && reveal && !correct && (
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
        <ExamTimer timer={timer} />
        {submitState ? (
          <SubmitStatus error={submitState.error} onRetry={submitNow} />
        ) : !submitted ? (
          <button type="button" className="btn btn-primary ielts-practice-submit" onClick={submitNow}>
            NỘP BÀI
          </button>
        ) : (
          <div className="ielts-practice-score">
            Điểm: {score?.correct}/{score?.total}
          </div>
        )}
        <div className="ielts-practice-navgrid">
          {flat.map(entry => (
            <button
              key={entry.number}
              type="button"
              className={`ielts-practice-navbtn${answers[entry.number] != null && answers[entry.number] !== "" ? " is-answered" : ""}${(submitted && reveal) ? (isCorrect(entry, answers[entry.number]) ? " is-correct" : " is-wrong") : ""}`}
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
