import { useMemo, useState } from "react";
import { gradeVocabularyGroups, toRoman, seededShuffle } from "../lib/ketPetVocabulary.js";
import UnderlineText from "./UnderlineText.jsx";

// Phần tương tác thuần (không Header/chrome) của bài Vocabulary — TÁI DÙNG cho cả màn học sinh làm
// thật (KetPetVocabularyRunner.jsx, fetch từ Firestore) LẪN Preview trong CMS
// (KetPetVocabularyStudio.jsx, xem trực tiếp dữ liệu đang soạn dở chưa lưu). Dữ liệu là danh sách
// NHÓM câu hỏi thứ tự I, II, III... (đổi từ danh sách câu hỏi phẳng sang nhóm, chốt người dùng
// 2026-09-17, cùng cơ chế với KetPetPracticeTestQuiz.jsx) — mỗi nhóm hiện tiêu đề số La Mã + hướng
// dẫn làm bài + đoạn văn/audio/khung từ dùng chung (nếu có), rồi tới các câu cùng dạng của nhóm đó,
// đánh số lại từ 1 trong mỗi nhóm.
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
            {g.audioUrl && <audio className="vocab-audio" src={g.audioUrl} controls />}
            {g.passage && <p className="vocab-passage">{g.passage}</p>}
            {g.type === "word-bank" && (g.wordBank ?? []).length > 0 && (
              <div className="vocab-word-bank">
                {g.wordBank.map((w, wi) => (
                  <span className="vocab-word-bank-item" key={wi}>{w}</span>
                ))}
              </div>
            )}

            {g.type === "categorize" ? (
              <CategorizeGroup g={g} gi={gi} answers={answers} result={result} setAnswer={setAnswer} />
            ) : g.type === "true-false-table" ? (
              <TrueFalseTableGroup g={g} gi={gi} answers={answers} result={result} setAnswer={setAnswer} />
            ) : g.type === "reorder" ? (
              <ReorderGroup g={g} gi={gi} answers={answers} result={result} setAnswer={setAnswer} />
            ) : (
              g.questions.map((q, qi) => {
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

                    {g.type === "pronunciation-underline" && (
                      <div className="vocab-options vocab-options-row">
                        <span className="vocab-options-row-index">{qi + 1}.</span>
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
                                name={`vocab-underline-${gi}-${qi}`}
                                checked={picked}
                                disabled={result != null}
                                onChange={() => setAnswer(gi, qi, oi)}
                              />
                              <span>{String.fromCharCode(65 + oi)}. <UnderlineText text={opt} /></span>
                            </label>
                          );
                        })}
                      </div>
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

                    {g.type === "word-scramble" && (
                      <>
                        <div className="vocab-scramble-words">
                          {(q.words ?? []).map((w, wi) => (
                            <span className="vocab-scramble-chip" key={wi}>{w}</span>
                          ))}
                        </div>
                        <input
                          className={"vocab-input" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}
                          value={answers[`${gi}-${qi}`] ?? ""}
                          disabled={result != null}
                          onChange={e => setAnswer(gi, qi, e.target.value)}
                          placeholder="Sắp xếp thành câu hoàn chỉnh"
                        />
                        {result != null && r === false && (
                          <p className="vocab-answer-key">Đáp án đúng: {(q.acceptedAnswers ?? []).join(" / ")}</p>
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
              })
            )}
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

// Dạng "Phân loại từ vào cột" — mỗi từ có 1 dropdown chọn cột đúng (thay cho kéo-thả thật, đơn giản
// hoá nhưng vẫn giữ đúng tinh thần bài — đặt từ vào đúng cột theo tiêu chí, VD phát âm /ə/ hay /ɜː/).
function CategorizeGroup({ g, gi, answers, result, setAnswer }) {
  const columns = g.columns ?? [];
  return (
    <div className="vocab-categorize">
      {g.questions.map((q, qi) => {
        const r = result?.results?.[gi]?.[qi];
        const picked = answers[`${gi}-${qi}`];
        return (
          <div className={"vocab-categorize-row" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")} key={qi}>
            <span className="vocab-categorize-word">{q.text}</span>
            <select
              className="admin-input"
              value={picked ?? ""}
              disabled={result != null}
              onChange={e => setAnswer(gi, qi, Number(e.target.value))}
            >
              <option value="" disabled>— Chọn cột —</option>
              {columns.map((c, ci) => (
                <option key={ci} value={ci}>{c || `Cột ${ci + 1}`}</option>
              ))}
            </select>
            {result != null && r === false && (
              <span className="vocab-answer-key">Đúng: {columns[q.columnIndex] || `Cột ${q.columnIndex + 1}`}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Dạng "Bảng đúng/sai" — render bảng thật giống sách in (No. | Statements | T | F).
function TrueFalseTableGroup({ g, gi, answers, result, setAnswer }) {
  return (
    <table className="vocab-tf-table">
      <thead>
        <tr><th>No.</th><th>Statements</th><th>T</th><th>F</th></tr>
      </thead>
      <tbody>
        {g.questions.map((q, qi) => {
          const r = result?.results?.[gi]?.[qi];
          const picked = answers[`${gi}-${qi}`];
          return (
            <tr key={qi} className={r === true ? "is-correct" : r === false ? "is-wrong" : ""}>
              <td>{qi + 1}</td>
              <td>{q.text}</td>
              <td>
                <input type="radio" name={`vocab-tf-${gi}-${qi}`} checked={picked === true} disabled={result != null} onChange={() => setAnswer(gi, qi, true)} />
              </td>
              <td>
                <input type="radio" name={`vocab-tf-${gi}-${qi}`} checked={picked === false} disabled={result != null} onChange={() => setAnswer(gi, qi, false)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Dạng "Sắp xếp câu hội thoại" — thứ tự ĐÚNG là thứ tự GV nhập (g.questions), học sinh thấy danh
// sách bị XÁO TRỘN ỔN ĐỊNH (seededShuffle, không đổi lại mỗi lần render) và phải gán số thứ tự đúng
// cho từng câu qua dropdown 1..N.
function ReorderGroup({ g, gi, answers, result, setAnswer }) {
  const count = g.questions.length;
  const shuffled = useMemo(() => seededShuffle(g.questions, gi + 7), [g.questions, gi]);
  return (
    <div className="vocab-reorder">
      {shuffled.map(({ item: q, i: qi }) => {
        const r = result?.results?.[gi]?.[qi];
        const picked = answers[`${gi}-${qi}`];
        return (
          <div className={"vocab-reorder-row" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")} key={qi}>
            <select
              className="admin-input vocab-reorder-select"
              value={picked ?? ""}
              disabled={result != null}
              onChange={e => setAnswer(gi, qi, Number(e.target.value))}
            >
              <option value="" disabled>#</option>
              {Array.from({ length: count }, (_, n) => n + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>{q.text}</span>
            {result != null && r === false && <span className="vocab-answer-key">Đúng: {qi + 1}</span>}
          </div>
        );
      })}
    </div>
  );
}
