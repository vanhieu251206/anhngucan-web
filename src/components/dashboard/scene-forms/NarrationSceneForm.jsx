import { useState } from "react";
import ImageUploadField from "../ImageUploadField.jsx";
import CardFieldGroup from "../CardFieldGroup.jsx";
import SceneLineFields from "./SceneLineFields.jsx";

// Loại `narration` — không cần học sinh trả lời, chỉ nghe + xem. Tuỳ chọn thêm `highlight`
// (khoanh vùng chỉ xem) HOẶC `demoCard` (giám khảo làm mẫu đặt thẻ) — 2 cái loại trừ nhau.
//
// `extra` là STATE CỤC BỘ, không suy ra liên tục từ scene.highlight — vì highlight chỉ có giá
// trị SAU KHI kéo chuột vẽ vùng trên ảnh xem trước (ScenePreview), tick chọn "highlight" xong
// chưa vẽ gì thì scene.highlight vẫn null → suy ra kiểu cũ đọc nhầm "chưa chọn" và tự bỏ tick
// ngay (bug đã gặp 2026-08-20). TestStudio reset state này bằng `key={selected}` khi đổi scene.
export default function NarrationSceneForm({ scene, onChange }) {
  const [extra, setExtraState] = useState(() => (scene.demoCard ? "demo" : scene.highlight ? "highlight" : "none"));

  function setExtra(next) {
    setExtraState(next);
    if (next === "none") onChange({ highlight: null, demoCard: null });
    if (next === "highlight") onChange({ demoCard: null });
    if (next === "demo")
      onChange({ highlight: null, demoCard: scene.demoCard ?? { card: { id: "", label: "", image: null }, target: null } });
  }

  return (
    <div className="admin-scene-form">
      <SceneLineFields scene={scene} onChange={onChange} />

      <fieldset className="admin-fieldset">
        <legend>🖼️ Ảnh Scene</legend>
        <ImageUploadField value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>➕ Tuỳ chọn thêm</legend>
        <label className="admin-checkbox-row">
          <input
            type="checkbox"
            checked={extra === "highlight"}
            onChange={e => setExtra(e.target.checked ? "highlight" : "none")}
          />
          <span>Khoanh vùng chỉ xem (highlight)</span>
        </label>
        {extra === "highlight" && (
          <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để khoanh vùng.</p>
        )}
        <label className="admin-checkbox-row">
          <input
            type="checkbox"
            checked={extra === "demo"}
            onChange={e => setExtra(e.target.checked ? "demo" : "none")}
          />
          <span>Giám khảo làm mẫu đặt thẻ (Object card)</span>
        </label>
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
