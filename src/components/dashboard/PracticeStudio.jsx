import { useConfirm } from "./ConfirmDialog.jsx";
import OcrImportPanel from "./OcrImportPanel.jsx";
import { splitParagraphs, parseQuestionLines } from "../../lib/ocrParse.js";

// Màn soạn 1 Test "LUYỆN ĐỀ" IELTS Reading — nhiều passage, mỗi passage chia thành nhiều nhóm câu
// hỏi (đúng cách đề thi thật nhóm theo 1 hướng dẫn chung, vd "Questions 1-8: Complete the table
// below..."), mỗi nhóm 1 trong 3 dạng: multiple-choice / tfng (True-False-Not Given) / short-answer
// (điền từ — dùng chung cho cả điền bảng lẫn điền sơ đồ, giáo viên mô tả vị trí ô trống ở `label`).
// KHÔNG có nội dung mẫu nhúng sẵn — giáo viên tự gõ toàn bộ (xem CLAUDE.md mục 1, 7: không tự ý
// đưa nội dung sách có bản quyền vào code).
const GROUP_TYPES = [
  { key: "multiple-choice", label: "Trắc nghiệm (A/B/C/D)" },
  { key: "tfng", label: "True / False / Not Given" },
  { key: "short-answer", label: "Điền từ (bảng, sơ đồ, câu...)" },
];

function blankQuestion(type) {
  if (type === "multiple-choice") return { text: "", options: ["", "", "", ""], answerIndex: 0 };
  if (type === "tfng") return { text: "", answer: "TRUE" };
  return { label: "", acceptedAnswers: "" };
}

function PassageEditor({ passage, onChange, onRemove }) {
  const confirm = useConfirm();

  function update(patch) {
    onChange({ ...passage, ...patch });
  }
  function updateParagraph(i, text) {
    const paragraphs = passage.paragraphs.map((p, idx) => (idx === i ? text : p));
    update({ paragraphs });
  }
  function addParagraph() {
    update({ paragraphs: [...(passage.paragraphs ?? []), ""] });
  }
  async function removeParagraph(i) {
    if (!(await confirm("Xoá đoạn văn này?", { danger: true }))) return;
    update({ paragraphs: passage.paragraphs.filter((_, idx) => idx !== i) });
  }
  // OCR ảnh chụp trang sách → tự tách theo dòng trống thành từng đoạn, GỘP THÊM vào cuối danh
  // sách đoạn hiện có (không xoá đoạn đã có) — giáo viên xem lại/sửa lỗi nhận diện trước khi lưu.
  function handleOcrParagraphs(text) {
    const parsed = splitParagraphs(text);
    if (!parsed.length) return;
    const existing = (passage.paragraphs ?? []).filter(p => p.trim());
    update({ paragraphs: [...existing, ...parsed] });
  }

  function addGroup() {
    update({ groups: [...(passage.groups ?? []), { instruction: "", type: "multiple-choice", questions: [blankQuestion("multiple-choice")] }] });
  }
  function updateGroup(gi, patch) {
    const groups = passage.groups.map((g, idx) => (idx === gi ? { ...g, ...patch } : g));
    update({ groups });
  }
  function changeGroupType(gi, type) {
    updateGroup(gi, { type, questions: [blankQuestion(type)] });
  }
  async function removeGroup(gi) {
    if (!(await confirm("Xoá nhóm câu hỏi này?", { danger: true }))) return;
    update({ groups: passage.groups.filter((_, idx) => idx !== gi) });
  }

  function addQuestion(gi) {
    const g = passage.groups[gi];
    updateGroup(gi, { questions: [...g.questions, blankQuestion(g.type)] });
  }
  function updateQuestion(gi, qi, patch) {
    const g = passage.groups[gi];
    const questions = g.questions.map((q, idx) => (idx === qi ? { ...q, ...patch } : q));
    updateGroup(gi, { questions });
  }
  async function removeQuestion(gi, qi) {
    if (!(await confirm("Xoá câu hỏi này?", { danger: true }))) return;
    const g = passage.groups[gi];
    updateGroup(gi, { questions: g.questions.filter((_, idx) => idx !== qi) });
  }
  // OCR ảnh chụp trang câu hỏi → tách theo số thứ tự + lựa chọn A/B/C/D (nếu có), GỘP THÊM vào
  // cuối danh sách câu hỏi của nhóm này. Chỉ tự điền được NỘI DUNG câu hỏi/lựa chọn — đáp án đúng
  // (TRUE/FALSE/NOT GIVEN, đáp án trắc nghiệm, từ điền đúng) OCR không biết, giáo viên phải tự
  // chọn/gõ lại theo đúng đáp án thật trong sách trước khi Xuất bản.
  function handleOcrQuestions(gi, text) {
    const g = passage.groups[gi];
    const parsed = parseQuestionLines(text);
    if (!parsed.length) return;
    const newQuestions = parsed.map(item => {
      if (g.type === "multiple-choice") {
        const options = [...item.options];
        while (options.length < 4) options.push("");
        return { text: item.text, options: options.slice(0, 4), answerIndex: 0 };
      }
      if (g.type === "tfng") return { text: item.text, answer: "TRUE" };
      return { label: item.text, acceptedAnswers: "" };
    });
    updateGroup(gi, { questions: [...g.questions, ...newQuestions] });
  }

  return (
    <div className="admin-practice-passage">
      <div className="admin-dictation-head">
        <span className="admin-upload-label">Passage</span>
        <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={onRemove}>Xoá passage</button>
      </div>
      <label className="admin-dictation-text-label">
        Tiêu đề passage
        <input className="admin-input" value={passage.title} onChange={e => update({ title: e.target.value })} placeholder="vd: Sheet glass manufacture: the float process" />
      </label>
      <label className="admin-dictation-text-label">
        Ghi chú đầu bài (không bắt buộc)
        <input className="admin-input" value={passage.note ?? ""} onChange={e => update({ note: e.target.value })} placeholder="vd: You should spend about 20 minutes on Questions 1-13." />
      </label>

      <span className="admin-upload-label">Đoạn văn (mỗi ô là 1 đoạn)</span>
      {(passage.paragraphs ?? []).map((p, i) => (
        <div className="admin-practice-paragraph-row" key={i}>
          <textarea
            className="admin-input admin-textarea"
            rows={3}
            value={p}
            onChange={e => updateParagraph(i, e.target.value)}
            placeholder="Nội dung đoạn văn..."
          />
          <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeParagraph(i)}>Xoá</button>
        </div>
      ))}
      <div className="admin-practice-add-row">
        <button type="button" className="admin-btn-secondary" onClick={addParagraph}>+ Thêm đoạn văn</button>
        <OcrImportPanel label="📷 Tải ảnh đoạn văn (OCR)" onText={handleOcrParagraphs} />
      </div>

      <span className="admin-upload-label admin-practice-groups-label">Nhóm câu hỏi</span>
      {(passage.groups ?? []).map((g, gi) => (
        <div className="admin-practice-group" key={gi}>
          <div className="admin-practice-group-head">
            <select className="admin-input admin-practice-type-select" value={g.type} onChange={e => changeGroupType(gi, e.target.value)}>
              {GROUP_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeGroup(gi)}>Xoá nhóm</button>
          </div>
          <textarea
            className="admin-input admin-textarea"
            rows={2}
            value={g.instruction}
            onChange={e => updateGroup(gi, { instruction: e.target.value })}
            placeholder="Hướng dẫn chung của nhóm câu hỏi (vd: Choose the correct letter, A, B, C or D.)"
          />

          {g.questions.map((q, qi) => (
            <div className="admin-practice-question-row" key={qi}>
              <span className="admin-scene-list-index">{qi + 1}</span>
              <div className="admin-dictation-row-fields">
                {g.type === "multiple-choice" && (
                  <>
                    <input className="admin-input" value={q.text} onChange={e => updateQuestion(gi, qi, { text: e.target.value })} placeholder="Nội dung câu hỏi" />
                    {q.options.map((opt, oi) => (
                      <div className="admin-practice-option-row" key={oi}>
                        <input
                          type="radio"
                          name={`mc-${gi}-${qi}`}
                          checked={q.answerIndex === oi}
                          onChange={() => updateQuestion(gi, qi, { answerIndex: oi })}
                        />
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
                    <input className="admin-input" value={q.label} onChange={e => updateQuestion(gi, qi, { label: e.target.value })} placeholder="Mô tả vị trí ô trống (vd: tên hàng/cột trong bảng, nhãn trong sơ đồ...)" />
                    <input
                      className="admin-input"
                      value={q.acceptedAnswers}
                      onChange={e => updateQuestion(gi, qi, { acceptedAnswers: e.target.value })}
                      placeholder="Đáp án đúng — nhiều đáp án cách nhau bằng | (vd: slow|slowly)"
                    />
                  </>
                )}
              </div>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeQuestion(gi, qi)}>Xoá</button>
            </div>
          ))}
          <div className="admin-practice-add-row">
            <button type="button" className="admin-btn-secondary" onClick={() => addQuestion(gi)}>+ Thêm câu hỏi</button>
            <OcrImportPanel label="📷 Tải ảnh trang câu hỏi (OCR)" onText={text => handleOcrQuestions(gi, text)} />
          </div>
        </div>
      ))}
      <button type="button" className="admin-btn-secondary" onClick={addGroup}>+ Thêm nhóm câu hỏi</button>
    </div>
  );
}

export default function PracticeStudio({
  accent,
  title,
  onTitleChange,
  timeLimitMinutes,
  onTimeLimitChange,
  passages,
  onPassagesChange,
  maxAttempts,
  onMaxAttemptsChange,
  onBack,
  onSave,
  saving,
  saved,
}) {
  const confirm = useConfirm();

  function addPassage() {
    onPassagesChange([...(passages ?? []), { title: "", note: "", paragraphs: [""], groups: [] }]);
  }
  function updatePassage(i, next) {
    onPassagesChange(passages.map((p, idx) => (idx === i ? next : p)));
  }
  async function removePassage(i) {
    if (!(await confirm("Xoá passage này? Toàn bộ câu hỏi trong đó cũng bị xoá.", { danger: true }))) return;
    onPassagesChange(passages.filter((_, idx) => idx !== i));
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <div className="admin-dictation-head">
        <button type="button" className="admin-pill-btn" onClick={onBack}>← Quay lại danh sách Test</button>
        <input
          className="admin-input admin-dictation-title-input"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Tên Test (vd: IELTS Collection 1 Reading Test 1)"
        />
      </div>

      <label className="admin-practice-timelimit">
        Thời gian làm bài (phút, để trống = không giới hạn)
        <input
          className="admin-input"
          type="number"
          min="1"
          value={timeLimitMinutes ?? ""}
          onChange={e => onTimeLimitChange(e.target.value ? Number(e.target.value) : null)}
          placeholder="vd: 60"
        />
      </label>

      {(passages ?? []).map((p, i) => (
        <PassageEditor key={i} passage={p} onChange={next => updatePassage(i, next)} onRemove={() => removePassage(i)} />
      ))}
      <button type="button" className="admin-btn-secondary" onClick={addPassage}>+ Thêm passage</button>

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

      <div className="admin-dictation-footer">
        <button className="admin-btn-primary" type="button" onClick={onSave} disabled={saving}>
          {saving ? "Đang lưu..." : "Xuất bản"}
        </button>
        {saved && <p className="admin-success">✓ Đã lưu</p>}
      </div>
    </div>
  );
}
