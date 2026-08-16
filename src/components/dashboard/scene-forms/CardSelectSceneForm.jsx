import AudioUploadField from "../AudioUploadField.jsx";
import CardFieldGroup from "../CardFieldGroup.jsx";

// Loại `card-select` — LUÔN đủ 4 thẻ lựa chọn, học sinh chọn đúng 1.
export default function CardSelectSceneForm({ scene, onChange }) {
  const options = scene.options ?? [
    { id: "", label: "", image: null },
    { id: "", label: "", image: null },
    { id: "", label: "", image: null },
    { id: "", label: "", image: null },
  ];

  function setOption(i, card) {
    const next = [...options];
    next[i] = card;
    onChange({ options: next });
  }

  return (
    <div className="admin-scene-form">
      <label>
        Câu thoại giám khảo
        <input className="admin-input" value={scene.examinerLine ?? ""} onChange={e => onChange({ examinerLine: e.target.value })} />
      </label>
      <AudioUploadField label="Audio câu thoại" value={scene.audioUrl} onChange={audioUrl => onChange({ audioUrl })} />

      <fieldset className="admin-fieldset">
        <legend>4 thẻ lựa chọn</legend>
        <div className="admin-options-grid">
          {options.map((opt, i) => (
            <CardFieldGroup key={i} title={`Thẻ ${i + 1}`} value={opt} onChange={card => setOption(i, card)} />
          ))}
        </div>
      </fieldset>

      <label>
        Đáp án đúng (id đúng của 1 trong 4 thẻ trên)
        <select className="admin-input" value={scene.correctId ?? ""} onChange={e => onChange({ correctId: e.target.value })}>
          <option value="">— chọn —</option>
          {options.map((opt, i) => (
            <option key={i} value={opt.id}>
              {opt.id || `(thẻ ${i + 1} chưa đặt id)`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
