import { useState } from "react";
import { gradePracticeTestGroups, toRoman } from "../lib/ketPetPracticeTest.js";
import UnderlineText from "./UnderlineText.jsx";

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

export default function KetPetPracticeTestQuiz({ groups }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  function setAnswer(gi, qi, value) {
    setAnswers(a => ({ ...a, [`${gi}-${qi}`]: value }));
  }
  function handleSubmit() {
    setResult(gradePracticeTestGroups(groups, answers));
  }
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
          <QBadge n={qi + 1} /><p className="vocab-question-text">{q.text}</p>
          <div className="vocab-options">
            {q.options.map((opt, oi) => {
              const picked = answers[`${gi}-${qi}`] === oi;
              const showState = result != null;
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
        <QBadge n={qi + 1} /><p className="vocab-question-text">{q.text}</p>
        <input
          className={"vocab-input" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}
          value={answers[`${gi}-${qi}`] ?? ""}
          disabled={result != null}
          onChange={e => setAnswer(gi, qi, e.target.value)}
          placeholder="Nhập câu trả lời"
        />
        {result != null && r === false && (
          <p className="vocab-answer-key">Đáp án đúng: {(q.acceptedAnswers ?? []).join(" / ")}</p>
        )}
      </>
    );
  }

  if (!groups?.length) return <p className="vocab-empty">Chưa có câu hỏi nào.</p>;

  return (
    <div className="vocab-runner">
      <section className="vocab-block">
        {groups.map((g, gi) => {
          if (g.type === "split-reading") {
            return (
              <div className="vocab-group" key={gi}>
                <p className="vocab-group-instruction">{`${toRoman(gi + 1)}. ${g.instruction}`}</p>
                <div className="vocab-split-columns">
                  <div className="vocab-split-passage">
                    {g.passage && <p className="vocab-passage">{g.passage}</p>}
                  </div>
                  <div className="vocab-split-questions">
                    {g.questions.map((q, qi) => (
                      <div className="vocab-question" key={qi}>
                        {renderSplitQuestionBody(q, gi, qi, result?.results?.[gi]?.[qi])}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          return (
          <div className="vocab-group" key={gi}>
            <p className="vocab-group-instruction">{`${toRoman(gi + 1)}. ${g.instruction}`}</p>
            {g.passage && <p className="vocab-passage">{g.passage}</p>}
            {g.type === "word-bank" && (g.wordBank ?? []).length > 0 && (
              <div className="vocab-word-bank">
                {g.wordBank.map((w, wi) => (
                  <span className="vocab-word-bank-item" key={wi}>{w}</span>
                ))}
              </div>
            )}

            {g.questions.map((q, qi) => {
              const r = result?.results?.[gi]?.[qi];
              return (
                <div className="vocab-question" key={qi}>
                  {g.type === "multiple-choice" && (
                    <>
                      <QBadge n={qi + 1} /><p className="vocab-question-text">{q.text}</p>
                      <div className="vocab-options">
                        {q.options.map((opt, oi) => {
                          const picked = answers[`${gi}-${qi}`] === oi;
                          const showState = result != null;
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
                    <QBadge n={qi + 1} />
                    <div className="vocab-options vocab-options-row">
                      {q.options.map((opt, oi) => {
                        const picked = answers[`${gi}-${qi}`] === oi;
                        const showState = result != null;
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
                      <QBadge n={qi + 1} />
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
                      {result != null && r === false && (
                        <p className="vocab-answer-key">Đáp án đúng: {(q.acceptedAnswers ?? []).join(" / ")}</p>
                      )}
                    </>
                  )}

                  {g.type === "word-bank" && (
                    <>
                      <QBadge n={qi + 1} /><p className="vocab-question-text">{q.text}</p>
                      <input
                        className={"vocab-input" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}
                        value={answers[`${gi}-${qi}`] ?? ""}
                        disabled={result != null}
                        onChange={e => setAnswer(gi, qi, e.target.value)}
                        placeholder="Nhập từ trong khung từ"
                      />
                      {result != null && r === false && (
                        <p className="vocab-answer-key">Đáp án đúng: {q.answer}</p>
                      )}
                    </>
                  )}

                  {g.type === "open-ended" && (
                    <>
                      <QBadge n={qi + 1} /><p className="vocab-question-text">{q.prompt}</p>
                      <input
                        className="vocab-input"
                        value={answers[`${gi}-${qi}`] ?? ""}
                        disabled={result != null}
                        onChange={e => setAnswer(gi, qi, e.target.value)}
                        placeholder="Type your answer"
                      />
                      {result != null && <p className="vocab-answer-key">Đáp án mẫu: {q.sampleAnswer}</p>}
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
        {result == null ? (
          <button type="button" className="vocab-submit-btn" onClick={handleSubmit}>Nộp bài</button>
        ) : (
          <>
            <p className="vocab-score">Điểm: {result.correct.toFixed(2).replace(/\.00$/, "")}/{result.total.toFixed(2).replace(/\.00$/, "")}</p>
            <button type="button" className="vocab-submit-btn" onClick={handleRetry}>Làm lại</button>
          </>
        )}
      </div>
    </div>
  );
}
