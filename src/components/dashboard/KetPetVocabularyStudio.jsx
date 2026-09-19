import { useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import { GROUP_TYPES, blankGroup, blankGroupQuestion, toRoman } from "../../lib/ketPetVocabulary.js";
import KetPetVocabularyQuiz from "../KetPetVocabularyQuiz.jsx";
import CommaListInput from "./CommaListInput.jsx";
import UnderlineTextInput from "./UnderlineTextInput.jsx";
import AudioUploadField from "./AudioUploadField.jsx";

export const EMPTY_VOCAB_GROUPS = [];

// Soạn Vocabulary cho 1 Unit KET/PET — soạn theo NHÓM câu hỏi thứ tự I, II, III... (đổi từ danh sách
// câu hỏi phẳng sang nhóm, chốt người dùng 2026-09-17, cùng khung "admin-practice-group" đã dùng cho
// KetPetPracticeTestStudio.jsx): GV bấm "+ Thêm nhóm câu hỏi", CHỌN DẠNG cho cả nhóm, nhập hướng dẫn
// làm bài + đoạn văn/audio dùng chung (nếu có) + tổng điểm của nhóm, rồi bấm "+ Thêm câu" nhiều lần —
// mỗi câu thêm vào LUÔN theo đúng dạng của nhóm (đổi dạng nhóm sẽ xoá hết câu cũ vì cấu trúc field
// khác nhau). Điểm mỗi câu = tổng điểm nhóm / số câu.
export default function KetPetVocabularyStudio({
  accent, gradeTitle, unitTitle, groups, onGroupsChange, onBack, onSave, saving, saved,
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
      ? { ...blankGroup(type), instruction: g.instruction, passage: g.passage, audioUrl: g.audioUrl }
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

  // Chỉ dùng cho dạng "multiple-choice" — cho phép 2-4 đáp án (VD "Circle the correct option" chỉ có
  // 2 lựa chọn, khác kiểu trắc nghiệm 4 đáp án thường).
  function addOption(gi, qi) {
    const q = groups[gi].questions[qi];
    if (q.options.length >= 4) return;
    updateQuestion(gi, qi, { options: [...q.options, ""] });
  }
  function removeOption(gi, qi) {
    const q = groups[gi].questions[qi];
    if (q.options.length <= 2) return;
    const next = q.options.filter((_, i) => i !== q.options.length - 1);
    updateQuestion(gi, qi, {
      options: next,
      answerIndex: q.answerIndex >= next.length ? 0 : q.answerIndex,
    });
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead label={`${unitTitle} — Vocabulary`} backLabel={`← Quay lại ${gradeTitle}`} onBack={onBack}>
        <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)}>👁 Preview</button>
        <PageHeadSaveButton onSave={onSave} saving={saving} saved={saved} />
      </PageHead>

      {groups.map((g, gi) => (
        <div className="admin-practice-group" key={gi}>
          <div className="admin-practice-group-head">
            <span className="admin-practice-page-label">{`Nhóm ${toRoman(gi + 1)}`}</span>
            {g.type !== "translation" && (
              <div className="admin-practice-option-row admin-practice-group-points">
                <label htmlFor={`vocab-group-points-${gi}`} style={{ whiteSpace: "nowrap" }}>Tổng điểm cả nhóm:</label>
                <input
                  id={`vocab-group-points-${gi}`}
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
            placeholder={`Hướng dẫn làm bài của nhóm ${toRoman(gi + 1)} (VD: Choose the correct word.)`}
          />

          <AudioUploadField
            label="Audio bài nghe (tuỳ chọn — cho dạng Listening)"
            value={g.audioUrl}
            onChange={audioUrl => updateGroup(gi, { audioUrl })}
          />

          <textarea
            className="admin-input"
            rows={2}
            value={g.passage}
            onChange={e => updateGroup(gi, { passage: e.target.value })}
            placeholder="Đoạn văn dùng chung cho cả nhóm (tuỳ chọn)"
          />

          {g.type === "word-bank" && (
            <CommaListInput
              value={g.wordBank}
              onChange={wordBank => updateGroup(gi, { wordBank })}
              placeholder="Khung từ cho sẵn (word box), cách nhau bằng dấu phẩy — VD: shape, out, on, on"
            />
          )}

          {g.type === "categorize" && (
            <CommaListInput
              value={g.columns}
              onChange={columns => updateGroup(gi, { columns })}
              placeholder="Tên các cột phân loại, cách nhau bằng dấu phẩy — VD: /ə/, /ɜː/"
            />
          )}

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
                        placeholder="I really ______ playing football."
                      />
                      {q.options.map((opt, oi) => (
                        <div className="admin-practice-option-row" key={oi}>
                          <input
                            type="radio"
                            name={`vocab-mc-${gi}-${qi}`}
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
                      <div className="admin-practice-option-row">
                        <button type="button" className="admin-link-btn" onClick={() => addOption(gi, qi)} disabled={q.options.length >= 4}>+ Thêm đáp án</button>
                        <button type="button" className="admin-link-btn" onClick={() => removeOption(gi, qi)} disabled={q.options.length <= 2}>− Bớt đáp án</button>
                      </div>
                    </>
                  )}

                  {g.type === "pronunciation-underline" && (
                    <>
                      {q.options.map((opt, oi) => (
                        <div className="admin-practice-option-row" key={oi}>
                          <input
                            type="radio"
                            name={`vocab-underline-${gi}-${qi}`}
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

                  {g.type === "fill-blank" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.text}
                        onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                        placeholder="stay in ______"
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
                        placeholder="stay in ______"
                      />
                      <input
                        className="admin-input"
                        value={q.answer}
                        onChange={e => updateQuestion(gi, qi, { answer: e.target.value })}
                        placeholder="Đáp án đúng (1 từ trong khung từ, VD: on)"
                      />
                    </>
                  )}

                  {g.type === "categorize" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.text}
                        onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                        placeholder="camera"
                      />
                      <select
                        className="admin-input"
                        style={{ maxWidth: 220 }}
                        value={q.columnIndex}
                        onChange={e => updateQuestion(gi, qi, { columnIndex: Number(e.target.value) })}
                      >
                        {(g.columns ?? []).map((c, ci) => (
                          <option key={ci} value={ci}>{c || `Cột ${ci + 1}`}</option>
                        ))}
                      </select>
                    </>
                  )}

                  {g.type === "true-false-table" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.text}
                        onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                        placeholder="Mi started her hobby 3 years ago."
                      />
                      <div className="admin-practice-option-row">
                        <label className="admin-practice-option-row" style={{ gap: 4 }}>
                          <input type="radio" name={`vocab-tf-${gi}-${qi}`} checked={q.answer === true} onChange={() => updateQuestion(gi, qi, { answer: true })} /> True
                        </label>
                        <label className="admin-practice-option-row" style={{ gap: 4 }}>
                          <input type="radio" name={`vocab-tf-${gi}-${qi}`} checked={q.answer === false} onChange={() => updateQuestion(gi, qi, { answer: false })} /> False
                        </label>
                      </div>
                    </>
                  )}

                  {g.type === "reorder" && (
                    <input
                      className="admin-input"
                      value={q.text}
                      onChange={e => updateQuestion(gi, qi, { text: e.target.value })}
                      placeholder={`Câu đúng ở vị trí ${String.fromCharCode(65 + qi)} trong hội thoại (nhập câu theo ĐÚNG thứ tự, hệ thống tự xáo khi học sinh làm bài)`}
                    />
                  )}

                  {g.type === "word-scramble" && (
                    <>
                      <CommaListInput
                        value={q.words}
                        onChange={words => updateQuestion(gi, qi, { words })}
                        placeholder="Các từ xáo trộn, cách nhau bằng dấu phẩy — VD: mother, likes, My, to, classical, music, Listening"
                      />
                      <CommaListInput
                        value={q.acceptedAnswers}
                        onChange={acceptedAnswers => updateQuestion(gi, qi, { acceptedAnswers })}
                        placeholder="Câu đúng, cách nhau bằng dấu phẩy nếu có nhiều cách viết — VD: Listening to classical music is my mother's hobby."
                      />
                    </>
                  )}

                  {g.type === "translation" && (
                    <>
                      <input
                        className="admin-input"
                        value={q.prompt}
                        onChange={e => updateQuestion(gi, qi, { prompt: e.target.value })}
                        placeholder="Tôi thường đi chơi với bạn vào cuối tuần."
                      />
                      <input
                        className="admin-input"
                        value={q.sampleAnswer}
                        onChange={e => updateQuestion(gi, qi, { sampleAnswer: e.target.value })}
                        placeholder="I often hang out with my friends at weekends."
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
            <strong>{unitTitle} — Vocabulary (xem trước)</strong>
          </div>
          <div className="admin-preview-overlay-body">
            <KetPetVocabularyQuiz groups={groups} />
          </div>
        </div>
      )}
    </div>
  );
}
