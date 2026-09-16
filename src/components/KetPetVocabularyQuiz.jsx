import { useState } from "react";
import { gradeVocabularyGroups, toRoman } from "../lib/ketPetVocabulary.js";

// Phần tương tác thuần (không Header/chrome) của bài Vocabulary — TÁI DÙNG cho cả màn học sinh làm
// thật (KetPetVocabularyRunner.jsx, fetch từ Firestore) LẪN Preview trong CMS
// (KetPetVocabularyStudio.jsx, xem trực tiếp dữ liệu đang soạn dở chưa lưu). Dữ liệu là danh sách
// NHÓM câu hỏi thứ tự I, II, III... (đổi từ danh sách câu hỏi phẳng sang nhóm, chốt người dùng
// 2026-09-17, cùng cơ chế với KetPetPracticeTestQuiz.jsx) — mỗi nhóm hiện tiêu đề số La Mã + hướng
// dẫn làm bài + đoạn văn/khung từ dùng chung (nếu có), rồi tới các câu cùng dạng của nhóm đó, đánh số
// lại từ 1 trong mỗi nhóm.
export default function KetPetVocabularyQuiz({ groups }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  function setAnswer(gi, qi, value) {
    setAnswers(a => ({ ...a, [`${gi}-${qi}`]: value }));
  }
  function handleSubmit() {
    setResult(gradeVocabularyGroups(groups, answers));
  }
  function handleRetry() {
    setAnswers({});
    setResult(null);
  }

  if (!groups?.length) return <p className="vocab-empty">Chưa có câu hỏi nào.</p>;

  return (
    <div className="vocab-runner">
      <section className="vocab-block">
        {groups.map((g, gi) => (
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
                      <p className="vocab-question-text">{qi + 1}. {q.text}</p>
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
                                name={`vocab-${gi}-${qi}`}
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

                  {g.type === "fill-blank" && (
                    <>
                      <p className="vocab-question-text">{qi + 1}. {q.text}</p>
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
                      <p className="vocab-question-text">{qi + 1}. {q.text}</p>
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

                  {g.type === "translation" && (
                    <>
                      <p className="vocab-question-text">{qi + 1}. {q.prompt}</p>
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
        ))}
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
