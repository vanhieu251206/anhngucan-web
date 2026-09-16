import { useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import { GROUP_TYPES, blankGroup, blankGroupQuestion, toRoman } from "../../lib/ketPetPracticeTest.js";
import KetPetPracticeTestQuiz from "../KetPetPracticeTestQuiz.jsx";

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

  function addGroup() {
    onGroupsChange([...groups, blankGroup("multiple-choice")]);
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

  function addQuestion(gi) {
    const g = groups[gi];
    updateGroup(gi, { questions: [...g.questions, blankGroupQuestion(g.type)] });
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
        <PageHeadSaveButton onSave={onSave} saving={saving} saved={saved} />
      </PageHead>

      {groups.map((g, gi) => (
        <div className="admin-practice-group" key={gi}>
          <div className="admin-practice-group-head">
            <span className="admin-practice-page-label">{`Nhóm ${toRoman(gi + 1)}`}</span>
            {g.type !== "open-ended" && (
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
            )}
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
            rows={2}
            value={g.passage}
            onChange={e => updateGroup(gi, { passage: e.target.value })}
            placeholder="Đoạn văn dùng chung cho cả nhóm (tuỳ chọn — cho dạng đọc hiểu/điền từ đoạn văn)"
          />

          <ol className="admin-scene-list">
            {g.questions.map((q, qi) => (
              <li className="admin-scene-list-item" key={qi}>
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
                        value={(q.acceptedAnswers ?? []).join(", ")}
                        onChange={e =>
                          updateQuestion(gi, qi, {
                            acceptedAnswers: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Đáp án đúng, cách nhau bằng dấu phẩy nếu có nhiều cách viết"
                      />
                    </>
                  )}

                  {g.type === "open-ended" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.prompt}
                        onChange={e => updateQuestion(gi, qi, { prompt: e.target.value })}
                        placeholder="1. Write a sentence using: she / not / like / spicy food"
                      />
                      <input
                        className="admin-input"
                        value={q.sampleAnswer}
                        onChange={e => updateQuestion(gi, qi, { sampleAnswer: e.target.value })}
                        placeholder="She doesn't like spicy food."
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
            ))}
          </ol>

          <button type="button" className="admin-btn-secondary" onClick={() => addQuestion(gi)}>+ Thêm câu</button>
        </div>
      ))}

      <button type="button" className="admin-btn-secondary" onClick={addGroup}>+ Thêm nhóm câu hỏi</button>

      {previewOpen && (
        <div className="admin-preview-overlay">
          <div className="admin-preview-overlay-head">
            <button type="button" className="admin-pill-btn" onClick={() => setPreviewOpen(false)}>← Đóng Preview</button>
            <strong>{unitTitle} — Practice Test {testNumber} (xem trước)</strong>
          </div>
          <div className="admin-preview-overlay-body">
            <KetPetPracticeTestQuiz groups={groups} />
          </div>
        </div>
      )}
    </div>
  );
}
