import InsertRow, { insertAt } from "./InsertRow.jsx";
import { validateDictation } from "../../lib/lessonValidation.js";
import { Fragment, useRef, useState } from "react";
import AudioUploadField from "./AudioUploadField.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";
import { uploadToCloudinary } from "../../lib/cloudinaryUpload.js";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import DictationRunner from "../DictationRunner.jsx";

// Sắp xếp file theo số đứng đầu/trong tên (1, 2, ..., 10, 11 — không phải thứ tự chữ cái
// "1, 10, 11, 2..." của sort chuỗi thường) — giáo viên chỉ cần đặt tên file 1/2/3.../N, không cần
// đúng định dạng cầu kỳ. File không có số nào thì rơi xuống cuối, xếp theo tên.
function sortFilesNatural(files) {
  return [...files].sort((a, b) => {
    const na = parseInt(a.name.match(/\d+/)?.[0] ?? "", 10);
    const nb = parseInt(b.name.match(/\d+/)?.[0] ?? "", 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    if (!isNaN(na) !== !isNaN(nb)) return isNaN(na) ? 1 : -1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

// Màn soạn 1 Test Dictation — danh sách câu, mỗi câu gồm audio (upload/dán URL qua Cloudinary,
// KHÔNG phải audio gốc sách có bản quyền — giáo viên tự thu hoặc dùng TTS ngoài rồi tải lên) +
// đúng văn bản học sinh phải gõ lại. Cùng khung admin-card/admin-scene-list với TestStudio/ReadingStudio.
// Ngoài soạn từng câu tay, còn cho phép soạn HÀNG LOẠT (yêu cầu người dùng 2026-09-08, tránh phải
// bấm "Chọn file" + gõ chữ lặp lại từng câu một): chọn NHIỀU file audio cùng lúc, tự xếp theo số thứ
// tự trong tên file (đặt tên 1/2/3...N là đủ), khớp vào đúng vị trí câu 1/2/3...; hoặc tải 1 file
// .txt, mỗi dòng là câu đúng của 1 vị trí. Cả 2 cách đều GHÉP vào sentences hiện có theo vị trí
// (không xoá mất audio/text đã có ở phía còn lại), không phải ghi đè toàn bộ.
export default function DictationStudio({
  accent,
  title,
  onTitleChange,
  sentences,
  onSentencesChange,
  onBack,
  onSave,
  saving,
  saved,
}) {
  const confirm = useConfirm();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const bulkAudioInputRef = useRef(null);
  const txtInputRef = useRef(null);

  function addSentence(at = (sentences ?? []).length) {
    onSentencesChange(insertAt(sentences, at, { text: "", audioUrl: null }));
  }
  function updateSentence(i, patch) {
    // Ghép vào bản mới nhất — nhiều audio tải song song xong lúc khác nhau không ghi đè nhau.
    onSentencesChange(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  async function removeSentence(i) {
    if (!(await confirm("Xoá câu này khỏi bài Dictation?", { danger: true }))) return;
    onSentencesChange(sentences.filter((_, idx) => idx !== i));
  }
  function moveSentence(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= sentences.length) return;
    const next = [...sentences];
    [next[i], next[j]] = [next[j], next[i]];
    onSentencesChange(next);
  }

  async function handleBulkAudioFiles(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBulkError("");
    setBulkUploading(true);
    try {
      const sorted = sortFilesNatural(files);
      for (let idx = 0; idx < sorted.length; idx++) {
        const url = await uploadToCloudinary(sorted[idx]);
        onSentencesChange(prev => {
          const next = [...(prev ?? [])];
          next[idx] = { text: next[idx]?.text ?? "", ...next[idx], audioUrl: url };
          return next;
        });
      }
    } catch (err) {
      setBulkError(err.message || "Upload thất bại");
    } finally {
      setBulkUploading(false);
    }
  }

  function handleTxtFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result)
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
      const next = [...(sentences ?? [])];
      lines.forEach((text, i) => {
        next[i] = { audioUrl: next[i]?.audioUrl ?? null, text };
      });
      onSentencesChange(next);
    };
    reader.readAsText(file);
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead backLabel="← Quay lại danh sách Test" onBack={onBack}>
        <input
          className="admin-input admin-dictation-title-input"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Tên Test (vd: Test 1)"
        />
        <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)} disabled={!sentences?.length}>👁 Preview</button>
        <PageHeadSaveButton onSave={onSave} saving={saving} saved={saved} warnings={validateDictation(sentences)} />
      </PageHead>

      <p className="admin-hint">
        Mỗi câu gồm 1 file audio (KHÔNG dùng audio gốc sách có bản quyền — tự thu âm hoặc dùng
        Text-to-Speech ngoài rồi tải lên/dán link) và đúng nội dung học sinh phải gõ lại khi nghe.
      </p>

      <div className="admin-dictation-bulk-bar">
        <div className="admin-dictation-bulk-item">
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={() => bulkAudioInputRef.current?.click()}
            disabled={bulkUploading}
          >
            {bulkUploading ? "Đang tải audio lên..." : "📁 Tải nhiều audio cùng lúc"}
          </button>
          <span className="admin-dictation-bulk-hint">
            Đặt tên file 1, 2, 3... theo đúng thứ tự câu — tự khớp vào từng câu 1/2/3...
          </span>
          <input
            ref={bulkAudioInputRef}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={handleBulkAudioFiles}
          />
        </div>
        <div className="admin-dictation-bulk-item">
          <button type="button" className="admin-btn-secondary" onClick={() => txtInputRef.current?.click()}>
            📄 Tải file .txt danh sách câu
          </button>
          <span className="admin-dictation-bulk-hint">Mỗi dòng trong file là câu đúng của 1 vị trí (dòng 1 → câu 1...).</span>
          <input ref={txtInputRef} type="file" accept=".txt,text/plain" hidden onChange={handleTxtFile} />
        </div>
      </div>
      {bulkError && <p className="admin-upload-error">{bulkError}</p>}

      <ol className="admin-scene-list">
        {(sentences ?? []).map((s, i) => (
          <Fragment key={i}>
          {i > 0 && <InsertRow as="li" onClick={() => addSentence(i)} />}
          <li className="admin-scene-list-item admin-dictation-row">
            <span className="admin-scene-list-index">{i + 1}</span>
            <div className="admin-dictation-row-fields">
              <AudioUploadField
                label={`Audio câu ${i + 1}`}
                value={s.audioUrl}
                onChange={url => updateSentence(i, { audioUrl: url })}
              />
              <label className="admin-dictation-text-label">
                Câu đúng (học sinh phải gõ lại)
                <input
                  className="admin-input"
                  value={s.text}
                  onChange={e => updateSentence(i, { text: e.target.value })}
                  placeholder="vd: Hello, my name is Sally."
                />
              </label>
            </div>
            <div className="admin-scene-list-actions">
              <button type="button" className="admin-link-btn" onClick={() => moveSentence(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="admin-link-btn" onClick={() => moveSentence(i, 1)} disabled={i === sentences.length - 1}>↓</button>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeSentence(i)}>Xoá</button>
            </div>
          </li>
          </Fragment>
        ))}
      </ol>

      <button type="button" className="admin-btn-secondary" onClick={() => addSentence()}>+ Thêm câu</button>

      {previewOpen && (
        <div className="reading-fullscreen">
          <div className="speaking-fullscreen-topbar">
            <button className="speaking-fullscreen-back" onClick={() => setPreviewOpen(false)}>← Đóng Preview</button>
            <span className="speaking-fullscreen-title">{title} (xem trước)</span>
          </div>
          <div className="speaking-fullscreen-body reading-fullscreen-body dictation-fullscreen-body">
            <DictationRunner sentences={sentences} onFinish={() => setPreviewOpen(false)} preview />
          </div>
        </div>
      )}
    </div>
  );
}
