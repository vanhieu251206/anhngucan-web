import ImageUploadField from "../ImageUploadField.jsx";
import AudioUploadField from "../AudioUploadField.jsx";
import CardFieldGroup from "../CardFieldGroup.jsx";
import SceneLineFields from "./SceneLineFields.jsx";

// Loại `drag-drop` — học sinh kéo 1 thẻ vào đúng vị trí trên ảnh Scene. Duy nhất loại có thêm
// followupLine/followupAudioUrl (đọc thêm câu hỏi phụ tại chỗ sau khi đúng, không tách scene).
export default function DragDropSceneForm({ scene, onChange }) {
  const target = scene.target ?? {};
  return (
    <div className="admin-scene-form">
      <SceneLineFields scene={scene} onChange={onChange} />

      <fieldset className="admin-fieldset">
        <legend>🖼️ Ảnh Scene</legend>
        <ImageUploadField value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🧩 Thẻ để kéo</legend>
        <CardFieldGroup value={scene.card} onChange={card => onChange({ card })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🎯 Vị trí thả đúng</legend>
        <label className="admin-mini-field">
          <span>ID</span>
          <input
            className="admin-input"
            placeholder="vd: watermelons"
            value={target.id ?? ""}
            onChange={e => onChange({ target: { ...target, id: e.target.value } })}
          />
        </label>
        <label className="admin-mini-field">
          <span>Nhãn hiển thị</span>
          <input
            className="admin-input"
            placeholder="vd: between the watermelons"
            value={target.label ?? ""}
            onChange={e => onChange({ target: { ...target, label: e.target.value } })}
          />
        </label>
        <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để chọn vị trí thả.</p>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>💬 Câu hỏi phụ (tuỳ chọn)</legend>
        <label className="admin-mini-field">
          <span>Câu hỏi phụ + đáp án</span>
          <input
            className="admin-input"
            placeholder="vd: Between the watermelons."
            value={scene.followupLine ?? ""}
            onChange={e => onChange({ followupLine: e.target.value })}
          />
        </label>
        <AudioUploadField label="Audio câu hỏi phụ" value={scene.followupAudioUrl} onChange={followupAudioUrl => onChange({ followupAudioUrl })} />
      </fieldset>
    </div>
  );
}
