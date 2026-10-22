import { useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import CommaListInput from "./CommaListInput.jsx";
import KetPetPracticeTestQuiz, { PaperView } from "../KetPetPracticeTestQuiz.jsx";
import { CHOICE_LETTERS, answerSheetGroup, blankSheetQuestion } from "../../lib/ketPetPracticeTest.js";
import { validatePaperTest } from "../../lib/lessonValidation.js";
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

// Practice Test KET/PET — cách soạn "Đề tải lên" (2026-10-23, yêu cầu của cô): tải đề PDF/Word lên, bên phải là
// phiếu trả lời 1..N ("Dán đáp án" chỉ admin — giáo viên nhập từng câu) — mỗi câu là nút chọn A/B/C/D hoặc ô gõ, cô chỉ nhập đáp án. Mỗi câu 1 điểm.
export default function KetPetPaperTestStudio({ accent, unitTitle, gradeTitle, testNumber, paper, onPaperChange, groups, onGroupsChange, onBack, onSave, saving, saved, isAdmin = false }) {
  const confirm = useConfirm();
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const questions = groups[0]?.questions ?? [];

  const setQuestions = qs => onGroupsChange([answerSheetGroup(qs)]);
  const updateQuestion = (i, patch) => setQuestions(questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (paper && !(await confirm("Thay đề hiện có bằng file này? Đáp án đã nhập vẫn giữ nguyên."))) return;
    setError("");
    try {
      onPaperChange(await uploadPaper(file, setStage));
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
      setQuestions(questions.slice(0, n));
      return;
    }
    const lastType = questions[questions.length - 1]?.type ?? "multiple-choice";
    const lastCount = questions[questions.length - 1]?.options?.length ?? 4;
    setQuestions([...questions, ...Array.from({ length: n - questions.length }, () => blankSheetQuestion(lastType, lastCount))]);
  }

  function applyPaste() {
    const parsed = parsePastedAnswers(pasteText, questions);
    setQuestions([...parsed, ...questions.slice(parsed.length)]);
    setPasteOpen(false);
    setPasteText("");
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead label={`${unitTitle} — Practice Test ${testNumber}`} backLabel={`← Quay lại ${gradeTitle}`} onBack={onBack}>
        <label className="admin-pill-btn">
          {paper ? "⬆ Tải đề khác" : "⬆ Tải đề (PDF / Word)"}
          <input type="file" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden disabled={!!stage} onChange={handleFile} />
        </label>
        <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)}>👁 Preview</button>
        <PageHeadSaveButton onSave={onSave} saving={saving || !!stage} saved={saved} warnings={validatePaperTest(paper, groups)} />
      </PageHead>

      {stage && <p className="paper-studio-stage">{stage}</p>}
      {error && <p className="admin-error">{error}</p>}

      <div className="paper-layout paper-layout-studio">
        <div className="paper-doc">
          {paper ? <PaperView paper={paper} /> : <p className="paper-doc-empty">Chưa có đề — bấm "Tải đề (PDF / Word)".</p>}
        </div>

        <div className="paper-sheet">
          <div className="admin-practice-option-row">
            <label htmlFor="paper-count" style={{ whiteSpace: "nowrap" }}>Số câu:</label>
            <input id="paper-count" className="admin-input" type="number" min="0" max="200" style={{ maxWidth: 90 }} value={questions.length} onChange={e => setCount(e.target.value)} />
            {isAdmin && <button type="button" className="admin-link-btn" onClick={() => setPasteOpen(o => !o)}>📋 Dán đáp án</button>}
          </div>

          {isAdmin && pasteOpen && (
            <div className="paper-paste">
              <textarea
                className="admin-input"
                rows={8}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Mỗi dòng 1 câu, theo thứ tự:\n1. B\n2. C\n3. went | has gone"}
              />
              <button type="button" className="admin-btn-secondary" onClick={applyPaste} disabled={!pasteText.trim()}>Điền vào phiếu</button>
            </div>
          )}

          <ol className="paper-key-list">
            {questions.map((q, i) => (
              <li key={i} className="paper-key-row">
                <span className="paper-key-num">{i + 1}</span>
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
              </li>
            ))}
          </ol>
        </div>
      </div>

      {previewOpen && (
        <div className="admin-preview-overlay">
          <div className="admin-preview-overlay-head">
            <button type="button" className="admin-pill-btn" onClick={() => setPreviewOpen(false)}>← Đóng Preview</button>
            <strong>{unitTitle} — Practice Test {testNumber} (xem trước)</strong>
          </div>
          <div className="admin-preview-overlay-body">
            <KetPetPracticeTestQuiz groups={groups} paper={paper} revealAnswers />
          </div>
        </div>
      )}
    </div>
  );
}
