import { useState } from "react";
import { gradeVocabularyQuestions } from "../lib/ketPetVocabulary.js";

// Phần tương tác thuần (không Header/chrome) của bài Vocabulary — TÁI DÙNG cho cả màn học sinh
// làm thật (KetPetVocabularyRunner.jsx, fetch từ Firestore) LẪN Preview trong CMS
// (KetPetVocabularyStudio.jsx, xem trực tiếp dữ liệu đang soạn dở chưa lưu — chốt 2026-09-14).
export default function KetPetVocabularyQuiz({ questions }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  function setAnswer(qi, value) {
    setAnswers(a => ({ ...a, [qi]: value }));
  }
  function handleSubmit() {
    setResult(gradeVocabularyQuestions(questions, answers));
  }
  function handleRetry() {
    setAnswers({});
    setResult(null);
  }

  if (!questions?.length) return <p className="vocab-empty">Chưa có câu hỏi nào.</p>;

  return (
    <div className="vocab-runner">
      <section className="vocab-block">
        {questions.map((q, qi) => {
          const r = result?.results?.[qi];
          return (
            <div className="vocab-question" key={qi}>
              {q.type === "multiple-choice" && (
                <>
                  <p className="vocab-question-text">{qi + 1}. {q.text}</p>
                  <div className="vocab-options">
                    {q.options.map((opt, oi) => {
                      const picked = answers[qi] === oi;
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
                            name={`vocab-${qi}`}
                            checked={picked}
                            disabled={result != null}
                            onChange={() => setAnswer(qi, oi)}
                          />
                          <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}

              {q.type === "fill-blank" && (
                <>
                  <p className="vocab-question-text">{qi + 1}. {q.text}</p>
                  <input
                    className={"vocab-input" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}
                    value={answers[qi] ?? ""}
                    disabled={result != null}
                    onChange={e => setAnswer(qi, e.target.value)}
                    placeholder="Nhập câu trả lời"
                  />
                  {result != null && r === false && (
                    <p className="vocab-answer-key">Đáp án đúng: {(q.acceptedAnswers ?? []).join(" / ")}</p>
                  )}
                </>
              )}

              {q.type === "translation" && (
                <>
                  <p className="vocab-question-text">{qi + 1}. {q.prompt}</p>
                  <input
                    className="vocab-input"
                    value={answers[qi] ?? ""}
                    disabled={result != null}
                    onChange={e => setAnswer(qi, e.target.value)}
                    placeholder="Type your answer"
                  />
                  {result != null && <p className="vocab-answer-key">Đáp án mẫu: {q.sampleAnswer}</p>}
                </>
              )}
            </div>
          );
        })}
      </section>

      <div className="vocab-footer">
        {result == null ? (
          <button type="button" className="vocab-submit-btn" onClick={handleSubmit}>Nộp bài</button>
        ) : (
          <>
            <p className="vocab-score">Điểm: {result.correct}/{result.total}</p>
            <button type="button" className="vocab-submit-btn" onClick={handleRetry}>Làm lại</button>
          </>
        )}
      </div>
    </div>
  );
}
