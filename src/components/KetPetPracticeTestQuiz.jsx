import { Fragment, useState } from "react";
import ExamTimer, { useExamTimer } from "./ExamTimer.jsx";
import { blankCount, gradePracticeTestGroups, isChoiceAnswer, questionNumber, toRoman } from "../lib/ketPetPracticeTest.js";
import { optimizeImage } from "../lib/cloudinaryImage.js";
import UnderlineText from "./UnderlineText.jsx";
import SubmitStatus from "./SubmitStatus.jsx";
import { SubmitConfirmDialog } from "./ReadingRunner.jsx";

// Phần tương tác thuần (không Header/chrome) của 1 Test Practice Test KET/PET — TÁI DÙNG cho cả màn
// học sinh làm thật (KetPetPracticeTestRunner.jsx, fetch từ Firestore) LẪN Preview trong CMS
// (KetPetPracticeTestStudio.jsx, xem trực tiếp dữ liệu đang soạn dở chưa lưu). Dữ liệu là danh sách
// NHÓM câu hỏi thứ tự I, II, III... (chốt người dùng 2026-09-16) — mỗi nhóm hiện tiêu đề số La Mã +
// hướng dẫn làm bài + đoạn văn dùng chung (nếu có), rồi tới các câu cùng dạng của nhóm đó, đánh số lại
// từ 1 trong mỗi nhóm (giống đề thi thật, xem BỔ SUNG.pdf).
// Nhãn "Question N" dùng lại đúng style của Reading (reading-question-badge/num trong index.css).
// `image`: ảnh riêng của câu (biển báo, tranh...) — hiện ngay dưới nhãn, trên nội dung câu.
function QBadge({ n, image }) {
  return (
    <>
      <div className="reading-question-badge">
        <span className="reading-question-num">Question {n}</span>
      </div>
      {image && <img className="ketpet-question-image" src={optimizeImage(image)} alt="" />}
    </>
  );
}

const GAP = /_{2,}|\.{4,}|…{2,}/;

// Câu điền NHIỀU ô trống (q.blanks / q.blankCount): số chỗ gạch dưới trong câu khớp số ô thì đặt ô ngay trong câu,
// không khớp thì hiện câu rồi xếp các ô bên dưới. Câu trả lời là mảng chuỗi theo thứ tự ô.
function MultiBlank({ q, value, disabled, state, onChange }) {
  const n = blankCount(q);
  const cells = Array.from({ length: n }, (_, i) => (Array.isArray(value) ? value[i] ?? "" : ""));
  const parts = String(q.text ?? "").split(GAP);
  const inline = parts.length === n + 1;
  const stateClass = (state === true ? " is-correct" : "") + (state === false ? " is-wrong" : "");
  const input = i => (
    <input
      key={`blank-${i}`}
      className={"vocab-input vocab-input-inline" + stateClass}
      value={cells[i]}
      disabled={disabled}
      aria-label={`Ô trống ${i + 1}`}
      onChange={e => onChange(cells.map((c, k) => (k === i ? e.target.value : c)))}
    />
  );
  const hint = q.hint && <span className="vocab-question-hint"> ({q.hint})</span>;
  if (inline) {
    return (
      <p className="vocab-question-text vocab-question-inline">
        {parts.map((part, i) => <Fragment key={i}>{part}{i < n && input(i)}</Fragment>)}
        {hint}
      </p>
    );
  }
  return (
    <>
      <p className="vocab-question-text">{q.text}{hint}</p>
      <div className="vocab-blank-row">{cells.map((_, i) => input(i))}</div>
    </>
  );
}

const blanksKeyText = q => (q.blanks ?? []).map(b => String(b ?? "").split("|").map(s => s.trim()).filter(Boolean).join(" / ")).join(" ; ");

// Nhãn ngắn của nhóm ("Exercise 1" / số La Mã với đề cũ chưa có `label`) — null với nhóm nối tiếp không có đầu mục.
function groupLabel(g, gi) {
  if (g.label == null) return toRoman(gi + 1);
  return String(g.label).trim() || null;
}

// Đầu mục của 1 nhóm — cùng khung với đầu Part của Reading (reading-part-head): tên mục + dòng hướng dẫn in nghiêng,
// mục con (nếu có) ngay dưới.
function GroupHead({ g, gi }) {
  const label = groupLabel(g, gi);
  const instruction = String(g.instruction ?? "").trim();
  const title = g.label == null ? [label, instruction].filter(Boolean).join(". ") : label || instruction;
  return (
    <>
      {title && (
        <div className="reading-part-head">
          <h2>{title}</h2>
          {g.label != null && label && instruction && <p className="reading-part-instruction">{instruction}</p>}
        </div>
      )}
      {g.subtitle && <p className="vocab-group-subtitle">{g.subtitle}</p>}
    </>
  );
}

function isAnswered(value) {
  if (Array.isArray(value)) return value.some(isAnswered);
  return value != null && String(value).trim() !== "";
}

// Cột trái "Danh sách câu hỏi" (cùng kiểu Reading) — chia theo từng nhóm vì số câu đánh lại theo sách trong mỗi nhóm.
// Màn hẹp (điện thoại): cột này ẩn, bấm nút nổi "☰ x/y câu" ở góc dưới để trượt ra từ bên trái; chọn câu thì tự đóng.
function QuestionListSidebar({ groups, answers }) {
  const [open, setOpen] = useState(false);
  function goTo(gi, qi) {
    setOpen(false);
    document.getElementById(`kq-${gi}-${qi}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const keys = groups.flatMap((g, gi) => g.questions.map((_, qi) => `${gi}-${qi}`));
  const answeredCount = keys.filter(k => isAnswered(answers[k])).length;
  const pct = keys.length ? Math.round((answeredCount / keys.length) * 100) : 0;
  // Mỗi nhóm 1 lưới số riêng; nhóm không có đầu mục/mục con mà số câu NỐI TIẾP nhóm trước (cùng 1 bài bị tách làm
  // nhiều nhóm) thì gộp chung lưới với nhóm trước.
  const blocks = [];
  groups.forEach((g, gi) => {
    if (!g.questions.length) return;
    const items = g.questions.map((_, qi) => ({ gi, qi, n: questionNumber(g, qi) }));
    const label = groupLabel(g, gi);
    const prev = blocks[blocks.length - 1];
    if (prev && !label && !g.subtitle && items[0].n === prev.items[prev.items.length - 1].n + 1) prev.items.push(...items);
    else blocks.push({ label, subtitle: g.subtitle, items });
  });
  return (
    <>
    <button type="button" className="ketpet-sidebar-toggle" aria-expanded={open} onClick={() => setOpen(true)}>
      <span aria-hidden="true">☰</span> {answeredCount}/{keys.length} câu
    </button>
    {open && <div className="ketpet-sidebar-backdrop" role="presentation" onClick={() => setOpen(false)} />}
    <div className={`reading-sidebar${open ? " is-open" : ""}`}>
      <button type="button" className="ketpet-sidebar-close" aria-label="Đóng danh sách câu hỏi" onClick={() => setOpen(false)}>✕</button>
      <h3 className="reading-sidebar-title">Danh sách câu hỏi</h3>
      <div className="reading-sidebar-progress">
        <div className="reading-sidebar-progress-bar">
          <div className="reading-sidebar-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span>{answeredCount}/{keys.length} câu</span>
      </div>
      {blocks.map((b, bi) => (
        <Fragment key={bi}>
          {b.label && <p className="reading-sidebar-group-label">{b.label}</p>}
          {b.subtitle && <p className="reading-sidebar-group-sub">{b.subtitle}</p>}
          <div className="reading-sidebar-grid">
            {b.items.map(({ gi, qi, n }) => (
              <button
                key={`${gi}-${qi}`}
                type="button"
                className={`reading-sidebar-dot${isAnswered(answers[`${gi}-${qi}`]) ? " is-answered" : ""}`}
                onClick={() => goTo(gi, qi)}
              >
                {n}
              </button>
            ))}
          </div>
        </Fragment>
      ))}
      <p className="reading-sidebar-hint">● Đã làm</p>
    </div>
    </>
  );
}

// revealAnswers=true CHỈ dùng cho Preview trong CMS (giáo viên xem đáp án). Học sinh luôn chỉ thấy số câu đúng/tổng.
// page=true: màn học sinh làm bài toàn màn hình (KetPetPracticeTestRunner.jsx) — thêm cột "Danh sách câu hỏi" ghim
// bên trái + hỏi lại trước khi nộp, giống ReadingRunner.jsx. Preview trong CMS không có 2 phần này.
export default function KetPetPracticeTestQuiz({ groups, revealAnswers = false, limitMinutes, canRetry = true, onSubmitted, page = false }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const view = revealAnswers ? result : null;

  function setAnswer(gi, qi, value) {
    setAnswers(a => ({ ...a, [`${gi}-${qi}`]: value }));
  }
  // Học sinh: onSubmitted trả về Promise điểm do MÁY CHỦ chấm (đề học sinh không có đáp án — lib/testSubmit.js);
  // chờ điểm đó rồi mới hiện. Preview CMS / admin / giáo viên (có đáp án) chấm tại chỗ như trước.
  const [submitState, setSubmitState] = useState(null); // { error? } khi đang nộp/lỗi
  async function handleSubmit() {
    setConfirmingSubmit(false);
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
      // error.retry: còn sai quá số câu cho phép → quay lại sửa câu sai (lib/retryRound.js), bài làm giữ nguyên.
      setSubmitState(error?.retry ? null : { error });
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
          <QBadge n={questionNumber(groups[gi], qi)} image={q.image} /><p className="vocab-question-text">{q.text}</p>
          <div className="vocab-options">
            {q.options.map((opt, oi) => {
              const picked = answers[`${gi}-${qi}`] === oi;
              const showState = view != null;
              const isRight = isChoiceAnswer(q, oi);
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
        <QBadge n={questionNumber(groups[gi], qi)} image={q.image} />
        {renderFill(q, gi, qi, r)}
      </>
    );
  }

  // Câu điền từ — 1 ô như thường, hoặc mỗi chỗ trống 1 ô khi câu có nhiều ô trống (MultiBlank).
  function renderFill(q, gi, qi, r) {
    if (blankCount(q) > 0) {
      return (
        <>
          <MultiBlank q={q} value={answers[`${gi}-${qi}`]} disabled={result != null} state={r} onChange={v => setAnswer(gi, qi, v)} />
          {view != null && r === false && <p className="vocab-answer-key">Đáp án đúng: {blanksKeyText(q)}</p>}
        </>
      );
    }
    return (
      <>
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
    );
  }

  if (!groups?.length) return <p className="vocab-empty">Chưa có câu hỏi nào.</p>;

  return (
    <div className={page ? "reading-runner reading-runner-page ketpet-test" : "vocab-runner ketpet-test"}>
      {onSubmitted && <ExamTimer timer={timer} />}
      {page && <QuestionListSidebar groups={groups} answers={answers} />}
      <div className={page ? "reading-runner-main" : "ketpet-test-main"}>
        {groups.map((g, gi) => {
          if (g.type === "split-reading") {
            return (
              <Fragment key={gi}>
              {g.section && <h3 className="ketpet-section-title">{g.section}</h3>}
              <div className="reading-part">
                <GroupHead g={g} gi={gi} />
                {g.task && <p className="vocab-group-subtitle">{g.task}</p>}
                <div className="vocab-split-columns">
                  <div className="vocab-split-passage">
                    {g.passage && <p className="vocab-passage">{g.passage}</p>}
                    {g.image && <img className="ketpet-group-image" src={optimizeImage(g.image)} alt="" />}
                  </div>
                  <div className="vocab-split-questions">
                    {g.questions.map((q, qi) => (
                      <div className="reading-question" id={`kq-${gi}-${qi}`} key={qi}>
                        {renderSplitQuestionBody(q, gi, qi, view?.results?.[gi]?.[qi])}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </Fragment>
            );
          }
          return (
          <Fragment key={gi}>
          {g.section && <h3 className="ketpet-section-title">{g.section}</h3>}
          <div className="reading-part">
            <GroupHead g={g} gi={gi} />
            {g.passage && <p className="vocab-passage">{g.passage}</p>}
            {g.image && <img className="ketpet-group-image" src={optimizeImage(g.image)} alt="" />}
            {g.task &&<p className="vocab-group-subtitle">{g.task}</p>}
            {g.type === "word-bank" && (g.wordBank ?? []).length > 0 && (
              <div className="vocab-word-bank">
                {g.wordBank.map((w, wi) => (
                  <span className="vocab-word-bank-item" key={wi}>{w}</span>
                ))}
              </div>
            )}

            <div className="reading-question-list">
            {g.questions.map((q, qi) => {
              const r = view?.results?.[gi]?.[qi];
              return (
                <div className="reading-question" id={`kq-${gi}-${qi}`} key={qi}>
                  {g.type === "multiple-choice" && (
                    <>
                      <QBadge n={questionNumber(g, qi)} image={q.image} /><p className="vocab-question-text">{q.text}</p>
                      <div className="vocab-options">
                        {q.options.map((opt, oi) => {
                          const picked = answers[`${gi}-${qi}`] === oi;
                          const showState = view != null;
                          const isRight = isChoiceAnswer(q, oi);
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
                    <QBadge n={questionNumber(g, qi)} image={q.image} />
                    <div className="vocab-options vocab-options-row">
                      {q.options.map((opt, oi) => {
                        const picked = answers[`${gi}-${qi}`] === oi;
                        const showState = view != null;
                        const isRight = isChoiceAnswer(q, oi);
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
                      <QBadge n={questionNumber(g, qi)} image={q.image} />
                      {renderFill(q, gi, qi, r)}
                    </>
                  )}

                  {g.type === "word-bank" && (
                    <>
                      <QBadge n={questionNumber(g, qi)} image={q.image} /><p className="vocab-question-text">{q.text}</p>
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
                      <QBadge n={questionNumber(g, qi)} image={q.image} /><p className="vocab-question-text">{q.prompt}</p>
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
                      <QBadge n={questionNumber(g, qi)} image={q.image} /><p className="vocab-question-text">{q.text}</p>
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
                      <QBadge n={questionNumber(g, qi)} image={q.image} /><p className="vocab-question-text">{q.prompt}</p>
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
          </div>
          </Fragment>
          );
        })}

        <div className="vocab-footer">
          {submitState ? (
            <SubmitStatus error={submitState.error} onRetry={handleSubmit} />
          ) : result == null ? (
            <button type="button" className="btn btn-primary" onClick={page ? () => setConfirmingSubmit(true) : handleSubmit}>Nộp bài</button>
          ) : (
            <>
              <p className="vocab-score">Điểm: {result.correct.toFixed(2).replace(/\.00$/, "")}/{result.total.toFixed(2).replace(/\.00$/, "")}</p>
              {canRetry && <button type="button" className="btn btn-primary" onClick={handleRetry}>Làm lại</button>}
            </>
          )}
        </div>
      </div>

      {confirmingSubmit && (
        <SubmitConfirmDialog
          unansweredCount={groups.reduce((n, g, gi) => n + g.questions.filter((_, qi) => !isAnswered(answers[`${gi}-${qi}`])).length, 0)}
          onCancel={() => setConfirmingSubmit(false)}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  );
}
