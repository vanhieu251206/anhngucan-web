import ImageUploadField from "./ImageUploadField.jsx";

// 1 nhóm field {id, label, image} — dùng chung cho `card`, từng phần tử `options[]`,
// `demoCard.card` ở nhiều form scene khác nhau, tránh lặp lại 3 field này nhiều lần.
export default function CardFieldGroup({ value, onChange, title }) {
  const card = value ?? { id: "", label: "", image: null };
  function set(patch) {
    onChange({ ...card, ...patch });
  }
  return (
    <div className="admin-card-field-group">
      {title && <strong>{title}</strong>}
      <label className="admin-mini-field">
        <span>ID</span>
        <input
          className="admin-input"
          placeholder="vd: shell"
          value={card.id}
          onChange={e => set({ id: e.target.value })}
        />
      </label>
      <label className="admin-mini-field">
        <span>Nhãn hiển thị</span>
        <input
          className="admin-input"
          placeholder="vd: shell"
          value={card.label}
          onChange={e => set({ label: e.target.value })}
        />
      </label>
      <ImageUploadField value={card.image} onChange={image => set({ image })} />
    </div>
  );
}
