import MicSceneForm from "./scene-forms/MicSceneForm.jsx";
import NarrationSceneForm from "./scene-forms/NarrationSceneForm.jsx";
import SceneClickSceneForm from "./scene-forms/SceneClickSceneForm.jsx";
import CardSelectSceneForm from "./scene-forms/CardSelectSceneForm.jsx";
import DragDropSceneForm from "./scene-forms/DragDropSceneForm.jsx";
import ScenePreview from "./ScenePreview.jsx";

// Điều phối sang đúng form theo scene.type — xem Bài học/starters-1-test1-part1/phan-loai-scene.md
// để tra field từng loại. Mỗi form chỉ hiện đúng field cần cho loại/biến thể đó.
const FORMS = {
  mic: MicSceneForm,
  narration: NarrationSceneForm,
  "scene-click": SceneClickSceneForm,
  "card-select": CardSelectSceneForm,
  "drag-drop": DragDropSceneForm,
};

// Bố cục 2 cột: form nhập liệu bên trái, xem trước Y HỆT giao diện thật bên phải (ScenePreview) —
// vùng toạ độ (target/highlight/demoCard.target) sửa trực tiếp bằng kéo chuột trên preview đó.
export default function SceneEditorForm({ scene, onChange }) {
  const Form = FORMS[scene.type];
  if (!Form) return <p className="admin-error">Loại scene không hợp lệ: {scene.type}</p>;
  const patch = p => onChange({ ...scene, ...p });
  return (
    <div className="admin-scene-editor-split">
      <div className="admin-scene-editor-form-col">
        <Form scene={scene} onChange={patch} />
      </div>
      <div className="admin-scene-editor-preview-col">
        <ScenePreview scene={scene} onChange={patch} />
      </div>
    </div>
  );
}
