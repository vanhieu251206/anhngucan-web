import { useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import CommaListInput from "./CommaListInput.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { PaperView } from "../PaperAnswerSheet.jsx";
import { CHOICE_LETTERS, blankSheetQuestion } from "../../lib/ketPetPracticeTest.js";
import { uploadPaper } from "../../lib/paperUpload.js";

// Dán cả dãy đáp án 1 lần, mỗi dòng 1 câu ("1. B", "2) went | has gone"...): 1 chữ cái A-E = câu chọn, còn lại = câu
// gõ (nhiều cách viết ngăn bằng |). Dòng trống giữ nguyên câu đó.
function parsePastedAnswers(text, questions) {
  const lines = String(text ?? "").split(/\r?\n/).map(l => l.replace(/^\s*\d+\s*[.):-]?\s*/, "").trim());
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.map((line, i) => {
    const old = questions[i] ?? blankSheetQuestion();
    if (!line) return old;
    const letter = CHOICE_LETTERS.indexOf(line.toUpperCase());
    if (letter >= 0) {
      const count = old.type === "multiple-choice" ? Math.max(old.options.length, letter + 1) : Math.max(4, letter + 1);
      return { ...blankSheetQuestion("multiple-choice", count), answerIndex: letter };
    }
    return { type: "fill-blank", acceptedAnswers: line.split("|").map(s => s.trim()).filter(Boolean) };
  });
}

export function hasPaperFile(paper) {
  return Boolean(paper?.pages?.length || paper?.html);
}

// Cách soạn "Tải đề lên (PDF / Word)" — dùng chung KET/PET Practice Test (2026-10-23) và IELTS Reading Luyện đề /
// Đọc hiểu / Listening (2026-10-31). Bên trái là đề, bên phải là phiếu trả lời — mỗi câu là nút chọn A/B/C/D hoặc ô
// gõ, cô chỉ nhập đáp án, mỗi câu 1 điểm.
// questions = null: chỉ tải file để học sinh xem (IELTS Đọc hiểu), không có phiếu. startNumber: số câu đầu (IELTS
// Passage 2 = 14...). extra: nội dung thêm đầu cột phải (vd ô audio). renderPreview(onClose): màn xem trước.
export default function PaperTestStudio({
  accent,
  label,
  backLabel,
  onBack,
  paper,
  onPaperChange,
  questions = null,
  onQuestionsChange,
  startNumber = 1,
  withAudios = true,
  extra = null,
  warnings,
  renderPreview,
  onSave,
  saving,
  saved,
}) {
  const confirm = useConfirm();
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const withSheet = Array.isArray(questions);
  // Audio theo ĐOẠN CÂU: paper.audios = [{ from, to, url }] — 1 file nghe dùng cho câu from..to (số câu hiển thị).
  const audios = paper?.audios ?? [];
  const setAudios = list => onPaperChange({ ...paper, audios: list });
  const updateAudio = (ai, patch) => setAudios(audios.map((a, k) => (k === ai ? { ...a, ...patch } : a)));
  const updateQuestion = (i, patch) => onQuestionsChange(questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (hasPaperFile(paper) && !(await confirm(`Thay đề hiện có bằng file này?${withSheet ? " Đáp án đã nhập vẫn giữ nguyên." : ""}`))) return;
    setError("");
    try {
      const next = await uploadPaper(file, setStage);
      onPaperChange(audios.length ? { ...next, audios } : next);
    } catch (err) {
      setError(err.message || "Tải đề thất bại");
    } finally {
      setStage("");
    }
  }

  async function setCount(value) {
    const n = Math.max(0, Math.min(200, Number(value) || 0));
    if (n < questions.length) {
      const lost = questions.slice(n).filter(q => q.answerIndex != null || q.acceptedAnswers?.length).length;
      if (lost && !(await confirm(`Bớt còn ${n} câu sẽ xoá đáp án của ${lost} câu cuối?`, { danger: true }))) return;
      onQuestionsChange(questions.slice(0, n));
      return;
    }
    const lastType = questions[questions.length - 1]?.type ?? "multiple-choice";
    const lastCount = questions[questions.length - 1]?.options?.length ?? 4;
    onQuestionsChange([...questions, ...Array.from({ length: n - questions.length }, () => blankSheetQuestion(lastType, lastCount))]);
  }

  function applyPaste() {
    const parsed = parsePastedAnswers(pasteText, questions);
    onQuestionsChange([...parsed, ...questions.slice(parsed.length)]);
    setPasteOpen(false);
    setPasteText("");
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead label={label} backLabel={backLabel} onBack={onBack}>
        <label className="admin-pill-btn">
          {hasPaperFile(paper) ? "⬆ Tải đề khác" : "⬆ Tải đề (PDF / Word)"}
          <input type="file" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden disabled={!!stage} onChange={handleFile} />
        </label>
        {renderPreview && <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)}>👁 Preview</button>}
        <PageHeadSaveButton onSave={onSave} saving={saving || !!stage} saved={saved} warnings={warnings} />
      </PageHead>

      {stage && <p className="paper-studio-stage">{stage}</p>}
      {error && <p className="admin-error">{error}</p>}

      <div className="paper-layout paper-layout-studio">
        <div className="paper-doc">
          {hasPaperFile(paper) ? <PaperView paper={paper} /> : <p className="paper-doc-empty">Chưa có đề — bấm "Tải đề (PDF / Word)".</p>}
        </div>

        <div className="paper-sheet">
          {extra}
          {withSheet && (
            <div className="admin-practice-option-row">
              <label htmlFor="paper-count" style={{ whiteSpace: "nowrap" }}>Số câu:</label>
              <input id="paper-count" className="admin-input" type="number" min="0" max="200" style={{ maxWidth: 90 }} value={questions.length} onChange={e => setCount(e.target.value)} />
              <button type="button" className="admin-link-btn" onClick={() => setPasteOpen(o => !o)}>📋 Dán đáp án</button>
            </div>
          )}

          {withSheet && pasteOpen && (
            <div className="paper-paste">
              <textarea
                className="admin-input"
                rows={8}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={`Mỗi dòng 1 câu, theo thứ tự:\n${startNumber}. B\n${startNumber + 1}. C\n${startNumber + 2}. went | has gone`}
              />
              <button type="button" className="admin-btn-secondary" onClick={applyPaste} disabled={!pasteText.trim()}>Điền vào phiếu</button>
            </div>
          )}

          {withSheet && withAudios && (
            <div className="paper-audio-list">
              {audios.map((a, ai) => (
                <div key={ai} className="paper-audio-item">
                  <div className="admin-practice-option-row">
                    <span style={{ whiteSpace: "nowrap", fontWeight: 700 }}>🎧 Audio câu</span>
                    <input className="admin-input" type="number" min="1" style={{ maxWidth: 80 }} value={a.from ?? ""} onChange={e => updateAudio(ai, { from: Number(e.target.value) || null })} aria-label="Từ câu" />
                    <span>→</span>
                    <input className="admin-input" type="number" min="1" style={{ maxWidth: 80 }} value={a.to ?? ""} onChange={e => updateAudio(ai, { to: Number(e.target.value) || null })} aria-label="Tới câu" />
                    <button type="button" className="admin-link-btn admin-pill-btn-danger" style={{ marginLeft: "auto" }} onClick={() => setAudios(audios.filter((_, k) => k !== ai))}>Xoá</button>
                  </div>
                  <AudioUploadField label="" value={a.url} onChange={url => updateAudio(ai, { url })} />
                </div>
              ))}
              <button type="button" className="admin-link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setAudios([...audios, { from: null, to: null, url: "" }])}>🎵 Chèn audio cho đoạn câu</button>
            </div>
          )}

          {withSheet && (
            <ol className="paper-key-list">
              {questions.map((q, i) => (
                <li key={i} className={`paper-key-row${q.skip ? " is-skipped" : ""}`}>
                  <span className="paper-key-num">{startNumber + i}</span>
                  {q.skip ? <span className="paper-skip-text">Không cần làm</span> : (<>
                  <select
                    className="admin-input paper-key-type"
                    value={q.type === "multiple-choice" ? `mc${q.options.length}` : "text"}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === "text") updateQuestion(i, blankSheetQuestion("fill-blank"));
                      else {
                        const count = Number(v.slice(2));
                        updateQuestion(i, { ...blankSheetQuestion("multiple-choice", count), answerIndex: q.answerIndex != null && q.answerIndex < count ? q.answerIndex : null });
                      }
                    }}
                  >
                    <option value="mc3">Chọn A-C</option>
                    <option value="mc4">Chọn A-D</option>
                    <option value="mc5">Chọn A-E</option>
                    <option value="text">Gõ chữ</option>
                  </select>
                  {q.type === "multiple-choice" ? (
                    <div className="paper-choice-row">
                      {q.options.map((letter, oi) => (
                        <button
                          key={letter}
                          type="button"
                          className={`paper-choice${q.answerIndex === oi ? " is-picked" : ""}`}
                          onClick={() => updateQuestion(i, { answerIndex: oi })}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <CommaListInput
                      value={q.acceptedAnswers}
                      onChange={acceptedAnswers => updateQuestion(i, { acceptedAnswers })}
                      separator="|"
                      placeholder="Đáp án — nhiều cách viết ngăn bằng |"
                    />
                  )}
                  </>)}
                  <button
                    type="button"
                    className={`paper-skip-toggle${q.skip ? "" : " is-on"}`}
                    title={q.skip ? "Bật lại câu này" : "Tắt câu này (học sinh không cần làm)"}
                    aria-pressed={!q.skip}
                    onClick={() => updateQuestion(i, { skip: q.skip ? undefined : true })}
                  >
                    {q.skip ? "Tắt" : "Bật"}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {previewOpen && renderPreview(() => setPreviewOpen(false))}
    </div>
  );
}
