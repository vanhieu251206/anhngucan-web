import { useState } from "react";
import PaperTestStudio from "./PaperTestStudio.jsx";
import PaperSheetRunner from "../PaperSheetRunner.jsx";
import { validatePaperTest } from "../../lib/lessonValidation.js";

// "Tải đề lên (PDF / Word)" DÙNG CHUNG cho mọi dạng bài (2026-11-06). Thêm vào 1 trình soạn mới chỉ cần:
//   const paperDraft = usePaperDraft();
//   mở bài: paperDraft.load(full)   bài mới: paperDraft.reset()   lưu: { ...nội dung cũ, ...paperDraft.fields() }
//   render: <PaperModeGate draft={paperDraft} kind=... ...><TrìnhSoạnCũ/></PaperModeGate>
// Dữ liệu trên doc đề: `paperMode` (true = học sinh làm đề tải lên), `paper` ({ pages | html, audios }), `sheet`
// (câu của phiếu). Nội dung soạn từng câu GIỮ NGUYÊN khi bật — chuyển qua lại không mất gì. Chấm: lib/grading/index.js
// (isPaperTest), tách đáp án: lib/grading/answerKeys.js (splitSheet), học sinh: components/PaperSheetRunner.jsx.
export function usePaperDraft() {
  const [paperMode, setPaperMode] = useState(false);
  const [paper, setPaper] = useState(null);
  const [sheet, setSheet] = useState([]);
  return {
    paperMode,
    paper,
    sheet,
    setPaperMode,
    setPaper,
    setSheet,
    load(full) {
      setPaperMode(Boolean(full?.paperMode));
      setPaper(full?.paper ?? null);
      setSheet(Array.isArray(full?.sheet) ? full.sheet : []);
    },
    reset() {
      setPaperMode(false);
      setPaper(null);
      setSheet([]);
    },
    fields() {
      return { paperMode, paper: paper ?? null, sheet };
    },
  };
}

export default function PaperModeGate({ draft, kind, accent, label, backLabel, onBack, title, onTitleChange, onSave, saving, saved, children }) {
  const modeSwitch = (
    <div className="admin-segmented paper-authoring-switch">
      <button type="button" className={!draft.paperMode ? "is-active" : ""} onClick={() => draft.setPaperMode(false)}>Soạn từng câu</button>
      <button type="button" className={draft.paperMode ? "is-active" : ""} onClick={() => draft.setPaperMode(true)}>Tải đề lên (PDF / Word)</button>
    </div>
  );
  if (!draft.paperMode) {
    return (
      <>
        {modeSwitch}
        {children}
      </>
    );
  }
  return (
    <>
      {modeSwitch}
      <PaperTestStudio
        accent={accent}
        label={label}
        backLabel={backLabel}
        onBack={onBack}
        paper={draft.paper}
        onPaperChange={draft.setPaper}
        questions={draft.sheet}
        onQuestionsChange={draft.setSheet}
        warnings={validatePaperTest(draft.paper, draft.sheet)}
        extra={
          onTitleChange && (
            <label className="admin-dictation-text-label">
              Tên bài
              <input className="admin-input" value={title ?? ""} onChange={e => onTitleChange(e.target.value)} />
            </label>
          )
        }
        renderPreview={onClose => (
          <div className="admin-preview-overlay">
            <div className="admin-preview-overlay-head">
              <button type="button" className="admin-pill-btn" onClick={onClose}>← Đóng Preview</button>
              <strong>{label} (xem trước)</strong>
            </div>
            <div className="admin-preview-overlay-body">
              <PaperSheetRunner test={{ paperMode: true, paper: draft.paper, sheet: draft.sheet }} kind={kind} onFinish={onClose} preview />
            </div>
          </div>
        )}
        onSave={onSave}
        saving={saving}
        saved={saved}
      />
    </>
  );
}
