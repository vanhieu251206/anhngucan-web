import ImageUploadField from "../ImageUploadField.jsx";
import AudioUploadField from "../AudioUploadField.jsx";
import CardFieldGroup from "../CardFieldGroup.jsx";

// Loại `mic` — xem Bài học/starters-1-test1-part1/phan-loai-scene.md mục 1 để tra cứu ý nghĩa
// từng biến thể/nhóm chấm. 3 biến thể ảnh: không ảnh / sceneImage+highlight / card (loại trừ nhau).
// Cách chấm: expectedYesNo ("yes"/"no"/"either") HOẶC expectedKeyword HOẶC không chấm (bỏ trống cả 2).
export default function MicSceneForm({ scene, onChange }) {
  const layout = scene.card ? "card" : scene.sceneImage ? "scene" : "none";
  const grading = scene.expectedYesNo ? "yesno" : scene.expectedKeyword ? "keyword" : "none";

  function setLayout(next) {
    if (next === "none") onChange({ sceneImage: null, highlight: null, card: null });
    if (next === "scene") onChange({ card: null });
    if (next === "card") onChange({ sceneImage: null, highlight: null, card: scene.card ?? { id: "", label: "", image: null } });
  }
  function setGrading(next) {
    if (next === "none") onChange({ expectedYesNo: undefined, expectedKeyword: undefined });
    if (next === "yesno") onChange({ expectedYesNo: "either", expectedKeyword: undefined });
    if (next === "keyword") onChange({ expectedYesNo: undefined, expectedKeyword: "" });
  }

  return (
    <div className="admin-scene-form">
      <label>
        Câu thoại giám khảo
        <input className="admin-input" value={scene.examinerLine ?? ""} onChange={e => onChange({ examinerLine: e.target.value })} />
      </label>
      <AudioUploadField label="Audio câu thoại" value={scene.audioUrl} onChange={audioUrl => onChange({ audioUrl })} />
      <label>
        Gợi ý trả lời (answerTemplate, có chỗ trống ....)
        <input className="admin-input" value={scene.answerTemplate ?? ""} onChange={e => onChange({ answerTemplate: e.target.value })} />
      </label>

      <fieldset className="admin-fieldset">
        <legend>Ảnh minh hoạ</legend>
        <select className="admin-input" value={layout} onChange={e => setLayout(e.target.value)}>
          <option value="none">Không ảnh</option>
          <option value="scene">Ảnh Scene + khoanh vùng</option>
          <option value="card">Thẻ đơn (Object card)</option>
        </select>
        {layout === "scene" && (
          <>
            <ImageUploadField label="Ảnh Scene" value={scene.sceneImage} onChange={sceneImage => onChange({ sceneImage })} />
            <p className="admin-muted-text">Kéo chuột trên ảnh xem trước bên phải để khoanh vùng (highlight).</p>
          </>
        )}
        {layout === "card" && <CardFieldGroup title="Thẻ" value={scene.card} onChange={card => onChange({ card })} />}
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Cách chấm</legend>
        <select className="admin-input" value={grading} onChange={e => setGrading(e.target.value)}>
          <option value="none">Không chấm (hỏi mở)</option>
          <option value="yesno">Yes/No</option>
          <option value="keyword">Từ khoá cụ thể</option>
        </select>
        {grading === "yesno" && (
          <select
            className="admin-input"
            value={scene.expectedYesNo}
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
