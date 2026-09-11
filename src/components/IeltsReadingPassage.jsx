import { useState } from "react";

// Hiển thị 1 bài "ĐỌC HIỂU" IELTS — bố cục bám sát bảng 2 cột trong file Word gốc:
// cột trái = câu tiếng Anh (bấm để hiện/ẩn bản dịch), cột phải = từ vựng + từ đồng nghĩa
// xuất hiện trong câu đó. Đây là màn tĩnh (không chấm điểm) — khác ReadingRunner (làm bài
// có câu hỏi/nộp bài), xem CLAUDE.md mục 7 (không tự suy diễn cơ chế mới) — mục ĐỌC HIỂU
// hiện chỉ là 1 bài thử nghiệm đầu tiên (xem lib/ieltsReadingData.js).
function SentenceRow({ sentence, showAllVi }) {
  const [open, setOpen] = useState(false);
  const showVi = showAllVi || open;
  return (
    <div className="ielts-sentence-row">
      <div className="ielts-sentence-main">
        <button
          type="button"
          className="ielts-sentence-en"
          onClick={() => setOpen(o => !o)}
          aria-expanded={showVi}
        >
          {sentence.en}
        </button>
        {showVi && <p className="ielts-sentence-vi">→ {sentence.vi}</p>}
      </div>
      <div className="ielts-sentence-vocab">
        {sentence.vocab.map((v, i) => (
          <p key={i} className="ielts-vocab-item">
            <span className="ielts-vocab-term">{v.termDef}</span>
            <span className="ielts-vocab-arrow">→</span>
            <span className="ielts-vocab-meaning">{v.meaning}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

// 3 cỡ chữ cho khung đọc — lưu lại lựa chọn qua localStorage (chỉ ảnh hưởng trình duyệt đó,
// không đồng bộ nhiều thiết bị) để lần sau vào lại không phải chọn lại.
const FONT_SIZES = [
  { key: "sm", label: "A", scale: 0.88 },
  { key: "md", label: "A", scale: 1 },
  { key: "lg", label: "A", scale: 1.18 },
];

function FontSizeControl({ size, onChange }) {
  return (
    <div className="ielts-fontsize-control" role="group" aria-label="Cỡ chữ">
      {FONT_SIZES.map(f => (
        <button
          key={f.key}
          type="button"
          className={`ielts-fontsize-btn ielts-fontsize-btn-${f.key}${size === f.key ? " is-active" : ""}`}
          onClick={() => onChange(f.key)}
          aria-pressed={size === f.key}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export default function IeltsReadingPassage({ passage, onBack }) {
  const [showAllVi, setShowAllVi] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    try {
      return localStorage.getItem("ielts-reading-fontsize") ?? "md";
    } catch {
      return "md";
    }
  });

  function changeFontSize(key) {
    setFontSize(key);
    try {
      localStorage.setItem("ielts-reading-fontsize", key);
    } catch {
      // localStorage có thể bị chặn (chế độ ẩn danh...) — không chặn tính năng, chỉ không nhớ lựa chọn.
    }
  }

  const scale = FONT_SIZES.find(f => f.key === fontSize)?.scale ?? 1;

  return (
    <div className="ielts-passage-screen">
      <div className="ielts-passage-topbar">
        <button className="speaking-fullscreen-back" onClick={onBack}>
          ⬅ Quay lại
        </button>
        <div className="ielts-passage-topbar-actions">
          <FontSizeControl size={fontSize} onChange={changeFontSize} />
          <button
            type="button"
            className="btn btn-secondary ielts-toggle-vi"
            onClick={() => setShowAllVi(v => !v)}
          >
            {showAllVi ? "Ẩn bản dịch" : "Hiện tất cả bản dịch"}
          </button>
        </div>
      </div>

      <div className="ielts-passage-body" style={{ "--ielts-font-scale": scale }}>
        <header className="ielts-passage-header">
          <h1>{passage.titleEn}</h1>
          <p className="ielts-passage-title-vi">{passage.titleVi}</p>
        </header>

        {passage.audioUrl ? (
          <audio className="ielts-full-audio" src={passage.audioUrl} controls />
        ) : (
          <p className="ielts-full-audio-empty">Chưa có file audio đọc toàn bài cho phần này.</p>
        )}

        <div className="ielts-passage-table">
          <div className="ielts-passage-table-head">
            <span>Passage</span>
            <span>Vocabulary + Synonyms</span>
          </div>
          {passage.sentences.map((s, i) => (
            <SentenceRow key={i} sentence={s} showAllVi={showAllVi} />
          ))}
        </div>
      </div>
    </div>
  );
}
