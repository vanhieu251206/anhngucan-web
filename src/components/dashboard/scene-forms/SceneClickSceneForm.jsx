import ImageUploadField from "../ImageUploadField.jsx";
import SceneLineFields from "./SceneLineFields.jsx";

// Loại `scene-click` — học sinh bấm đúng vị trí trong ảnh Scene.
export default function SceneClickSceneForm({ scene, onChange }) {
  const target = scene.target ?? {};
  return (
    <div className="admin-scene-form">
      <SceneLineFields scene={scene} onChange={onChange} />

      <fieldset className="admin-fieldset">
        <legend>🖼️ Ảnh Scene</legend>
        <ImageUploadField value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🎯 Vùng bấm đúng</legend>
        <label className="admin-mini-field">
          <span>ID</span>
          <input
            className="admin-input"
            placeholder="vd: monkey"
            value={target.id ?? ""}
            onChange={e => onChange({ target: { ...target, id: e.target.value } })}
          />
        </label>
        <label className="admin-mini-field">
          <span>Nhãn hiển thị</span>
          <input
            className="admin-input"
            placeholder="vd: the monkey"
            value={target.label ?? ""}
            onChange={e => onChange({ target: { ...target, label: e.target.value } })}
          />
        </label>
        <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để chọn vùng bấm.</p>
      </fieldset>
    </div>
  );
}
