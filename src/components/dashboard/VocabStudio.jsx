import { validateVocabItems } from "../../lib/lessonValidation.js";
import { useState } from "react";
import AudioUploadField from "./AudioUploadField.jsx";
import ImageUploadField from "./ImageUploadField.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import VocabRunner from "../VocabRunner.jsx";
import { VOCAB_TYPES, blankVocabItem, vocabTypeInfo } from "../../lib/grading/vocab.js";

// Màn soạn 1 bài Vocabulary (Starters/Movers/Flyers) — danh sách câu phẳng, mỗi câu tự chọn 1 trong 4 dạng
// (lib/grading/vocab.js). Cùng khung admin-card/admin-scene-list với DictationStudio.
export default function VocabStudio({
  accent,
  title,
  onTitleChange,
  items,
  onItemsChange,
  maxAttempts,
  onMaxAttemptsChange,
  timeLimitMinutes,
  onTimeLimitChange,
  onBack,
  onSave,
  saving,
  saved,
}) {
  const confirm = useConfirm();
  const list = items ?? [];
  const [previewOpen, setPreviewOpen] = useState(false);

  function addItem(type) {
    onItemsChange([...list, blankVocabItem(type)]);
  }
  function updateItem(i, patch) {
    onItemsChange(prev => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  async function removeItem(i) {
    if (!(await confirm("Xoá câu này?", { danger: true }))) return;
    onItemsChange(list.filter((_, idx) => idx !== i));
  }
  function moveItem(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onItemsChange(next);
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead backLabel="← Quay lại danh sách bài" onBack={onBack}>
        <input
          className="admin-input admin-dictation-title-input"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Tên bài (vd: Vocabulary 1)"
        />
        <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)} disabled={!list.length}>👁 Preview</button>
        <PageHeadSaveButton onSave={onSave} saving={saving} saved={saved} warnings={validateVocabItems(list)} />
      </PageHead>

      <ol className="admin-scene-list">
        {list.map((it, i) => (
          <li className="admin-scene-list-item admin-dictation-row" key={i}>
            <span className="admin-scene-list-index">{i + 1}</span>
            <div className="admin-dictation-row-fields">
              <label className="admin-dictation-text-label">
                Dạng câu
                <select className="admin-input" value={it.type} onChange={e => updateItem(i, { type: e.target.value })}>
                  {VOCAB_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </label>
              {it.type === "picture" && (
                <ImageUploadField label="Hình" value={it.imageUrl} onChange={url => updateItem(i, { imageUrl: url })} />
              )}
              {it.type === "listen" && (
                <AudioUploadField label="Audio" value={it.audioUrl} onChange={url => updateItem(i, { audioUrl: url })} />
              )}
              {it.type === "definition" && (
                <label className="admin-dictation-text-label">
                  Định nghĩa
                  <textarea
                    className="admin-input"
                    rows={2}
                    value={it.definition ?? ""}
                    onChange={e => updateItem(i, { definition: e.target.value })}
                    placeholder="vd: You can sit on this."
                  />
                </label>
              )}
              <label className="admin-dictation-text-label">
                {it.type === "scramble" ? "Từ đúng (hệ thống tự xáo chữ cái)" : "Đáp án"}
                <input
                  className="admin-input"
                  value={it.answer ?? ""}
                  onChange={e => updateItem(i, { answer: e.target.value })}
                  placeholder={it.type === "scramble" ? "vd: chair" : "vd: chair | chairs"}
                />
              </label>
            </div>
            <div className="admin-scene-list-actions">
              <button type="button" className="admin-link-btn" onClick={() => moveItem(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="admin-link-btn" onClick={() => moveItem(i, 1)} disabled={i === list.length - 1}>↓</button>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeItem(i)}>Xoá</button>
            </div>
          </li>
        ))}
      </ol>

      <div className="admin-dictation-bulk-bar">
        {VOCAB_TYPES.map(t => (
          <button key={t.key} type="button" className="admin-btn-secondary" onClick={() => addItem(t.key)}>
            + {vocabTypeInfo(t.key).label}
          </button>
        ))}
      </div>

      <label className="admin-dictation-maxattempts">
        Số lượt làm bài tối đa (để trống = không giới hạn)
        <input
          className="admin-input"
          type="number"
          min="1"
          value={maxAttempts ?? ""}
          onChange={e => onMaxAttemptsChange(e.target.value ? Number(e.target.value) : null)}
          placeholder="Không giới hạn"
        />
      </label>
      <label className="studio-max-attempts" title="Hết giờ hệ thống tự nộp bài — để trống nghĩa là không giới hạn.">
        <span>Thời gian (phút)</span>
        <input
          type="number"
          min={1}
          className="admin-input"
          value={timeLimitMinutes ?? ""}
          onChange={e => onTimeLimitChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="Không giới hạn"
        />
      </label>
      {previewOpen && (
        <div className="reading-fullscreen">
          <div className="speaking-fullscreen-topbar">
            <button className="speaking-fullscreen-back" onClick={() => setPreviewOpen(false)}>← Đóng Preview</button>
            <span className="speaking-fullscreen-title">{title} (xem trước)</span>
          </div>
          <div className="speaking-fullscreen-body reading-fullscreen-body">
            <VocabRunner items={list} onFinish={() => setPreviewOpen(false)} preview />
          </div>
        </div>
      )}
    </div>
  );
}
