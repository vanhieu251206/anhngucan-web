import { useState } from "react";
import ExamTimer, { useExamTimer } from "./ExamTimer.jsx";
import { gradePracticeTestGroups, groupHeading, questionNumber } from "../lib/ketPetPracticeTest.js";
import UnderlineText from "./UnderlineText.jsx";
import SubmitStatus from "./SubmitStatus.jsx";

// Phần tương tác thuần (không Header/chrome) của 1 Test Practice Test KET/PET — TÁI DÙNG cho cả màn
// học sinh làm thật (KetPetPracticeTestRunner.jsx, fetch từ Firestore) LẪN Preview trong CMS
// (KetPetPracticeTestStudio.jsx, xem trực tiếp dữ liệu đang soạn dở chưa lưu). Dữ liệu là danh sách
// NHÓM câu hỏi thứ tự I, II, III... (chốt người dùng 2026-09-16) — mỗi nhóm hiện tiêu đề số La Mã +
// hướng dẫn làm bài + đoạn văn dùng chung (nếu có), rồi tới các câu cùng dạng của nhóm đó, đánh số lại
// từ 1 trong mỗi nhóm (giống đề thi thật, xem BỔ SUNG.pdf).
// Nhãn "Question N" dùng lại đúng style của Reading (reading-question-badge/num trong index.css).
function QBadge({ n }) {
  return (
    <div className="reading-question-badge">
      <span className="reading-question-num">Question {n}</span>
    </div>
  );
}

// Đầu mục của 1 nhóm: tiêu đề lớn (nếu có) + "Exercise N: hướng dẫn" hoặc số La Mã + mục con (nếu có).
function GroupHead({ g, gi }) {
  const heading = groupHeading(g, gi);
  return (
    <>
      {g.section && <h3 className="vocab-section-title">{g.section}</h3>}
      {heading && <p className="vocab-group-instruction">{heading}</p>}
      {g.subtitle && <p className="vocab-group-subtitle">{g.subtitle}</p>}
    </>
  );
}

// revealAnswers=true CHỈ dùng cho Preview trong CMS (giáo viên xem đáp án). Học sinh luôn chỉ thấy số câu đúng/tổng.
export default function KetPetPracticeTestQuiz({ groups, revealAnswers = false, limitMinutes, canRetry = true, onSubmitted }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const view = revealAnswers ? result : null;

  function setAnswer(gi, qi, value) {
    setAnswers(a => ({ ...a, [`${gi}-${qi}`]: value }));
  }
  // Học sinh: onSubmitted trả về Promise điểm do MÁY CHỦ chấm (đề học sinh không có đáp án — lib/testSubmit.js);
  // chờ điểm đó rồi mới hiện. Preview CMS / admin / giáo viên (có đáp án) chấm tại chỗ như trước.
  const [submitState, setSubmitState] = useState(null); // { error? } khi đang nộp/lỗi
  async function handleSubmit() {
    if (result || (submitState && !submitState.error)) return;
    const graded = gradePracticeTestGroups(groups, answers);
    const pending = onSubmitted?.(graded, answers);
    if (!pending || revealAnswers) {
      setResult(graded);
      return;
    }
    setSubmitState({});
    try {
      const r = await pending;
      setResult({ correct: r.correct, total: r.total, results: [] });
      setSubmitState(null);
    } catch (error) {
      setSubmitState({ error });
    }
  }

  // Đồng hồ chung (ExamTimer.jsx) — chỉ hiện ở màn học sinh làm bài thật (có onSubmitted); hết giờ tự nộp.
  const timer = useExamTimer({ limitMinutes, running: !result && !submitState, onExpire: handleSubmit });
  function handleRetry() {
    setAnswers({});
    setResult(null);
  }

  // Nhóm "split-reading" (chốt người dùng 2026-09-17): đoạn văn hiện BÊN TRÁI, câu hỏi (trộn dạng
  // con qua q.type) hiện BÊN PHẢI, mô phỏng bố cục Luyện đề IELTS Reading nhưng chỉ áp dụng cho 1
  // nhóm câu hỏi này (không phải toàn màn hình như IeltsPracticeRunner.jsx).
  function renderSplitQuestionBody(q, gi, qi, r) {
    if (q.type === "multiple-choice") {
      return (
        <>
          <QBadge n={questionNumber(groups[gi], qi)} /><p className="vocab-question-text">{q.text}</p>
          <div className="vocab-options">
            {q.options.map((opt, oi) => {
              const picked = answers[`${gi}-${qi}`] === oi;
              const showState = view != null;
              const isRight = oi === q.answerIndex;
              return (
                <label
                  key={oi}
                  className={
                    "vocab-option" +
                    (picked ? " is-picked" : "") +
                    (showState && isRight ? " is-correct" : "") +
                    (showState && picked && !isRight ? " is-wrong" : "")
                  }
                >
                  <input
                    type="radio"
                    name={`ketpet-pt-split-${gi}-${qi}`}
                    checked={picked}
                    disabled={result != null}
                    onChange={() => setAnswer(gi, qi, oi)}
                  />
                  <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                </label>
              );
            })}
          </div>
        </>
      );
    }
    return (
      <>
        <QBadge n={questionNumber(groups[gi], qi)} /><p className="vocab-question-text">{q.text}</p>
        <input
          className={"vocab-input" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}
          value={answers[`${gi}-${qi}`] ?? ""}
          disabled={result != null}
          onChange={e => setAnswer(gi, qi, e.target.value)}
          placeholder="Nhập câu trả lời"
        />
        {view != null && r === false && (
          <p className="vocab-answer-key">Đáp án đúng: {(q.acceptedAnswers ?? []).join(" / ")}</p>
        )}
      </>
    );
  }

  if (!groups?.length) return <p className="vocab-empty">Chưa có câu hỏi nào.</p>;

  return (
    <div className="vocab-runner">
      {onSubmitted && <ExamTimer timer={timer} />}
      <section className="vocab-block">
        {groups.map((g, gi) => {
          if (g.type === "split-reading") {
            return (
              <div className="vocab-group" key={gi}>
                <GroupHead g={g} gi={gi} />
                {g.task && <p className="vocab-group-subtitle">{g.task}</p>}
                <div className="vocab-split-columns">
                  <div className="vocab-split-passage">
                    {g.passage && <p className="vocab-passage">{g.passage}</p>}
                  </div>
                  <div className="vocab-split-questions">
                    {g.questions.map((q, qi) => (
                      <div className="vocab-question" key={qi}>
                        {renderSplitQuestionBody(q, gi, qi, view?.results?.[gi]?.[qi])}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          return (
          <div className="vocab-group" key={gi}>
            <GroupHead g={g} gi={gi} />
            {g.passage && <p className="vocab-passage">{g.passage}</p>}
            {g.task && <p className="vocab-group-subtitle">{g.task}</p>}
            {g.type === "word-bank" && (g.wordBank ?? []).length > 0 && (
              <div className="vocab-word-bank">
                {g.wordBank.map((w, wi) => (
                  <span className="vocab-word-bank-item" key={wi}>{w}</span>
                ))}
              </div>
            )}

            {g.questions.map((q, qi) => {
              const r = view?.results?.[gi]?.[qi];
              return (
                <div className="vocab-question" key={qi}>
                  {g.type === "multiple-choice" && (
                    <>
                      <QBadge n={questionNumber(g, qi)} /><p className="vocab-question-text">{q.text}</p>
                      <div className="vocab-options">
                        {q.options.map((opt, oi) => {
                          const picked = answers[`${gi}-${qi}`] === oi;
                          const showState = view != null;
                          const isRight = oi === q.answerIndex;
                          return (
                            <label
                              key={oi}
                              className={
                                "vocab-option" +
                                (picked ? " is-picked" : "") +
                                (showState && isRight ? " is-correct" : "") +
                                (showState && picked && !isRight ? " is-wrong" : "")
                              }
                            >
                              <input
                                type="radio"
                                name={`ketpet-pt-${gi}-${qi}`}
                                checked={picked}
                                disabled={result != null}
                                onChange={() => setAnswer(gi, qi, oi)}
                              />
                              <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {g.type === "pronunciation-underline" && (
                    <>
                    <QBadge n={questionNumber(g, qi)} />
                    <div className="vocab-options vocab-options-row">
                      {q.options.map((opt, oi) => {
                        const picked = answers[`${gi}-${qi}`] === oi;
                        const showState = view != null;
                        const isRight = oi === q.answerIndex;
                        return (
                          <label
                            key={oi}
                            className={
                              "vocab-option" +
                              (picked ? " is-picked" : "") +
                              (showState && isRight ? " is-correct" : "") +
                              (showState && picked && !isRight ? " is-wrong" : "")
                            }
                          >
                            <input
                              type="radio"
                              name={`ketpet-pt-underline-${gi}-${qi}`}
                              checked={picked}
                              disabled={result != null}
                              onChange={() => setAnswer(gi, qi, oi)}
                            />
                            <span>{String.fromCharCode(65 + oi)}. <UnderlineText text={opt} /></span>
                          </label>
                        );
                      })}
                    </div>
                    </>
                  )}

                  {g.type === "fill-blank" && (
                    <>
                      <QBadge n={questionNumber(g, qi)} />
                      <p className="vocab-question-text">
                        {q.text}
                        {q.hint && <span className="vocab-question-hint"> ({q.hint})</span>}
                      </p>
                      <input
                        className={"vocab-input" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}
                        value={answers[`${gi}-${qi}`] ?? ""}
                        disabled={result != null}
                        onChange={e => setAnswer(gi, qi, e.target.value)}
                        placeholder="Nhập câu trả lời"
                      />
                      {view != null && r === false && (
                        <p className="vocab-answer-key">Đáp án đúng: {(q.acceptedAnswers ?? []).join(" / ")}</p>
                      )}
                    </>
                  )}

                  {g.type === "word-bank" && (
                    <>
                      <QBadge n={questionNumber(g, qi)} /><p className="vocab-question-text">{q.text}</p>
                      <input
                        className={"vocab-input" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}
                        value={answers[`${gi}-${qi}`] ?? ""}
                        disabled={result != null}
                        onChange={e => setAnswer(gi, qi, e.target.value)}
                        placeholder="Nhập từ trong khung từ"
                      />
                      {view != null && r === false && (
                        <p className="vocab-answer-key">Đáp án đúng: {q.answer}</p>
                      )}
                    </>
                  )}

                  {g.type === "open-ended" && (
                    <>
                      <QBadge n={questionNumber(g, qi)} /><p className="vocab-question-text">{q.prompt}</p>
                      <div className={"open-ended-answer" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}>
                        {q.hint && <span className="open-ended-hint">{q.hint}</span>}
                        <input
                          className="open-ended-input"
                          value={answers[`${gi}-${qi}`] ?? ""}
                          disabled={result != null}
                          onChange={e => setAnswer(gi, qi, e.target.value)}
                          placeholder={q.hint ? "..." : "Type your answer"}
                        />
                      </div>
                      {view != null && r === false && (
                        <p className="vocab-answer-key">Đáp án đúng: {String(q.sampleAnswer ?? "").split("|").map(s => s.trim()).filter(Boolean).join(" / ")}</p>
                      )}
                    </>
                  )}

                  {g.type === "true-false-table" && (
                    <>
                      <QBadge n={questionNumber(g, qi)} /><p className="vocab-question-text">{q.text}</p>
                      <div className="vocab-options vocab-options-row">
                        {[true, false].map(value => {
                          const picked = answers[`${gi}-${qi}`] === value;
                          const showState = view != null;
                          const isRight = value === q.answer;
                          return (
                            <label
                              key={String(value)}
                              className={
                                "vocab-option" +
                                (picked ? " is-picked" : "") +
                                (showState && isRight ? " is-correct" : "") +
                                (showState && picked && !isRight ? " is-wrong" : "")
                              }
                            >
                              <input
                                type="radio"
                                name={`ketpet-pt-tf-${gi}-${qi}`}
                                checked={picked}
                                disabled={result != null}
                                onChange={() => setAnswer(gi, qi, value)}
                              />
                              <span>{value ? "TRUE" : "FALSE"}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {g.type === "free-response" && (
                    <>
                      <QBadge n={questionNumber(g, qi)} /><p className="vocab-question-text">{q.prompt}</p>
                      <div className="open-ended-answer">
                        {q.hint && <span className="open-ended-hint">{q.hint}</span>}
                        <input
                          className="open-ended-input"
                          value={answers[`${gi}-${qi}`] ?? ""}
                          disabled={result != null}
                          onChange={e => setAnswer(gi, qi, e.target.value)}
                          placeholder={q.hint ? "..." : "Type your answer"}
                        />
                      </div>
                      {q.after && <p className="vocab-question-text" style={{ margin: "10px 0 0" }}>{q.after}</p>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          );
        })}
      </section>

      <div className="vocab-footer">
        {submitState ? (
          <SubmitStatus error={submitState.error} onRetry={handleSubmit} />
        ) : result == null ? (
          <button type="button" className="vocab-submit-btn" onClick={handleSubmit}>Nộp bài</button>
        ) : (
          <>
            <p className="vocab-score">Điểm: {result.correct.toFixed(2).replace(/\.00$/, "")}/{result.total.toFixed(2).replace(/\.00$/, "")}</p>
            {canRetry && <button type="button" className="vocab-submit-btn" onClick={handleRetry}>Làm lại</button>}
          </>
        )}
      </div>
    </div>
  );
}
