import ImageUploadField from "./ImageUploadField.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { MoversPart3Sheet, MOVERS_LETTERS } from "../MoversListeningPart3.jsx";

// CMS Luyện đề Listening Movers — Part 3 (nghe và chọn chữ cái): 8 tranh A–H dùng chung, 1 dòng ví dụ +
// 5 dòng (ảnh người, nhãn như "her mum", đáp án A–H). Xem trước dùng đúng MoversPart3Sheet (điền sẵn đáp án).
const blankRow = () => ({ question: "", image: "", answer: "A" });

export function blankMoversPart3() {
  return {
    variant: "movers",
    audioUrl: "",
    intro: "",
    pictures: Array(8).fill(""),
    example: blankRow(),
    questions: Array.from({ length: 5 }, blankRow),
  };
}

export function normalizeMoversPart3(raw) {
  const base = blankMoversPart3();
  if (!raw) return base;
  return {
    variant: "movers",
    audioUrl: raw.audioUrl ?? "",
    intro: raw.intro ?? "",
    pictures: base.pictures.map((b, i) => raw.pictures?.[i] ?? b),
    example: { ...base.example, ...(raw.example ?? {}) },
    questions: base.questions.map((b, i) => ({ ...b, ...(raw.questions?.[i] ?? {}) })),
  };
}

export function moversPart3HasContent(part) {
  return part.questions.some(q => q.question.trim());
}

export function validateMoversPart3(part) {
  if (part.pictures.some(u => !u)) return "Part 3: cần đủ 8 tranh A–H.";
  const bad = part.questions.findIndex(q => q.question.trim() && !q.image);
  if (bad >= 0) return `Part 3: Câu ${bad + 1} chưa có ảnh người.`;
  return null;
}

function RowFields({ row, onChange, num }) {
  return (
    <div className="p3e-card">
      <div className="p3e-head">
        {num != null && <span className="p1e-pair-num">{num}</span>}
        <input className="admin-input" placeholder="Nhãn (vd: her mum)" value={row.question} onChange={e => onChange({ question: e.target.value })} />
      </div>
      <div className="p3e-image"><ImageUploadField value={row.image} onChange={v => onChange({ image: v ?? "" })} /></div>
      <div className="p3e-answer">
        <span>Đáp án</span>
        {MOVERS_LETTERS.map(L => (
          <button key={L} type="button" className={`p3e-answer-btn${row.answer === L ? " is-active" : ""}`} onClick={() => onChange({ answer: L })}>
            {L}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MoversPart3Editor({ part, onChange }) {
  const setQuestion = (i, patch) => onChange({ ...part, questions: part.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) });
  const filled = part.questions.filter(q => q.question.trim()).length;

  return (
    <div className="admin-form p1e">
      <fieldset className="admin-fieldset">
        <legend>🎧 Audio Part 3</legend>
        <AudioUploadField value={part.audioUrl} onChange={v => onChange({ ...part, audioUrl: v ?? "" })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>💬 Đề bài (vd: Sally is telling Mr Castle about...)</legend>
        <textarea className="admin-input" rows={2} value={part.intro} onChange={e => onChange({ ...part, intro: e.target.value })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🖼️ 8 tranh A–H</legend>
        <div className="p3e-images">
          {MOVERS_LETTERS.map((L, i) => (
            <div className="p3e-image" key={L}>
              <strong>{L}</strong>
              <ImageUploadField value={part.pictures[i]} onChange={v => onChange({ ...part, pictures: part.pictures.map((u, idx) => (idx === i ? v ?? "" : u)) })} />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>✏️ Example</legend>
        <RowFields row={part.example} onChange={patch => onChange({ ...part, example: { ...part.example, ...patch } })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>📝 Questions <span className="admin-scene-count-badge">{filled}/{part.questions.length} câu</span></legend>
        <div className="p2e-rows">
          {part.questions.map((q, i) => <RowFields key={i} row={q} num={i + 1} onChange={patch => setQuestion(i, patch)} />)}
        </div>
      </fieldset>
    </div>
  );
}

export function MoversPart3Preview({ part }) {
  const count = part.questions.filter(q => q.question.trim()).length;
  return (
    <div className="admin-reading-preview-panel">
      <h3>Thông tin chung của bài tập</h3>
      <div className="admin-reading-preview-stats">
        <span>Tổng Part: <strong>1</strong></span>
        <span>Tổng số câu: <strong>{count}</strong></span>
      </div>
      <div className="admin-reading-preview-head"><h3>Xem trước bài</h3></div>
      <MoversPart3Sheet part={part} preview />
    </div>
  );
}
