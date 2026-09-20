import ImageUploadField from "./ImageUploadField.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { Part3Sheet, LETTERS } from "../StartersListeningPart3.jsx";

// CMS Luyện đề Listening Starters — Part 3 (nghe và tick ô đúng): 1 câu ví dụ + 5 câu, mỗi câu có câu hỏi,
// 3 ảnh A/B/C và đáp án đúng. Xem trước dùng đúng Part3Sheet của màn học sinh (tick sẵn đáp án).
const blankOptions = () => ["", "", ""];

// partNo = 4: Movers Part 4 (cùng dạng tick A/B/C, chỉ khác số Part).
export function blankPart3(partNo) {
  return {
    ...(partNo ? { partNo } : {}),
    audioUrl: "",
    example: { question: "", images: blankOptions(), answer: "A" },
    questions: Array.from({ length: 5 }, () => ({ question: "", images: blankOptions(), answer: "A" })),
  };
}

function normQ(raw, base) {
  return { ...base, ...(raw ?? {}), images: base.images.map((b, i) => raw?.images?.[i] ?? b) };
}

export function normalizePart3(raw, partNo) {
  const base = blankPart3(partNo);
  if (!raw) return base;
  return {
    ...(partNo ? { partNo } : {}),
    audioUrl: raw.audioUrl ?? "",
    example: normQ(raw.example, base.example),
    questions: base.questions.map((b, i) => normQ(raw.questions?.[i], b)),
  };
}

export function part3HasContent(part) {
  return part.questions.some(q => q.question.trim());
}

export function validatePart3(part) {
  const bad = part.questions.findIndex(q => q.question.trim() && q.images.some(u => !u));
  if (bad >= 0) return `Part ${part.partNo ?? 3}: Câu ${bad + 1} cần đủ 3 ảnh A, B, C.`;
  return null;
}

function OptionFields({ q, onChange }) {
  return (
    <>
      <div className="p3e-images">
        {LETTERS.map((L, i) => (
          <div className="p3e-image" key={L}>
            <strong>{L}</strong>
            <ImageUploadField
              value={q.images[i]}
              onChange={v => onChange({ images: q.images.map((u, idx) => (idx === i ? v ?? "" : u)) })}
            />
          </div>
        ))}
      </div>
      <div className="p3e-answer">
        <span>Đáp án đúng</span>
        {LETTERS.map(L => (
          <button
            key={L}
            type="button"
            className={`p3e-answer-btn${q.answer === L ? " is-active" : ""}`}
            onClick={() => onChange({ answer: L })}
          >
            {L}
          </button>
        ))}
      </div>
    </>
  );
}

export function Part3Editor({ part, onChange }) {
  function setExample(patch) {
    onChange({ ...part, example: { ...part.example, ...patch } });
  }
  function setQuestion(i, patch) {
    onChange({ ...part, questions: part.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) });
  }
  const filled = part.questions.filter(q => q.question.trim()).length;

  return (
    <div className="admin-form p1e">
      <fieldset className="admin-fieldset">
        <legend>🎧 Audio Part {part.partNo ?? 3}</legend>
        <AudioUploadField value={part.audioUrl} onChange={v => onChange({ ...part, audioUrl: v ?? "" })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>✏️ Example</legend>
        <div className="p3e-card">
          <input className="admin-input" placeholder="Câu hỏi" value={part.example.question} onChange={e => setExample({ question: e.target.value })} />
          <OptionFields q={part.example} onChange={setExample} />
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>📝 Questions <span className="admin-scene-count-badge">{filled}/{part.questions.length} câu</span></legend>
        <div className="p2e-rows">
          {part.questions.map((q, i) => (
            <div className="p3e-card" key={i}>
              <div className="p3e-head">
                <span className="p1e-pair-num">{i + 1}</span>
                <input className="admin-input" placeholder="Câu hỏi" value={q.question} onChange={e => setQuestion(i, { question: e.target.value })} />
              </div>
              <OptionFields q={q} onChange={patch => setQuestion(i, patch)} />
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function Part3Preview({ part }) {
  const count = part.questions.filter(q => q.question.trim()).length;
  return (
    <div className="admin-reading-preview-panel">
      <h3>Thông tin chung của bài tập</h3>
      <div className="admin-reading-preview-stats">
        <span>Tổng Part: <strong>1</strong></span>
        <span>Tổng số câu: <strong>{count}</strong></span>
      </div>
      <div className="admin-reading-preview-head"><h3>Xem trước bài</h3></div>
      <Part3Sheet part={part} preview />
    </div>
  );
}
