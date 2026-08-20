import { useState } from "react";
import ImageUploadField from "../ImageUploadField.jsx";
import CardFieldGroup from "../CardFieldGroup.jsx";
import SceneLineFields from "./SceneLineFields.jsx";

// Loại `mic` — xem Bài học/starters-1-test1-part1/phan-loai-scene.md mục 1 để tra cứu ý nghĩa
// từng biến thể/nhóm chấm. 3 biến thể ảnh: không ảnh / sceneImage+highlight / card (loại trừ nhau).
// Cách chấm: expectedYesNo ("yes"/"no"/"either") HOẶC expectedKeyword HOẶC không chấm (bỏ trống cả 2).
//
// layout/grading là STATE CỤC BỘ, không suy ra liên tục từ scene.sceneImage/expectedKeyword —
// vì lúc mới tick chọn (trước khi dán link ảnh hoặc gõ từ khoá), giá trị dữ liệu vẫn rỗng/falsy
// ("" hoặc undefined), suy ra kiểu cũ sẽ đọc nhầm thành "chưa chọn gì" và tự bỏ tick ngay lập tức
// (bug đã gặp 2026-08-20). State cục bộ được TestStudio reset đúng lúc bằng `key={selected}` mỗi
// khi đổi sang scene khác.
export default function MicSceneForm({ scene, onChange }) {
  const [layout, setLayoutState] = useState(() => (scene.card ? "card" : scene.sceneImage != null ? "scene" : "none"));
  const [grading, setGradingState] = useState(() =>
    scene.expectedYesNo ? "yesno" : scene.expectedKeyword != null ? "keyword" : "none"
  );

  function setLayout(next) {
    setLayoutState(next);
    if (next === "none") onChange({ sceneImage: null, highlight: null, card: null });
    if (next === "scene") onChange({ card: null, sceneImage: scene.sceneImage ?? "" });
    if (next === "card") onChange({ sceneImage: null, highlight: null, card: scene.card ?? { id: "", label: "", image: null } });
  }
  function setGrading(next) {
    setGradingState(next);
    if (next === "none") onChange({ expectedYesNo: undefined, expectedKeyword: undefined });
    if (next === "yesno") onChange({ expectedYesNo: "either", expectedKeyword: undefined });
    if (next === "keyword") onChange({ expectedYesNo: undefined, expectedKeyword: "" });
  }

  return (
    <div className="admin-scene-form">
      <SceneLineFields scene={scene} onChange={onChange} />

      <label className="admin-mini-field">
        <span>Gợi ý trả lời (chỗ trống dùng ....)</span>
        <input
          className="admin-input"
          placeholder="vd: .... a fish."
          value={scene.answerTemplate ?? ""}
          onChange={e => onChange({ answerTemplate: e.target.value })}
        />
      </label>

      <fieldset className="admin-fieldset">
        <legend>🖼️ Ảnh minh hoạ</legend>
        <label className="admin-checkbox-row">
          <input
            type="checkbox"
            checked={layout === "scene"}
            onChange={e => setLayout(e.target.checked ? "scene" : "none")}
          />
          <span>Ảnh Scene + khoanh vùng</span>
        </label>
        {layout === "scene" && (
          <>
            <ImageUploadField value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />
            <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để khoanh vùng (highlight).</p>
          </>
        )}
        <label className="admin-checkbox-row">
          <input
            type="checkbox"
            checked={layout === "card"}
            onChange={e => setLayout(e.target.checked ? "card" : "none")}
          />
          <span>Thẻ đơn (Object card)</span>
        </label>
        {layout === "card" && <CardFieldGroup title="Thẻ" value={scene.card} onChange={card => onChange({ card })} />}
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>✅ Cách chấm</legend>
        <select className="admin-input" value={grading} onChange={e => setGrading(e.target.value)}>
          <option value="none">Không chấm (hỏi mở)</option>
          <option value="yesno">Yes/No</option>
          <option value="keyword">Từ khoá cụ thể</option>
        </select>
        {grading === "yesno" && (
          <select
            className="admin-input"
            value={scene.expectedYesNo ?? "either"}
            onChange={e => onChange({ expectedYesNo: e.target.value })}
          >
            <option value="yes">Cố định: Yes</option>
            <option value="no">Cố định: No</option>
            <option value="either">Cá nhân: cả 2 đều đúng</option>
          </select>
        )}
        {grading === "keyword" && (
          <input
            className="admin-input"
            placeholder="Từ khoá đáp án (vd: fish)"
            value={scene.expectedKeyword ?? ""}
            onChange={e => onChange({ expectedKeyword: e.target.value })}
          />
        )}
      </fieldset>
    </div>
  );
}
