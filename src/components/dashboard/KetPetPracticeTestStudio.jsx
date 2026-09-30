import InsertRow, { insertAt } from "./InsertRow.jsx";
import { validateKetPetGroups } from "../../lib/lessonValidation.js";
import { Fragment, useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import { GROUP_TYPES, SPLIT_QUESTION_TYPES, blankGroup, blankGroupQuestion, blankSplitQuestion, toRoman } from "../../lib/ketPetPracticeTest.js";
import KetPetPracticeTestQuiz from "../KetPetPracticeTestQuiz.jsx";
import CommaListInput from "./CommaListInput.jsx";
import UnderlineTextInput from "./UnderlineTextInput.jsx";

export const EMPTY_PRACTICE_TEST_GROUPS = [];

// Soạn Practice Test (Test 1-4) cho 1 Unit KET/PET — soạn theo NHÓM câu hỏi thứ tự I, II, III...
// (chốt người dùng 2026-09-16, cùng khung "admin-practice-group" đã dùng cho LuyenDePage IELTS
// PracticeStudio.jsx): GV bấm "+ Thêm nhóm câu hỏi", CHỌN DẠNG cho cả nhóm (trắc nghiệm/điền từ/tự
// luận), nhập hướng dẫn làm bài (VD "Choose the word whose underlined part is pronounced
// differently.") + đoạn văn dùng chung (nếu có, cho dạng đọc hiểu/điền từ đoạn văn) + tổng điểm của
// nhóm, rồi bấm "+ Thêm câu" nhiều lần — mỗi câu thêm vào LUÔN theo đúng dạng của nhóm (đổi dạng
// nhóm sẽ xoá hết câu cũ vì cấu trúc field khác nhau). Điểm mỗi câu = tổng điểm nhóm / số câu.
export default function KetPetPracticeTestStudio({
  accent, gradeTitle, unitTitle, testNumber, groups, onGroupsChange, onBack, onSave, saving, saved,
}) {
  const confirm = useConfirm();
  const [previewOpen, setPreviewOpen] = useState(false);

  function addGroup(at = groups.length) {
    onGroupsChange(insertAt(groups, at, blankGroup("multiple-choice")));
  }
  function updateGroup(gi, patch) {
    onGroupsChange(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function changeGroupType(gi, type) {
    onGroupsChange(groups.map((g, i) => (i === gi
      ? { ...blankGroup(type), instruction: g.instruction, passage: g.passage }
      : g)));
  }
  async function removeGroup(gi) {
    if (!(await confirm("Xoá cả nhóm câu hỏi này (và toàn bộ câu bên trong)?", { danger: true }))) return;
    onGroupsChange(groups.filter((_, i) => i !== gi));
  }
  function moveGroup(gi, dir) {
    const gj = gi + dir;
    if (gj < 0 || gj >= groups.length) return;
    const next = [...groups];
    [next[gi], next[gj]] = [next[gj], next[gi]];
    onGroupsChange(next);
  }

  function addQuestion(gi, at = groups[gi].questions.length) {
    const g = groups[gi];
    updateGroup(gi, { questions: insertAt(g.questions, at, blankGroupQuestion(g.type)) });
  }
  function updateQuestion(gi, qi, patch) {
    const g = groups[gi];
    updateGroup(gi, { questions: g.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });
  }
  async function removeQuestion(gi, qi) {
    if (!(await confirm("Xoá câu này?", { danger: true }))) return;
    const g = groups[gi];
    updateGroup(gi, { questions: g.questions.filter((_, i) => i !== qi) });
  }
  // Chỉ dùng cho nhóm "split-reading" — đổi dạng con của 1 câu cụ thể (khác các nhóm khác đổi dạng
  // cả nhóm), giữ nguyên text nếu có để đỡ gõ lại.
  function changeQuestionSubType(gi, qi, subType) {
    const g = groups[gi];
    const q = g.questions[qi];
    updateQuestion(gi, qi, { ...blankSplitQuestion(subType), text: q.text ?? "" });
  }
  function moveQuestion(gi, qi, dir) {
    const g = groups[gi];
    const qj = qi + dir;
    if (qj < 0 || qj >= g.questions.length) return;
    const next = [...g.questions];
    [next[qi], next[qj]] = [next[qj], next[qi]];
    updateGroup(gi, { questions: next });
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead label={`${unitTitle} — Practice Test ${testNumber}`} backLabel={`← Quay lại ${gradeTitle}`} onBack={onBack}>
        <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)}>👁 Preview</button>
        <PageHeadSaveButton onSave={onSave} saving={saving} saved={saved} warnings={validateKetPetGroups(groups)} />
      </PageHead>

      {groups.map((g, gi) => (
        <Fragment key={gi}>
        {gi > 0 && <InsertRow label="＋ Chèn nhóm câu hỏi vào đây" onClick={() => addGroup(gi)} />}
        <div className="admin-practice-group">
          <div className="admin-practice-group-head">
            <span className="admin-practice-page-label">{`Nhóm ${toRoman(gi + 1)}`}</span>
            <div className="admin-practice-option-row admin-practice-group-points">
              <label htmlFor={`group-points-${gi}`} style={{ whiteSpace: "nowrap" }}>Tổng điểm cả nhóm:</label>
              <input
                id={`group-points-${gi}`}
                className="admin-input"
                type="number"
                min="0"
                step="0.5"
                style={{ maxWidth: 100 }}
                value={g.totalPoints}
                onChange={e => updateGroup(gi, { totalPoints: e.target.value === "" ? "" : Number(e.target.value) })}
              />
              <span style={{ fontSize: "0.85rem", color: "#777" }}>
                {g.questions.length > 0
                  ? `= ${((Number(g.totalPoints) || 0) / g.questions.length).toFixed(2).replace(/\.?0+$/, "")} điểm/câu`
                  : "(chưa có câu nào)"}
              </span>
            </div>
            <div className="admin-scene-list-actions">
              <button type="button" className="admin-link-btn" onClick={() => moveGroup(gi, -1)} disabled={gi === 0}>↑</button>
              <button type="button" className="admin-link-btn" onClick={() => moveGroup(gi, 1)} disabled={gi === groups.length - 1}>↓</button>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeGroup(gi)}>Xoá nhóm</button>
            </div>
          </div>

          <select
            className="admin-input admin-practice-type-select"
            value={g.type}
            onChange={e => changeGroupType(gi, e.target.value)}
          >
            {GROUP_TYPES.map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>

          <input
            className="admin-input"
            value={g.instruction}
            onChange={e => updateGroup(gi, { instruction: e.target.value })}
            placeholder={`Hướng dẫn làm bài của nhóm ${toRoman(gi + 1)} (VD: Choose the word whose underlined part is pronounced differently from the others.)`}
          />

          <textarea
            className="admin-input"
            rows={g.type === "split-reading" ? 8 : 2}
            value={g.passage}
            onChange={e => updateGroup(gi, { passage: e.target.value })}
            placeholder={g.type === "split-reading"
              ? "Đoạn văn hiện bên TRÁI màn hình chia đôi khi học sinh làm bài"
              : "Đoạn văn dùng chung cho cả nhóm (tuỳ chọn — cho dạng đọc hiểu/điền từ đoạn văn)"}
          />

          {g.type === "word-bank" && (
            <CommaListInput
              value={g.wordBank}
              onChange={wordBank => updateGroup(gi, { wordBank })}
              placeholder="Khung từ cho sẵn (word box), cách nhau bằng dấu phẩy — VD: Ant, dog, cat, Turtle"
            />
          )}

          <ol className="admin-scene-list">
            {g.questions.map((q, qi) => (
              <Fragment key={qi}>
              {qi > 0 && <InsertRow as="li" onClick={() => addQuestion(gi, qi)} />}
              <li className="admin-scene-list-item">
                <span className="admin-scene-list-index">{qi + 1}</span>

                <div className="admin-dictation-row-fields">
                  {g.type === "multiple-choice" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.text}
                        onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                        placeholder="1. A. myth   B. cycling   C. itchy   D. allergy"
                      />
                      {q.options.map((opt, oi) => (
                        <div className="admin-practice-option-row" key={oi}>
                          <input
                            type="radio"
                            name={`ketpet-pt-mc-${gi}-${qi}`}
                            checked={q.answerIndex === oi}
                            onChange={() => updateQuestion(gi, qi, { answerIndex: oi })}
                          />
                          <input
                            className="admin-input"
                            value={opt}
                            onChange={e => {
                              const next = [...q.options];
                              next[oi] = e.target.value;
                              updateQuestion(gi, qi, { options: next });
                            }}
                            placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                          />
                        </div>
                      ))}
                    </>
                  )}

                  {g.type === "pronunciation-underline" && (
                    <>
                      {q.options.map((opt, oi) => (
                        <div className="admin-practice-option-row" key={oi}>
                          <input
                            type="radio"
                            name={`ketpet-pt-underline-${gi}-${qi}`}
                            checked={q.answerIndex === oi}
                            onChange={() => updateQuestion(gi, qi, { answerIndex: oi })}
                          />
                          <UnderlineTextInput
                            value={opt}
                            onChange={next => {
                              const nextOptions = [...q.options];
                              nextOptions[oi] = next;
                              updateQuestion(gi, qi, { options: nextOptions });
                            }}
                            placeholder={`Đáp án ${String.fromCharCode(65 + oi)} — bôi đen chữ cần gạch chân rồi bấm U`}
                          />
                        </div>
                      ))}
                    </>
                  )}

                  {g.type === "split-reading" && (
                    <>
                      <select
                        className="admin-input"
                        style={{ maxWidth: 260 }}
                        value={q.type}
                        onChange={e => changeQuestionSubType(gi, qi, e.target.value)}
                      >
                        {SPLIT_QUESTION_TYPES.map(t => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>

                      {q.type === "multiple-choice" ? (
                        <>
                          <input
                            className="admin-input"
                            value={q.text}
                            onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                            placeholder="1. Eating fruits and vegetables provides you _____ nutrients."
                          />
                          {q.options.map((opt, oi) => (
                            <div className="admin-practice-option-row" key={oi}>
                              <input
                                type="radio"
                                name={`ketpet-pt-split-mc-${gi}-${qi}`}
                                checked={q.answerIndex === oi}
                                onChange={() => updateQuestion(gi, qi, { answerIndex: oi })}
                              />
                              <input
                                className="admin-input"
                                value={opt}
                                onChange={e => {
                                  const next = [...q.options];
                                  next[oi] = e.target.value;
                                  updateQuestion(gi, qi, { options: next });
                                }}
                                placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                              />
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <input
                            className="admin-input"
                            value={q.text}
                            onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                            placeholder="1. What does the writer think about breakfast?"
                          />
                          <CommaListInput
                            value={q.acceptedAnswers}
                            onChange={acceptedAnswers => updateQuestion(gi, qi, { acceptedAnswers })}
                            placeholder="Đáp án đúng, cách nhau bằng dấu phẩy nếu có nhiều cách viết"
                          />
                        </>
                      )}
                    </>
                  )}

                  {g.type === "fill-blank" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.text}
                        onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                        placeholder="1. ______ (you/ eat) fried chicken last night?"
                      />
                      <input
                        className="admin-input"
                        value={q.hint ?? ""}
                        onChange={e => updateQuestion(gi, qi, { hint: e.target.value })}
                        placeholder="Gợi ý hiện cạnh chỗ trống, tuỳ chọn (VD chia dạng từ: USE)"
                      />
                      <CommaListInput
                        value={q.acceptedAnswers}
                        onChange={acceptedAnswers => updateQuestion(gi, qi, { acceptedAnswers })}
                        placeholder="Đáp án đúng, cách nhau bằng dấu phẩy nếu có nhiều cách viết"
                      />
                    </>
                  )}

                  {g.type === "word-bank" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.text}
                        onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                        placeholder="1. I love .............. because it's friendly."
                      />
                      <input
                        className="admin-input"
                        value={q.answer}
                        onChange={e => updateQuestion(gi, qi, { answer: e.target.value })}
                        placeholder="Đáp án đúng (1 từ trong khung từ, VD: dog)"
                      />
                    </>
                  )}

                  {g.type === "open-ended" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.prompt}
                        onChange={e => updateQuestion(gi, qi, { prompt: e.target.value })}
                        placeholder="Câu hỏi — VD: 1. “I’m tired,” she said."
                      />
                      <input
                        className="admin-input"
                        value={q.hint ?? ""}
                        onChange={e => updateQuestion(gi, qi, { hint: e.target.value })}
                        placeholder="Gợi ý cho sẵn (tuỳ chọn) — VD: She said that"
                      />
                      <input
                        className="admin-input"
                        value={q.sampleAnswer}
                        onChange={e => updateQuestion(gi, qi, { sampleAnswer: e.target.value })}
                        placeholder="Đáp án — nhiều cách viết ngăn bằng | — VD: She said that she was tired."
                      />
                    </>
                  )}
                </div>

                <div className="admin-scene-list-actions">
                  <button type="button" className="admin-link-btn" onClick={() => moveQuestion(gi, qi, -1)} disabled={qi === 0}>↑</button>
                  <button type="button" className="admin-link-btn" onClick={() => moveQuestion(gi, qi, 1)} disabled={qi === g.questions.length - 1}>↓</button>
                  <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeQuestion(gi, qi)}>Xoá</button>
                </div>
              </li>
              </Fragment>
            ))}
          </ol>

          <button type="button" className="admin-btn-secondary" onClick={() => addQuestion(gi)}>+ Thêm câu</button>
        </div>
        </Fragment>
      ))}

      <button type="button" className="admin-btn-secondary" onClick={() => addGroup()}>+ Thêm nhóm câu hỏi</button>

      {previewOpen && (
        <div className="admin-preview-overlay">
          <div className="admin-preview-overlay-head">
            <button type="button" className="admin-pill-btn" onClick={() => setPreviewOpen(false)}>← Đóng Preview</button>
            <strong>{unitTitle} — Practice Test {testNumber} (xem trước)</strong>
          </div>
          <div className="admin-preview-overlay-body">
            <KetPetPracticeTestQuiz groups={groups} revealAnswers />
          </div>
        </div>
      )}
    </div>
  );
}
