import { useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import { QUESTION_TYPES, blankQuestion } from "../../lib/ketPetVocabulary.js";
import KetPetVocabularyQuiz from "../KetPetVocabularyQuiz.jsx";

export const EMPTY_VOCAB_QUESTIONS = [];

// Soạn Vocabulary cho 1 Unit KET/PET — danh sách câu hỏi PHẲNG, mỗi câu tự bấm "+ Thêm câu hỏi"
// rồi CHỌN DẠNG riêng (trắc nghiệm / điền từ / dịch câu) thay vì 4 khung cố định như trước (chốt
// người dùng 2026-09-14) — đổi dạng 1 câu đã có sẽ reset field của câu đó về dạng mới. Nút "Xuất
// bản" dính cố định trên đầu (PageHead sticky) + Preview xem trước y hệt học sinh (dữ liệu đang
// soạn dở, chưa cần lưu) — đồng bộ với LuyenDePage (PracticeStudio.jsx).
export default function KetPetVocabularyStudio({
  accent, gradeTitle, unitTitle, questions, onQuestionsChange, onBack, onSave, saving, saved,
}) {
  const confirm = useConfirm();
  const [previewOpen, setPreviewOpen] = useState(false);

  function addQuestion() {
    onQuestionsChange([...questions, blankQuestion("multiple-choice")]);
  }
  function updateQuestion(qi, patch) {
    onQuestionsChange(questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }
  function changeType(qi, type) {
    onQuestionsChange(questions.map((q, i) => (i === qi ? blankQuestion(type) : q)));
  }
  async function removeQuestion(qi) {
    if (!(await confirm("Xoá câu này?", { danger: true }))) return;
    onQuestionsChange(questions.filter((_, i) => i !== qi));
  }
  function moveQuestion(qi, dir) {
    const qj = qi + dir;
    if (qj < 0 || qj >= questions.length) return;
    const next = [...questions];
    [next[qi], next[qj]] = [next[qj], next[qi]];
    onQuestionsChange(next);
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead label={`${unitTitle} — Vocabulary`} backLabel={`← Quay lại ${gradeTitle}`} onBack={onBack}>
        <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)}>👁 Preview</button>
        <PageHeadSaveButton onSave={onSave} saving={saving} saved={saved} />
      </PageHead>

      <ol className="admin-scene-list">
        {questions.map((q, qi) => (
          <li className="admin-scene-list-item" key={qi}>
            <span className="admin-scene-list-index">{qi + 1}</span>

            <div className="admin-dictation-row-fields">
              <select
                className="admin-input admin-practice-type-select"
                value={q.type}
                onChange={e => changeType(qi, e.target.value)}
              >
                {QUESTION_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>

              {q.type === "multiple-choice" && (
                <>
                  <input
                    className="admin-input"
                    value={q.text}
                    onChange={e => updateQuestion(qi, { text: e.target.value })}
                    placeholder="I really ______ playing football."
                  />
                  {q.options.map((opt, oi) => (
                    <div className="admin-practice-option-row" key={oi}>
                      <input
                        type="radio"
                        name={`mc-${qi}`}
                        checked={q.answerIndex === oi}
                        onChange={() => updateQuestion(qi, { answerIndex: oi })}
                      />
                      <input
                        className="admin-input"
                        value={opt}
                        onChange={e => {
                          const next = [...q.options];
                          next[oi] = e.target.value;
                          updateQuestion(qi, { options: next });
                        }}
                        placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                      />
                    </div>
                  ))}
                </>
              )}

              {q.type === "fill-blank" && (
                <>
                  <input
                    className="admin-input"
                    value={q.text}
                    onChange={e => updateQuestion(qi, { text: e.target.value })}
                    placeholder="stay in ______"
                  />
                  <input
                    className="admin-input"
                    value={(q.acceptedAnswers ?? []).join(", ")}
                    onChange={e =>
                      updateQuestion(qi, {
                        acceptedAnswers: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Đáp án đúng, cách nhau bằng dấu phẩy nếu có nhiều cách viết"
                  />
                </>
              )}

              {q.type === "translation" && (
                <>
                  <input
                    className="admin-input"
                    value={q.prompt}
                    onChange={e => updateQuestion(qi, { prompt: e.target.value })}
                    placeholder="Tôi thường đi chơi với bạn vào cuối tuần."
                  />
                  <input
                    className="admin-input"
                    value={q.sampleAnswer}
                    onChange={e => updateQuestion(qi, { sampleAnswer: e.target.value })}
                    placeholder="I often hang out with my friends at weekends."
                  />
                </>
              )}
            </div>

            <div className="admin-scene-list-actions">
              <button type="button" className="admin-link-btn" onClick={() => moveQuestion(qi, -1)} disabled={qi === 0}>↑</button>
              <button type="button" className="admin-link-btn" onClick={() => moveQuestion(qi, 1)} disabled={qi === questions.length - 1}>↓</button>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeQuestion(qi)}>Xoá</button>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="admin-btn-secondary" onClick={addQuestion}>+ Thêm câu hỏi</button>

      {previewOpen && (
        <div className="admin-preview-overlay">
          <div className="admin-preview-overlay-head">
            <button type="button" className="admin-pill-btn" onClick={() => setPreviewOpen(false)}>← Đóng Preview</button>
            <strong>{unitTitle} — Vocabulary (xem trước)</strong>
          </div>
          <div className="admin-preview-overlay-body">
            <KetPetVocabularyQuiz questions={questions} />
          </div>
        </div>
      )}
    </div>
  );
}
