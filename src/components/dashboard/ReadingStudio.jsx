import { useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";
import { WORD_SCRAMBLE_DEFAULT_TEXT, scrambleWord, questionPoints, gapPoints, QuestionBadge } from "../ReadingRunner.jsx";

const QUESTION_TYPES = [
  { type: "yesno", icon: "✅", label: "Đúng/Sai (Yes/No)", desc: "Xem tranh, đọc câu, chọn Yes hoặc No" },
  { type: "gapfill", icon: "📝", label: "Điền từ vào đoạn văn", desc: "Đoạn văn có nhiều chỗ trống, mỗi chỗ điền 1 từ" },
  { type: "short-answer", icon: "✏️", label: "Trả lời ngắn", desc: "Điền 1 từ để hoàn thành câu trả lời" },
  { type: "word-scramble", icon: "🔤", label: "Xáo chữ cái đoán từ vựng", desc: "Xem ảnh, ghép lại các ô chữ cái bị xáo trộn thành đúng từ" },
];

function typeInfo(type) {
  return QUESTION_TYPES.find(t => t.type === type);
}

// Điểm mặc định khi tạo câu mới — 1 điểm/câu. Giáo viên sửa lại tổng điểm câu bất kỳ lúc nào qua
// ô "Điểm" (riêng gapfill: tổng điểm câu tự chia đều cho các chỗ trống, xem gapPoints() trong
// ReadingRunner.jsx).
function blankQuestion(type) {
  if (type === "yesno") return { type, image: null, text: "", answer: "yes", points: 1 };
  if (type === "gapfill") return { type, image: null, text: "", answers: [], points: 1 };
  if (type === "word-scramble") return { type, image: null, text: WORD_SCRAMBLE_DEFAULT_TEXT, answer: "", points: 1 };
  return { type: "short-answer", image: null, prompt: "", answer: "", points: 1 };
}

function blankPart(order) {
  return { title: `Part ${order} – Reading and Writing`, instruction: "", questions: [] };
}

// Đếm số chỗ trống "___" trong đoạn văn gapfill để tự sinh đúng số ô nhập đáp án (answers[]) —
// mỗi chỗ trống đều là 1 câu học sinh phải điền, không có khái niệm "ví dụ mẫu" tự động (giáo
// viên tự gõ số thứ tự/ví dụ như văn bản thường trong đoạn văn nếu muốn, xem ReadingRunner.jsx).
function countGaps(text) {
  return (text.match(/___/g) || []).length;
}

function GapfillAnswersEditor({ question, onChange }) {
  const gapCount = countGaps(question.text || "");
  const answers = question.answers ?? [];

  function setAnswer(i, val) {
    const next = [...answers];
    while (next.length < gapCount) next.push("");
    next[i] = val;
    onChange({ answers: next.slice(0, gapCount) });
  }

  return (
    <div className="admin-card-field-group">
      <strong>Đáp án từng chỗ trống</strong>
      {gapCount === 0 && (
        <p className="admin-hint">Bấm "+ Chèn chỗ trống tại vị trí con trỏ" trong ô đoạn văn ở trên để tạo chỗ trống.</p>
      )}
      {Array.from({ length: gapCount }).map((_, i) => (
        <label className="admin-mini-field" key={i}>
          <span>Chỗ trống {i + 1} (học sinh điền)</span>
          <input
            className="admin-input"
            value={answers[i] ?? ""}
            onChange={e => setAnswer(i, e.target.value)}
            placeholder="vd: kitchen"
          />
        </label>
      ))}
    </div>
  );
}

// Textarea đoạn văn gapfill + nút "Chèn chỗ trống" tại đúng vị trí con trỏ đang gõ, thay vì bắt
// giáo viên tự gõ tay 3 dấu "___" (dễ gõ sai số lượng gạch dưới, lệch với parser countGaps()).
function GapfillTextEditor({ value, onChange }) {
  const ref = useRef(null);

  function insertGap() {
    const el = ref.current;
    const text = value ?? "";
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    // Tự đánh số thứ tự chỗ trống — đếm số chỗ trống ĐÃ CÓ trong text để biết số tiếp theo, giáo
    // viên chỉ cần gõ nội dung, không cần tự gõ "(1)", "(2)"... như trước.
    const nextNumber = countGaps(text) + 1;
    const inserted = `(${nextNumber})___`;
    const next = text.slice(0, start) + inserted + text.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <label className="admin-mini-field">
      <span>Đoạn văn</span>
      <textarea
        ref={ref}
        className="admin-input admin-textarea"
        rows={4}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder="vd: You find a living room in a house. His living room is between the dining room and the kitchen."
      />
      <button type="button" className="admin-btn-secondary admin-gap-insert-btn" onClick={insertGap}>
        + Chèn chỗ trống (tự đánh số) tại vị trí con trỏ
      </button>
    </label>
  );
}

// Input câu hỏi ngắn + nút "Chèn chỗ trống" — KHÔNG đánh số thứ tự (khác GapfillTextEditor) vì
// mỗi câu Trả lời ngắn thường chỉ có đúng 1 chỗ trống, không cần phân biệt (1)/(2).
function ShortAnswerPromptEditor({ value, onChange }) {
  const ref = useRef(null);

  function insertGap() {
    const el = ref.current;
    const text = value ?? "";
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + "___" + text.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + 3;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <label className="admin-mini-field">
      <span>Câu hỏi</span>
      <input
        ref={ref}
        className="admin-input"
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder="vd: Where is the ball? on the"
      />
      <button type="button" className="admin-btn-secondary admin-gap-insert-btn" onClick={insertGap}>
        + Chèn chỗ trống tại vị trí con trỏ
      </button>
    </label>
  );
}

function QuestionEditor({ question, index, onChange, onDelete, onDuplicate }) {
  const info = typeInfo(question.type);
  return (
    <div className="admin-reading-question-card">
      <div className="admin-reading-question-head">
        <span className="admin-reading-question-num">Câu {index + 1}</span>
        <span className="admin-reading-question-type">{info?.icon} {info?.label}</span>
        <label className="admin-reading-question-points">
          Điểm
          <input
            type="number"
            min={0}
            step={0.5}
            className="admin-input admin-points-input"
            value={question.points ?? 1}
            onChange={e => onChange({ points: Number(e.target.value) })}
          />
        </label>
        <div className="admin-reading-question-actions">
          <button type="button" className="admin-link-btn" onClick={onDuplicate}>Nhân bản</button>
          <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={onDelete}>Xoá</button>
        </div>
      </div>

      {question.type === "yesno" && (
        <>
          <ImageUploadField
            label="Ảnh minh hoạ"
            value={question.image}
            onChange={image => onChange({ image })}
          />
          <label className="admin-mini-field">
            <span>Câu hỏi / câu khẳng định</span>
            <input
              className="admin-input"
              value={question.text ?? ""}
              onChange={e => onChange({ text: e.target.value })}
              placeholder="vd: This is a handbag."
            />
          </label>
          <fieldset className="admin-fieldset">
            <legend>Đáp án đúng</legend>
            <div className="admin-yesno-picker">
              <label className="admin-checkbox-row">
                <input
                  type="radio"
                  name={`yesno-${index}`}
                  checked={question.answer === "yes"}
                  onChange={() => onChange({ answer: "yes" })}
                />
                <span>Yes</span>
              </label>
              <label className="admin-checkbox-row">
                <input
                  type="radio"
                  name={`yesno-${index}`}
                  checked={question.answer === "no"}
                  onChange={() => onChange({ answer: "no" })}
                />
                <span>No</span>
              </label>
            </div>
          </fieldset>
        </>
      )}

      {question.type === "gapfill" && (
        <>
          <ImageUploadField
            label="Ảnh minh hoạ"
            value={question.image}
            onChange={image => onChange({ image })}
          />
          <GapfillTextEditor value={question.text} onChange={text => onChange({ text })} />
          <GapfillAnswersEditor question={question} onChange={onChange} />
          {countGaps(question.text || "") > 0 && (
            <p className="admin-hint">
              Tổng {questionPoints(question)} điểm chia đều cho {countGaps(question.text || "")} chỗ trống — mỗi chỗ:{" "}
              <strong>{gapPoints(question, countGaps(question.text || "")).toFixed(2).replace(/\.?0+$/, "")} điểm</strong>
            </p>
          )}
        </>
      )}

      {question.type === "short-answer" && (
        <>
          <ImageUploadField
            label="Ảnh minh hoạ (tuỳ chọn)"
            value={question.image}
            onChange={image => onChange({ image })}
          />
          <ShortAnswerPromptEditor value={question.prompt} onChange={prompt => onChange({ prompt })} />
          <label className="admin-mini-field">
            <span>Đáp án (1 từ)</span>
            <input
              className="admin-input"
              value={question.answer ?? ""}
              onChange={e => onChange({ answer: e.target.value })}
              placeholder="vd: table"
            />
          </label>
        </>
      )}

      {question.type === "word-scramble" && (
        <>
          <label className="admin-mini-field">
            <span>Nhập từ vựng</span>
            <input
              className="admin-input"
              value={question.answer ?? ""}
              onChange={e => onChange({ answer: e.target.value.replace(/\s/g, "").toUpperCase() })}
              placeholder="vd: APPLE"
            />
          </label>
          <ImageUploadField
            label="Ảnh minh hoạ từ vựng"
            value={question.image}
            onChange={image => onChange({ image })}
          />
        </>
      )}
    </div>
  );
}

function PartEditor({ part, onChange }) {
  const confirm = useConfirm();
  const [pickerOpen, setPickerOpen] = useState(false);
  const questions = part.questions ?? [];

  function addQuestion(type) {
    onChange({ questions: [...questions, blankQuestion(type)] });
    setPickerOpen(false);
  }
  function updateQuestion(i, patch) {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    onChange({ questions: next });
  }
  async function deleteQuestion(i) {
    if (!(await confirm("Xoá câu hỏi này?", { danger: true }))) return;
    onChange({ questions: questions.filter((_, idx) => idx !== i) });
  }
  function duplicateQuestion(i) {
    const next = [...questions];
    next.splice(i + 1, 0, { ...questions[i] });
    onChange({ questions: next });
  }

  return (
    <div className="admin-reading-part-body">
      <label className="admin-mini-field">
        <span>Tên Part</span>
        <input
          className="admin-input"
          value={part.title ?? ""}
          onChange={e => onChange({ title: e.target.value })}
        />
      </label>
      <label className="admin-mini-field">
        <span>Câu hướng dẫn</span>
        <input
          className="admin-input"
          value={part.instruction ?? ""}
          onChange={e => onChange({ instruction: e.target.value })}
          placeholder="vd: Look and read. Write yes or no."
        />
      </label>

      <div className="admin-reading-question-list">
        {questions.map((q, i) => (
          <QuestionEditor
            key={i}
            question={q}
            index={i}
            onChange={patch => updateQuestion(i, patch)}
            onDelete={() => deleteQuestion(i)}
            onDuplicate={() => duplicateQuestion(i)}
          />
        ))}
      </div>

      {pickerOpen ? (
        <fieldset className="admin-fieldset">
          <legend>⚡ Chọn dạng câu hỏi</legend>
          <div className="studio-action-grid">
            {QUESTION_TYPES.map(t => (
              <button
                key={t.type}
                type="button"
                className="admin-template-tile"
                onClick={() => addQuestion(t.type)}
              >
                <strong>{t.icon} {t.label}</strong>
                <span>{t.desc}</span>
              </button>
            ))}
          </div>
          <button type="button" className="admin-link-btn" onClick={() => setPickerOpen(false)}>Huỷ</button>
        </fieldset>
      ) : (
        <button type="button" className="admin-btn-secondary" onClick={() => setPickerOpen(true)}>
          + Thêm câu hỏi
        </button>
      )}
    </div>
  );
}

// Đếm tổng Part/câu/điểm của cả Test — mỗi chỗ trống gapfill tính là 1 câu riêng (khớp đúng cách
// ReadingRunner.jsx chấm điểm phía học sinh), điểm cộng dồn theo questionPoints() (khớp cách
// gapPoints() chia đều điểm gapfill), dùng cho khung "Thông tin chung" bên phải.
function testStats(parts) {
  let totalQuestions = 0;
  let totalPoints = 0;
  for (const part of parts) {
    for (const q of part.questions ?? []) {
      totalQuestions += q.type === "gapfill" ? (q.answers?.length ?? 0) : 1;
      totalPoints += questionPoints(q);
    }
  }
  return { totalParts: parts.length, totalQuestions, totalPoints };
}

// Xem trước 1 câu hỏi giống hệt cách học sinh sẽ thấy (SceneRunner/ReadingRunner) nhưng ở dạng
// tĩnh, không tương tác — cho giáo viên hình dung ngay khi đang gõ, không cần lưu rồi mới xem thử.
// Số "Question N." đánh liên tục xuyên suốt cả Test, KHÔNG reset theo từng Part (khớp ReadingRunner.jsx).
// Tách riêng component (thay vì nhánh if trong QuestionPreview) để dùng useMemo hợp lệ — xáo trộn
// GIỐNG HỆT thuật toán học sinh sẽ thấy (scrambleWord dùng chung từ ReadingRunner.jsx, không còn
// chữ nào đứng đúng vị trí gốc) thay vì hiện nguyên từ gốc như trước, để giáo viên xem trước đúng
// thực tế. Chữ xáo trộn đặt TRÊN ảnh minh hoạ (yêu cầu người dùng 2026-08-26), ô nhập PIN dưới ảnh.
function WordScramblePreview({ question, qNumber }) {
  const answer = question.answer ?? "";
  const scrambled = useMemo(() => scrambleWord(answer), [answer]);
  return (
    <div className="reading-question reading-question-preview">
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        <p className="reading-question-text">{question.text || WORD_SCRAMBLE_DEFAULT_TEXT}</p>
        {answer ? (
          <>
            <div className="reading-scramble-prompt">
              {scrambled.split("").map((c, i) => (
                <span key={i} className="reading-scramble-prompt-tile reading-scramble-tile-preview">{c}</span>
              ))}
            </div>
            {question.image && <img src={question.image} alt="" className="reading-question-img" />}
            <div className="reading-scramble-pin-row">
              {answer.split("").map((_, i) => (
                <span key={i} className="reading-scramble-pin-input" />
              ))}
            </div>
          </>
        ) : (
          <>
            {question.image && <img src={question.image} alt="" className="reading-question-img" />}
            <em>(chưa nhập từ vựng đáp án)</em>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionPreview({ question, qNumber }) {
  if (question.type === "yesno") {
    return (
      <div className="reading-question reading-question-preview">
        <QuestionBadge qNumber={qNumber} />
        <div className="reading-question-body">
          <p className="reading-question-text">{question.text || <em>(chưa nhập câu khẳng định)</em>}</p>
          {question.image && <img src={question.image} alt="" className="reading-question-img" />}
          <div className="reading-yesno-btns">
            <span className={`reading-yesno-btn${question.answer === "yes" ? " is-selected" : ""}`}>Yes</span>
            <span className={`reading-yesno-btn${question.answer === "no" ? " is-selected" : ""}`}>No</span>
          </div>
        </div>
      </div>
    );
  }
  if (question.type === "gapfill") {
    const segments = (question.text ?? "").split("___");
    return (
      <div className="reading-question reading-question-preview">
        <QuestionBadge qNumber={qNumber} />
        <div className="reading-question-body">
          {question.image && <img src={question.image} alt="" className="reading-question-img" />}
          <p className="reading-gapfill-text">
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              return (
                <span key={i}>
                  {seg}
                  {!isLast && <span className="reading-gap-input reading-gap-input-preview" />}
                </span>
              );
            })}
          </p>
        </div>
      </div>
    );
  }
  if (question.type === "word-scramble") {
    return <WordScramblePreview question={question} qNumber={qNumber} />;
  }
  return (
    <div className="reading-question reading-question-preview">
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        {question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <p className="reading-question-text">
          {question.prompt ? (
            question.prompt.includes("___") ? (
              question.prompt.split("___").map((seg, i, arr) => (
                <span key={i}>{seg}{i < arr.length - 1 && <span className="reading-gap-input reading-gap-input-preview" />}</span>
              ))
            ) : (
              <>{question.prompt} <span className="reading-gap-input reading-gap-input-preview" /></>
            )
          ) : (
            <em>(chưa nhập câu hỏi)</em>
          )}
        </p>
      </div>
    </div>
  );
}

// Xem trước TOÀN BỘ Test (mọi Part, không chỉ Part đang mở soạn) — cuộn riêng trong panel này,
// để giáo viên xem được cả bài đang lên hình ra sao trong lúc soạn, giống hệt thứ tự học sinh
// sẽ thấy (numberOffset cộng dồn qua từng Part y hệt ReadingRunner.jsx).
function TestPreview({ parts, stats }) {
  let numberOffset = 0;

  return (
    <div className="admin-reading-preview-panel">
      <h3>Thông tin chung của bài tập</h3>
      <div className="admin-reading-preview-stats">
        <span>Tổng Part: <strong>{stats.totalParts}</strong></span>
        <span>Tổng số câu: <strong>{stats.totalQuestions}</strong></span>
        <span>Tổng điểm: <strong>{stats.totalPoints}</strong></span>
      </div>

      <h3>Xem trước toàn bộ bài</h3>
      {parts.length === 0 ? (
        <p className="admin-muted-text">Chưa có Part nào để xem trước.</p>
      ) : (
        parts.map((part, pi) => {
          const partOffset = numberOffset;
          numberOffset += part.questions?.length ?? 0;
          return (
            <div className="reading-part reading-part-preview" key={pi}>
              <div className="reading-part-head">
                <h2>{part.title || `Part ${pi + 1}`}</h2>
                {part.instruction && <p className="reading-part-instruction">{part.instruction}</p>}
              </div>
              {!part.questions?.length ? (
                <p className="admin-muted-text">Part này chưa có câu hỏi.</p>
              ) : (
                <div className="reading-question-list">
                  {part.questions.map((q, i) => (
                    <QuestionPreview key={i} question={q} qNumber={partOffset + i + 1} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// Màn soạn 1 Test Reading & Writing — cấu trúc 2 tầng: Test → nhiều Part → mỗi Part nhiều câu hỏi
// (3 loại). Bố cục 2 cột: form soạn bên trái, xem trước trực tiếp + thông tin chung bên phải —
// theo góp ý người dùng (quen mắt với bố cục CMS của YourHomework).
export default function ReadingStudio({ accent, title, onTitleChange, parts, onPartsChange, onBack, onSave, saving, saved }) {
  const confirm = useConfirm();
  const [openPartIndex, setOpenPartIndex] = useState(parts.length ? 0 : null);

  function addPart() {
    const next = [...parts, blankPart(parts.length + 1)];
    onPartsChange(next);
    setOpenPartIndex(next.length - 1);
  }
  function updatePart(i, patch) {
    const next = [...parts];
    next[i] = { ...next[i], ...patch };
    onPartsChange(next);
  }
  async function deletePart(i) {
    if (!(await confirm("Xoá Part này và toàn bộ câu hỏi bên trong?", { danger: true }))) return;
    const next = parts.filter((_, idx) => idx !== i);
    onPartsChange(next);
    if (openPartIndex === i) setOpenPartIndex(null);
    else if (openPartIndex !== null && i < openPartIndex) setOpenPartIndex(openPartIndex - 1);
  }

  async function handlePublish() {
    if (await confirm("Bài này sẽ hiển thị ngay trên website cho học sinh. Xuất bản?")) {
      onSave();
    }
  }

  return (
    <div className="studio-shell" style={accent ? { "--accent": accent } : undefined}>
      <div className="studio-topbar">
        <button className="admin-pill-btn" onClick={onBack}>← Quay lại</button>
        <input
          className="studio-title-input"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Tên Test"
        />
        <div className="studio-topbar-actions">
          {saved && <span className="admin-success">✓ Đã xuất bản</span>}
          <button className="admin-btn-primary" onClick={handlePublish} disabled={saving}>
            {saving ? "Đang xuất bản..." : "Xuất bản"}
          </button>
        </div>
      </div>

      <div className="admin-reading-studio-columns">
        <div className="admin-reading-parts">
          {parts.length === 0 && (
            <div className="admin-empty-state">
              <span className="admin-empty-state-icon">📖</span>
              <p>Chưa có Part nào — bấm "Tạo Part mới" để bắt đầu soạn.</p>
            </div>
          )}
          {parts.map((part, i) => (
            <div key={i} className={`admin-reading-part${openPartIndex === i ? " is-open" : ""}`}>
              <div className="admin-reading-part-head" onClick={() => setOpenPartIndex(openPartIndex === i ? null : i)}>
                <span className="admin-reading-part-chevron" aria-hidden="true">{openPartIndex === i ? "▾" : "▸"}</span>
                <span className="admin-reading-part-title">{part.title || `Part ${i + 1}`}</span>
                <span className="admin-scene-count-badge">{part.questions?.length ?? 0} câu</span>
                <button
                  type="button"
                  className="admin-link-btn admin-pill-btn-danger"
                  onClick={e => { e.stopPropagation(); deletePart(i); }}
                >
                  Xoá
                </button>
              </div>
              {openPartIndex === i && (
                <PartEditor part={part} onChange={patch => updatePart(i, patch)} />
              )}
            </div>
          ))}
          <button type="button" className="admin-btn-secondary" onClick={addPart}>
            + Tạo Part mới
          </button>
        </div>

        <TestPreview parts={parts} stats={testStats(parts)} />
      </div>
    </div>
  );
}
