import ImageUploadField from "../ImageUploadField.jsx";
import AudioUploadField from "../AudioUploadField.jsx";
import CardFieldGroup from "../CardFieldGroup.jsx";

// Loại `drag-drop` — học sinh kéo 1 thẻ vào đúng vị trí trên ảnh Scene. Duy nhất loại có thêm
// followupLine/followupAudioUrl (đọc thêm câu hỏi phụ tại chỗ sau khi đúng, không tách scene).
export default function DragDropSceneForm({ scene, onChange }) {
  const target = scene.target ?? {};
  return (
    <div className="admin-scene-form">
      <label>
        Câu thoại giám khảo
        <input className="admin-input" value={scene.examinerLine ?? ""} onChange={e => onChange({ examinerLine: e.target.value })} />
      </label>
      <AudioUploadField label="Audio câu thoại" value={scene.audioUrl} onChange={audioUrl => onChange({ audioUrl })} />
      <ImageUploadField label="Ảnh Scene" value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />
      <CardFieldGroup title="Thẻ để kéo" value={scene.card} onChange={card => onChange({ card })} />
      <fieldset className="admin-fieldset">
        <legend>Vị trí thả đúng (target)</legend>
        <input
          className="admin-input"
          placeholder="id (vd: watermelons)"
          value={target.id ?? ""}
          onChange={e => onChange({ target: { ...target, id: e.target.value } })}
        />
        <input
          className="admin-input"
          placeholder="Nhãn hiển thị (vd: between the watermelons)"
          value={target.label ?? ""}
          onChange={e => onChange({ target: { ...target, label: e.target.value } })}
        />
        <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để chọn vị trí thả.</p>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Câu hỏi phụ (đọc thêm tại chỗ, tuỳ chọn)</legend>
        <input
          className="admin-input"
          placeholder="Câu hỏi phụ + đáp án (vd: Between the watermelons.)"
          value={scene.followupLine ?? ""}
          onChange={e => onChange({ followupLine: e.target.value })}
        />
        <AudioUploadField label="Audio câu hỏi phụ" value={scene.followupAudioUrl} onChange={followupAudioUrl => onChange({ followupAudioUrl })} />
      </fieldset>
    </div>
  );
}
