import AudioUploadField from "./AudioUploadField.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";

// Màn soạn 1 bài "ĐỌC HIỂU" IELTS Reading — khác ReadingStudio (Part/câu hỏi có chấm điểm):
// đây là bài đọc TĨNH, chia theo từng câu = { en, vi, vocab: [{ termDef, meaning }] }, đúng bố cục
// bảng 2 cột (Passage | Vocabulary + Synonyms) trong tài liệu Word gốc mà người dùng soạn sẵn —
// xem IeltsReadingPassage.jsx (màn học sinh) và CLAUDE.md mục 4 (chỉ áp dụng phần "quy trình soạn
// Speaking", ĐỌC HIỂU là mục mới, chốt cấu trúc 2026-09-10).
export default function ComprehensionStudio({
  accent,
  titleEn,
  onTitleEnChange,
  titleVi,
  onTitleViChange,
  audioUrl,
  onAudioUrlChange,
  sentences,
  onSentencesChange,
  onBack,
  onSave,
  saving,
  saved,
}) {
  const confirm = useConfirm();

  function addSentence() {
    onSentencesChange([...(sentences ?? []), { en: "", vi: "", vocab: [] }]);
  }
  function updateSentence(i, patch) {
    onSentencesChange(sentences.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  async function removeSentence(i) {
    if (!(await confirm("Xoá câu này khỏi bài Đọc hiểu?", { danger: true }))) return;
    onSentencesChange(sentences.filter((_, idx) => idx !== i));
  }
  function moveSentence(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= sentences.length) return;
    const next = [...sentences];
    [next[i], next[j]] = [next[j], next[i]];
    onSentencesChange(next);
  }

  function addVocab(i) {
    updateSentence(i, { vocab: [...(sentences[i].vocab ?? []), { termDef: "", meaning: "" }] });
  }
  function updateVocab(i, vi, patch) {
    const vocab = sentences[i].vocab.map((v, idx) => (idx === vi ? { ...v, ...patch } : v));
    updateSentence(i, { vocab });
  }
  function removeVocab(i, vi) {
    updateSentence(i, { vocab: sentences[i].vocab.filter((_, idx) => idx !== vi) });
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <div className="admin-dictation-head">
        <button type="button" className="admin-pill-btn" onClick={onBack}>← Quay lại danh sách bài</button>
      </div>

      <label className="admin-dictation-text-label">
        Tiêu đề bài (tiếng Anh)
        <input
          className="admin-input"
          value={titleEn}
          onChange={e => onTitleEnChange(e.target.value)}
          placeholder="vd: SHEET GLASS MANUFACTURE: THE FLOAT PROCESS"
        />
      </label>
      <label className="admin-dictation-text-label">
        Tiêu đề bài (tiếng Việt, không bắt buộc)
        <input
          className="admin-input"
          value={titleVi}
          onChange={e => onTitleViChange(e.target.value)}
          placeholder="vd: SẢN XUẤT KÍNH TẤM: QUY TRÌNH NỔI"
        />
      </label>

      <AudioUploadField
        label="Audio đọc toàn bài (giọng tự thu/tạo, KHÔNG dùng audio gốc đề thi có bản quyền)"
        value={audioUrl}
        onChange={onAudioUrlChange}
      />

      <p className="admin-hint">
        Mỗi câu gồm: câu tiếng Anh, bản dịch tiếng Việt, và danh sách từ vựng/từ đồng nghĩa xuất
        hiện trong câu đó (mỗi dòng: cụm từ = từ đồng nghĩa → nghĩa tiếng Việt).
      </p>

      <ol className="admin-scene-list">
        {(sentences ?? []).map((s, i) => (
          <li className="admin-scene-list-item admin-dictation-row" key={i}>
            <span className="admin-scene-list-index">{i + 1}</span>
            <div className="admin-dictation-row-fields">
              <label className="admin-dictation-text-label">
                Câu tiếng Anh
                <textarea
                  className="admin-input admin-textarea"
                  rows={2}
                  value={s.en}
                  onChange={e => updateSentence(i, { en: e.target.value })}
                  placeholder="vd: Glass, which has been made since..."
                />
              </label>
              <label className="admin-dictation-text-label">
                Bản dịch tiếng Việt
                <textarea
                  className="admin-input admin-textarea"
                  rows={2}
                  value={s.vi}
                  onChange={e => updateSentence(i, { vi: e.target.value })}
                  placeholder="vd: Thủy tinh, vốn đã được sản xuất..."
                />
              </label>

              <div className="admin-comprehension-vocab-box">
                <span className="admin-upload-label">Từ vựng + từ đồng nghĩa trong câu này</span>
                {(s.vocab ?? []).map((v, vi) => (
                  <div className="admin-comprehension-vocab-row" key={vi}>
                    <input
                      className="admin-input"
                      value={v.termDef}
                      onChange={e => updateVocab(i, vi, { termDef: e.target.value })}
                      placeholder="vd: mixture = combination / blend"
                    />
                    <input
                      className="admin-input"
                      value={v.meaning}
                      onChange={e => updateVocab(i, vi, { meaning: e.target.value })}
                      placeholder="vd: hỗn hợp"
                    />
                    <button
                      type="button"
                      className="admin-link-btn admin-pill-btn-danger"
                      onClick={() => removeVocab(i, vi)}
                    >
                      Xoá
                    </button>
                  </div>
                ))}
                <button type="button" className="admin-btn-secondary admin-comprehension-add-vocab" onClick={() => addVocab(i)}>
                  + Thêm từ vựng
                </button>
              </div>
            </div>
            <div className="admin-scene-list-actions">
              <button type="button" className="admin-link-btn" onClick={() => moveSentence(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="admin-link-btn" onClick={() => moveSentence(i, 1)} disabled={i === sentences.length - 1}>↓</button>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeSentence(i)}>Xoá câu</button>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="admin-btn-secondary" onClick={addSentence}>+ Thêm câu</button>

      <div className="admin-dictation-footer">
        <button className="admin-btn-primary" type="button" onClick={onSave} disabled={saving}>
          {saving ? "Đang lưu..." : "Xuất bản"}
        </button>
        {saved && <p className="admin-success">✓ Đã lưu</p>}
      </div>
    </div>
  );
}
