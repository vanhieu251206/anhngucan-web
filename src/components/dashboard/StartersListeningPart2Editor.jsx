import ImageUploadField from "./ImageUploadField.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { Part2Sheet } from "../StartersListeningPart2.jsx";

// CMS Luyện đề Listening Starters — Part 2 (nghe và viết tên hoặc số): 2 câu Examples (câu hỏi + đáp án
// điền sẵn) và 5 Questions (câu hỏi, chữ in sẵn trước dòng như "Mrs", đáp án). Nhiều đáp án chấp nhận
// cách nhau bằng "/" (vd: 8 / eight). Xem trước dùng đúng Part2Sheet của màn học sinh.
// movers = true: Movers Part 2 (1 ví dụ, thêm tiêu đề tranh + chữ in sẵn sau dòng).
export function blankPart2(movers = false) {
  return {
    ...(movers ? { variant: "movers", heading: "" } : {}),
    audioUrl: "",
    imageUrl: "",
    examples: Array.from({ length: movers ? 1 : 2 }, () => ({ question: "", answer: "" })),
    questions: Array.from({ length: 5 }, () => ({ question: "", prefix: "", ...(movers ? { suffix: "" } : {}), answer: "" })),
  };
}

export function normalizePart2(raw, movers = false) {
  const base = blankPart2(movers);
  if (!raw) return base;
  return {
    ...(movers ? { variant: "movers", heading: raw.heading ?? "" } : {}),
    audioUrl: raw.audioUrl ?? "",
    imageUrl: raw.imageUrl ?? "",
    examples: base.examples.map((b, i) => ({ ...b, ...(raw.examples?.[i] ?? {}) })),
    questions: base.questions.map((b, i) => ({ ...b, ...(raw.questions?.[i] ?? {}) })),
  };
}

export function validatePart2(part) {
  const bad = part.questions.findIndex(q => q.question.trim() && !q.answer.trim());
  if (bad >= 0) return `Part 2: Câu ${bad + 1} chưa có đáp án.`;
  if (part.questions.some(q => q.question.trim()) && !part.imageUrl) return "Part 2: chưa có ảnh tranh.";
  return null;
}

export function part2HasContent(part) {
  return !!part.imageUrl || part.questions.some(q => q.question.trim());
}

export function Part2Editor({ part, onChange }) {
  function setExample(i, patch) {
    onChange({ ...part, examples: part.examples.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  }
  function setQuestion(i, patch) {
    onChange({ ...part, questions: part.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) });
  }
  const filled = part.questions.filter(q => q.question.trim()).length;

  return (
    <div className="admin-form p1e">
      <fieldset className="admin-fieldset">
        <legend>🎧 Audio Part 2</legend>
        <AudioUploadField value={part.audioUrl} onChange={v => onChange({ ...part, audioUrl: v ?? "" })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🖼️ Ảnh tranh</legend>
        <ImageUploadField value={part.imageUrl} onChange={v => onChange({ ...part, imageUrl: v ?? "" })} />
      </fieldset>

      {part.variant === "movers" && (
        <fieldset className="admin-fieldset">
          <legend>🏷️ Tiêu đề (vd: Sports centre)</legend>
          <input className="admin-input" placeholder="Tiêu đề dưới tranh" value={part.heading ?? ""} onChange={ev => onChange({ ...part, heading: ev.target.value })} />
        </fieldset>
      )}

      <fieldset className="admin-fieldset">
        <legend>✏️ Example</legend>
        <div className="p2e-rows">
          {part.examples.map((e, i) => (
            <div className="p2e-row" key={i}>
              <span className="p1e-pair-num">{i + 1}</span>
              <div className="p2e-fields is-example">
                <input className="admin-input" placeholder="Câu hỏi" value={e.question} onChange={ev => setExample(i, { question: ev.target.value })} />
                <input className="admin-input" placeholder="Đáp án điền sẵn" value={e.answer} onChange={ev => setExample(i, { answer: ev.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>📝 Questions <span className="admin-scene-count-badge">{filled}/{part.questions.length} câu</span></legend>
        <div className="p2e-rows">
          {part.questions.map((q, i) => (
            <div className="p2e-row" key={i}>
              <span className="p1e-pair-num">{i + 1}</span>
              <div className={`p2e-fields${part.variant === "movers" ? " is-movers" : ""}`}>
                <input className="admin-input" placeholder="Câu hỏi" value={q.question} onChange={ev => setQuestion(i, { question: ev.target.value })} />
                <input className="admin-input" placeholder={part.variant === "movers" ? "Chữ trước dòng" : "Chữ in sẵn"} value={q.prefix} onChange={ev => setQuestion(i, { prefix: ev.target.value })} />
                <input className="admin-input" placeholder="Đáp án (nhiều đáp án: 8 / eight)" value={q.answer} onChange={ev => setQuestion(i, { answer: ev.target.value })} />
                {part.variant === "movers" && <input className="admin-input" placeholder="Chữ sau dòng (vd: Street)" value={q.suffix ?? ""} onChange={ev => setQuestion(i, { suffix: ev.target.value })} />}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function Part2Preview({ part }) {
  const count = part.questions.filter(q => q.question.trim() && q.answer.trim()).length;
  return (
    <div className="admin-reading-preview-panel">
      <h3>Thông tin chung của bài tập</h3>
      <div className="admin-reading-preview-stats">
        <span>Tổng Part: <strong>1</strong></span>
        <span>Tổng số câu: <strong>{count}</strong></span>
      </div>
      <div className="admin-reading-preview-head"><h3>Xem trước bài</h3></div>
      <Part2Sheet part={part} preview />
    </div>
  );
}
