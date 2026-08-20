import { useState } from "react";
import ImageUploadField from "../ImageUploadField.jsx";
import CardFieldGroup from "../CardFieldGroup.jsx";

// Loại `mic` — xem Bài học/starters-1-test1-part1/phan-loai-scene.md mục 1 để tra cứu ý nghĩa
// từng biến thể/nhóm chấm. 3 biến thể ảnh: không ảnh / sceneImage+highlight / card (loại trừ nhau).
// Cách chấm: expectedYesNo ("yes"/"no"/"either") HOẶC expectedKeyword HOẶC không chấm (bỏ trống cả 2).
//
// layout/grading là STATE CỤC BỘ, không suy ra liên tục từ scene.sceneImage/expectedKeyword —
// vì lúc mới tick chọn (trước khi dán link ảnh hoặc gõ từ khoá), giá trị dữ liệu vẫn rỗng/falsy
// ("" hoặc undefined), suy ra kiểu cũ sẽ đọc nhầm thành "chưa chọn gì" và tự bỏ tick ngay lập tức
// (bug đã gặp 2026-08-20). State cục bộ được TestStudio reset đúng lúc bằng `key={selected}` mỗi
// khi đổi sang scene khác.
function keywordToText(expectedKeyword) {
  return Array.isArray(expectedKeyword) ? expectedKeyword.join(", ") : expectedKeyword ?? "";
}

export default function MicSceneForm({ scene, onChange }) {
  const [layout, setLayoutState] = useState(() => (scene.card ? "card" : scene.sceneImage != null ? "scene" : "none"));
  const [grading, setGradingState] = useState(() =>
    scene.expectedYesNo ? "yesno" : scene.expectedKeyword != null ? "keyword" : "none"
  );
  // Text nhập RỜI khỏi scene.expectedKeyword — gõ dấu phẩy để tách nhiều đáp án cùng đúng (vd
  // "phoning, talking") thì cần giữ nguyên chuỗi đang gõ (kể cả dấu phẩy/khoảng trắng cuối chưa
  // xong từ tiếp theo), không thể controlled trực tiếp bằng giá trị mảng đã tách+lọc rỗng ở trên.
  const [keywordText, setKeywordText] = useState(() => keywordToText(scene.expectedKeyword));

  function setKeyword(raw) {
    setKeywordText(raw);
    const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
    onChange({ expectedKeyword: parts.length > 1 ? parts : parts[0] ?? "" });
  }

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
    if (next === "keyword") {
      setKeywordText("");
      onChange({ expectedYesNo: undefined, expectedKeyword: "" });
    }
  }

  return (
    <div className="admin-scene-form">
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
          <span>Ảnh Scene</span>
        </label>
        {layout === "scene" && (
          <>
            <ImageUploadField value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />
            <p className="admin-muted-text">
              Không cần làm gì thêm nếu chỉ muốn hiện ảnh. Muốn khoanh vùng (tuỳ chọn) thì kéo chuột trên ảnh xem trước bên phải.
            </p>
            {scene.highlight && (
              <button type="button" className="admin-link-btn" onClick={() => onChange({ highlight: null })}>
                ✕ Xoá vùng đã khoanh
              </button>
            )}
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
          <label className="admin-mini-field">
            <span>Từ khoá đáp án — nhiều đáp án đều đúng thì cách nhau bằng dấu phẩy</span>
            <input
              className="admin-input"
              placeholder="vd: fish  hoặc  phoning, talking"
              value={keywordText}
              onChange={e => setKeyword(e.target.value)}
            />
          </label>
        )}
      </fieldset>
    </div>
  );
}
