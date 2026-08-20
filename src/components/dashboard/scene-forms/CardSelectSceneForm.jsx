import CardFieldGroup from "../CardFieldGroup.jsx";

// Loại `card-select` — LUÔN đủ 4 thẻ lựa chọn. Đa số câu chỉ có 1 đáp án đúng, nhưng vài câu đề
// thi thật chấp nhận NHIỀU đáp án (vd "Which is the book/pen?" — cả 2 đều đúng), nên tick chọn
// (checkbox) thay vì chọn 1 (select) — SceneRunner.jsx đọc `scene.correctIds` (mảng), tự fallback
// `[scene.correctId]` cho scene cũ soạn từ trước khi có tính năng này.
export default function CardSelectSceneForm({ scene, onChange }) {
  const options = scene.options ?? [
    { id: "", label: "", image: null },
    { id: "", label: "", image: null },
    { id: "", label: "", image: null },
    { id: "", label: "", image: null },
  ];
  const correctIds = scene.correctIds ?? (scene.correctId ? [scene.correctId] : []);

  function setOption(i, card) {
    const next = [...options];
    next[i] = card;
    onChange({ options: next });
  }
  function toggleCorrect(id, checked) {
    const next = checked ? [...correctIds, id] : correctIds.filter(x => x !== id);
    onChange({ correctIds: next, correctId: undefined });
  }

  return (
    <div className="admin-scene-form">
      <fieldset className="admin-fieldset">
        <legend>🗂️ 4 thẻ lựa chọn</legend>
        <div className="admin-options-grid">
          {options.map((opt, i) => (
            <CardFieldGroup key={i} title={`Thẻ ${i + 1}`} value={opt} onChange={card => setOption(i, card)} />
          ))}
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>✅ Đáp án đúng (tick 1 hoặc nhiều thẻ)</legend>
        {options.map((opt, i) => (
          <label key={i} className="admin-checkbox-row">
            <input
              type="checkbox"
              disabled={!opt.id}
              checked={!!opt.id && correctIds.includes(opt.id)}
              onChange={e => toggleCorrect(opt.id, e.target.checked)}
            />
            <span>{opt.id || `(thẻ ${i + 1} chưa đặt id)`}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
