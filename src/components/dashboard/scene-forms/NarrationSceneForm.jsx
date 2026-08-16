import ImageUploadField from "../ImageUploadField.jsx";
import AudioUploadField from "../AudioUploadField.jsx";
import CardFieldGroup from "../CardFieldGroup.jsx";

// Loại `narration` — không cần học sinh trả lời, chỉ nghe + xem. Tuỳ chọn thêm `highlight`
// (khoanh vùng chỉ xem) HOẶC `demoCard` (giám khảo làm mẫu đặt thẻ) — 2 cái loại trừ nhau.
export default function NarrationSceneForm({ scene, onChange }) {
  const extra = scene.demoCard ? "demo" : scene.highlight ? "highlight" : "none";

  function setExtra(next) {
    if (next === "none") onChange({ highlight: null, demoCard: null });
    if (next === "highlight") onChange({ demoCard: null });
    if (next === "demo")
      onChange({ highlight: null, demoCard: scene.demoCard ?? { card: { id: "", label: "", image: null }, target: null } });
  }

  return (
    <div className="admin-scene-form">
      <label>
        Câu thoại giám khảo
        <input className="admin-input" value={scene.examinerLine ?? ""} onChange={e => onChange({ examinerLine: e.target.value })} />
      </label>
      <AudioUploadField label="Audio câu thoại" value={scene.audioUrl} onChange={audioUrl => onChange({ audioUrl })} />
      <ImageUploadField label="Ảnh Scene" value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />

      <fieldset className="admin-fieldset">
        <legend>Tuỳ chọn thêm</legend>
        <select className="admin-input" value={extra} onChange={e => setExtra(e.target.value)}>
          <option value="none">Không có</option>
          <option value="highlight">Khoanh vùng chỉ xem (highlight)</option>
          <option value="demo">Giám khảo làm mẫu đặt thẻ (demoCard)</option>
        </select>
        {extra === "highlight" && (
          <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để khoanh vùng.</p>
        )}
        {extra === "demo" && (
          <>
            <CardFieldGroup
              title="Thẻ giám khảo cầm"
              value={scene.demoCard?.card}
              onChange={card => onChange({ demoCard: { ...scene.demoCard, card } })}
            />
            <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để đặt vị trí thẻ mẫu.</p>
          </>
        )}
      </fieldset>
    </div>
  );
}
