import InsertRow, { insertAt, moveAt } from "./InsertRow.jsx";
import { validateIeltsListening } from "../../lib/lessonValidation.js";
import { Fragment, useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import IeltsListeningRunner from "../IeltsListeningRunner.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";

// Màn soạn 1 Test IELTS Listening (Test 1-4 → Section 1-4, xem CreateLessonPage.jsx
// `IeltsListeningEditor`) — mỗi section có audio (Cloudinary, KHÔNG phải audio gốc đề thi có
// bản quyền) + ghi chú đầu bài + nhóm câu hỏi. TÁI DÙNG đúng schema group của PracticeStudio.jsx
// (Reading): instruction + type "multiple-choice"|"tfng"|"short-answer" + questions — riêng
// Listening chủ yếu dùng "short-answer" (điền từ vào notes/form/table) nên vẫn giữ đủ 3 dạng để
// linh hoạt (chốt 2026-09-11).
const GROUP_TYPES = [
  { key: "short-answer", label: "Điền từ (notes, form, bảng...)" },
  { key: "multiple-choice", label: "Trắc nghiệm (A/B/C/D)" },
  { key: "tfng", label: "True / False / Not Given" },
];

function blankQuestion(type) {
  if (type === "multiple-choice") return { text: "", options: ["", "", "", ""], answerIndex: 0 };
  if (type === "tfng") return { text: "", answer: "TRUE" };
  return { label: "", acceptedAnswers: "" };
}

function SectionEditor({ section, onChange, onRemove }) {
  const confirm = useConfirm();

  // Gửi PATCH (không phải cả section) — cha ghép vào dữ liệu mới nhất, để upload audio xong muộn không ghi đè thay đổi khác.
  function update(patch) {
    onChange(patch);
  }

  function addGroup(at = (section.groups ?? []).length) {
    update({ groups: insertAt(section.groups, at, { instruction: "", type: "short-answer", questions: [blankQuestion("short-answer")] }) });
  }
  function updateGroup(gi, patch) {
    const groups = section.groups.map((g, idx) => (idx === gi ? { ...g, ...patch } : g));
    update({ groups });
  }
  function changeGroupType(gi, type) {
    updateGroup(gi, { type, questions: [blankQuestion(type)] });
  }
  async function removeGroup(gi) {
    if (!(await confirm("Xoá nhóm câu hỏi này?", { danger: true }))) return;
    update({ groups: section.groups.filter((_, idx) => idx !== gi) });
  }
  function addQuestion(gi, at = section.groups[gi].questions.length) {
    const g = section.groups[gi];
    updateGroup(gi, { questions: insertAt(g.questions, at, blankQuestion(g.type)) });
  }
  function updateQuestion(gi, qi, patch) {
    const g = section.groups[gi];
    const questions = g.questions.map((q, idx) => (idx === qi ? { ...q, ...patch } : q));
    updateGroup(gi, { questions });
  }
  async function removeQuestion(gi, qi) {
    if (!(await confirm("Xoá câu hỏi này?", { danger: true }))) return;
    const g = section.groups[gi];
    updateGroup(gi, { questions: g.questions.filter((_, idx) => idx !== qi) });
  }

  return (
    <div className="admin-practice-passage">
      <div className="admin-dictation-head">
        <span className="admin-upload-label">Section</span>
        <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={onRemove}>Xoá section</button>
      </div>
      <label className="admin-dictation-text-label">
        Tiêu đề section
        <input className="admin-input" value={section.title} onChange={e => update({ title: e.target.value })} placeholder="vd: ECO-FARM" />
      </label>
      <label className="admin-dictation-text-label">
        Ghi chú đầu bài (không bắt buộc)
        <input className="admin-input" value={section.note ?? ""} onChange={e => update({ note: e.target.value })} placeholder="vd: Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer." />
      </label>
      <AudioUploadField
        label="Audio (giọng tự thu/tạo, KHÔNG dùng audio gốc đề thi có bản quyền)"
        value={section.audioUrl ?? ""}
        onChange={url => update({ audioUrl: url })}
      />

      <span className="admin-upload-label admin-practice-groups-label">Nhóm câu hỏi</span>
      {(section.groups ?? []).map((g, gi) => (
        <Fragment key={gi}>
        {gi > 0 && <InsertRow label="＋ Chèn nhóm câu hỏi vào đây" onClick={() => addGroup(gi)} />}
        <div className="admin-practice-group">
          <div className="admin-practice-group-head">
            <select className="admin-input admin-practice-type-select" value={g.type} onChange={e => changeGroupType(gi, e.target.value)}>
              {GROUP_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button type="button" className="admin-link-btn" onClick={() => update({ groups: moveAt(section.groups, gi, -1) })} disabled={gi === 0} title="Dời nhóm lên">↑</button>
            <button type="button" className="admin-link-btn" onClick={() => update({ groups: moveAt(section.groups, gi, 1) })} disabled={gi === section.groups.length - 1} title="Dời nhóm xuống">↓</button>
            <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeGroup(gi)}>Xoá nhóm</button>
          </div>
          <textarea
            className="admin-input admin-textarea"
            rows={2}
            value={g.instruction}
            onChange={e => updateGroup(gi, { instruction: e.target.value })}
            placeholder="Hướng dẫn chung của nhóm câu hỏi"
          />
          {g.questions.map((q, qi) => (
            <Fragment key={qi}>
            {qi > 0 && <InsertRow onClick={() => addQuestion(gi, qi)} />}
            <div className="admin-practice-question-row">
              <span className="admin-scene-list-index">{qi + 1}</span>
              <div className="admin-dictation-row-fields">
                {g.type === "multiple-choice" && (
                  <>
                    <input className="admin-input" value={q.text} onChange={e => updateQuestion(gi, qi, { text: e.target.value })} placeholder="Nội dung câu hỏi" />
                    {q.options.map((opt, oi) => (
                      <div className="admin-practice-option-row" key={oi}>
                        <input type="radio" name={`mc-${gi}-${qi}`} checked={q.answerIndex === oi} onChange={() => updateQuestion(gi, qi, { answerIndex: oi })} />
                        <input
                          className="admin-input"
                          value={opt}
                          onChange={e => {
                            const options = q.options.map((o, idx) => (idx === oi ? e.target.value : o));
                            updateQuestion(gi, qi, { options });
                          }}
                          placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                        />
                      </div>
                    ))}
                  </>
                )}
                {g.type === "tfng" && (
                  <>
                    <input className="admin-input" value={q.text} onChange={e => updateQuestion(gi, qi, { text: e.target.value })} placeholder="Nội dung câu khẳng định (statement)" />
                    <select className="admin-input" value={q.answer} onChange={e => updateQuestion(gi, qi, { answer: e.target.value })}>
                      <option value="TRUE">TRUE</option>
                      <option value="FALSE">FALSE</option>
                      <option value="NOT GIVEN">NOT GIVEN</option>
                    </select>
                  </>
                )}
                {g.type === "short-answer" && (
                  <>
                    <input className="admin-input" value={q.label} onChange={e => updateQuestion(gi, qi, { label: e.target.value })} placeholder="Mô tả vị trí ô trống (vd: Name: Helen (1)___)" />
                    <input
                      className="admin-input"
                      value={q.acceptedAnswers}
                      onChange={e => updateQuestion(gi, qi, { acceptedAnswers: e.target.value })}
                      placeholder="Đáp án đúng — nhiều đáp án cách nhau bằng | (vd: Sheffield)"
                    />
                  </>
                )}
              </div>
              <button type="button" className="admin-link-btn" onClick={() => updateGroup(gi, { questions: moveAt(g.questions, qi, -1) })} disabled={qi === 0} title="Dời câu lên">↑</button>
              <button type="button" className="admin-link-btn" onClick={() => updateGroup(gi, { questions: moveAt(g.questions, qi, 1) })} disabled={qi === g.questions.length - 1} title="Dời câu xuống">↓</button>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeQuestion(gi, qi)}>Xoá</button>
            </div>
            </Fragment>
          ))}
          <button type="button" className="admin-btn-secondary" onClick={() => addQuestion(gi)}>+ Thêm câu hỏi</button>
        </div>
        </Fragment>
      ))}
      <button type="button" className="admin-btn-secondary" onClick={() => addGroup()}>+ Thêm nhóm câu hỏi</button>
    </div>
  );
}

export default function ListeningTestStudio({
  accent,
  title,
  onTitleChange,
  sections,
  onSectionsChange,
  onBack,
  onSave,
  saving,
  saved,
}) {
  const confirm = useConfirm();
  const [previewOpen, setPreviewOpen] = useState(false);

  function addSection() {
    onSectionsChange([...(sections ?? []), { title: "", note: "", audioUrl: "", groups: [] }]);
  }
  function updateSection(i, patch) {
    onSectionsChange(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  async function removeSection(i) {
    if (!(await confirm("Xoá section này? Toàn bộ câu hỏi trong đó cũng bị xoá.", { danger: true }))) return;
    onSectionsChange(sections.filter((_, idx) => idx !== i));
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead backLabel="← Quay lại danh sách Test" onBack={onBack}>
        <input
          className="admin-input admin-dictation-title-input"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Tên Test (vd: IELTS 8 - Listening Test 1)"
        />
        <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)} disabled={!sections?.length}>👁 Preview</button>
        <PageHeadSaveButton onSave={onSave} saving={saving} saved={saved} warnings={validateIeltsListening(sections)} />
      </PageHead>

      {(sections ?? []).map((s, i) => (
        <SectionEditor key={i} section={s} onChange={patch => updateSection(i, patch)} onRemove={() => removeSection(i)} />
      ))}
      <button type="button" className="admin-btn-secondary" onClick={addSection}>+ Thêm section</button>

      {previewOpen && (
        <IeltsListeningRunner
          test={{ id: "preview", title: `${title || "Listening"} (xem trước)`, timeLimitMinutes: null, sections }}
          onBack={() => setPreviewOpen(false)}
          preview
        />
      )}
    </div>
  );
}
