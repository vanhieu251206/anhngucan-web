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

export default function IeltsReadingPassage({ passage, onBack }) {
  const [showAllVi, setShowAllVi] = useState(false);

  return (
    <div className="ielts-passage-screen">
      <div className="ielts-passage-topbar">
        <button className="speaking-fullscreen-back" onClick={onBack}>
          ⬅ Quay lại
        </button>
        <button
          type="button"
          className="btn btn-secondary ielts-toggle-vi"
          onClick={() => setShowAllVi(v => !v)}
        >
          {showAllVi ? "Ẩn bản dịch" : "Hiện tất cả bản dịch"}
        </button>
      </div>

      <div className="ielts-passage-body">
        <header className="ielts-passage-header">
          <h1>{passage.titleEn}</h1>
          <p className="ielts-passage-title-vi">{passage.titleVi}</p>
        </header>

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
