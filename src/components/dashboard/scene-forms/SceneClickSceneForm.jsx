import ImageUploadField from "../ImageUploadField.jsx";
import AudioUploadField from "../AudioUploadField.jsx";

// Loại `scene-click` — học sinh bấm đúng vị trí trong ảnh Scene.
export default function SceneClickSceneForm({ scene, onChange }) {
  const target = scene.target ?? {};
  return (
    <div className="admin-scene-form">
      <label>
        Câu thoại giám khảo
        <input className="admin-input" value={scene.examinerLine ?? ""} onChange={e => onChange({ examinerLine: e.target.value })} />
      </label>
      <AudioUploadField label="Audio câu thoại" value={scene.audioUrl} onChange={audioUrl => onChange({ audioUrl })} />
      <ImageUploadField label="Ảnh Scene" value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />
      <fieldset className="admin-fieldset">
        <legend>Vùng bấm đúng (target)</legend>
        <input
          className="admin-input"
          placeholder="id (vd: monkey)"
          value={target.id ?? ""}
          onChange={e => onChange({ target: { ...target, id: e.target.value } })}
        />
        <input
          className="admin-input"
          placeholder="Nhãn hiển thị (vd: the monkey)"
          value={target.label ?? ""}
          onChange={e => onChange({ target: { ...target, label: e.target.value } })}
        />
        <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để chọn vùng bấm.</p>
      </fieldset>
    </div>
  );
}
