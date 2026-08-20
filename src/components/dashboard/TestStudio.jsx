import { useState } from "react";
import MicSceneForm from "./scene-forms/MicSceneForm.jsx";
import NarrationSceneForm from "./scene-forms/NarrationSceneForm.jsx";
import SceneClickSceneForm from "./scene-forms/SceneClickSceneForm.jsx";
import CardSelectSceneForm from "./scene-forms/CardSelectSceneForm.jsx";
import DragDropSceneForm from "./scene-forms/DragDropSceneForm.jsx";
import ScenePreview from "./ScenePreview.jsx";

const TEMPLATES = [
  { type: "mic", icon: "🎤", label: "Câu hỏi mic", desc: "Học sinh trả lời bằng giọng nói" },
  { type: "narration", icon: "💬", label: "Lời dẫn", desc: "Giám khảo nói, không cần trả lời" },
  { type: "scene-click", icon: "👆", label: "Chạm vào tranh", desc: "Bấm đúng vị trí trong ảnh Scene" },
  { type: "card-select", icon: "🗂️", label: "Chọn thẻ", desc: "Chọn đúng 1 trong 4 thẻ" },
  { type: "drag-drop", icon: "🧩", label: "Kéo-thả", desc: "Kéo thẻ vào đúng vị trí trên ảnh" },
];
const FORMS = {
  mic: MicSceneForm,
  narration: NarrationSceneForm,
  "scene-click": SceneClickSceneForm,
  "card-select": CardSelectSceneForm,
  "drag-drop": DragDropSceneForm,
};
function templateOf(type) {
  return TEMPLATES.find(t => t.type === type);
}

function defaultScene(type) {
  const base = { type, examinerLine: "", audioUrl: null };
  if (type === "mic") return { ...base, answerTemplate: "" };
  if (type === "card-select")
    return {
      ...base,
      options: [
        { id: "", label: "", image: null },
        { id: "", label: "", image: null },
        { id: "", label: "", image: null },
        { id: "", label: "", image: null },
      ],
      correctId: "",
    };
  if (type === "drag-drop") return { ...base, card: { id: "", label: "", image: null }, target: null };
  return base;
}

// Màn thiết kế bài Speaking riêng biệt kiểu Canva: đổi tên Test ở top bar, form nhập liệu ở
// sidebar trái theo đúng scene đang chọn, xem trước Y HỆT giao diện thật ở giữa, danh sách scene
// dạng filmstrip kéo-thả sắp xếp lại ở dưới cùng. Thay cho SceneListBuilder/SceneEditorForm cũ
// (2 màn tách rời: 1 danh sách + 1 form-preview riêng) — giờ gộp thành 1 màn full-screen duy nhất.
export default function TestStudio({ accent, title, onTitleChange, scenes, onScenesChange, onBack, onSave, saving, saved }) {
  const [selected, setSelected] = useState(scenes.length ? 0 : null);
  const [pickingTemplate, setPickingTemplate] = useState(scenes.length === 0);
  const [dragIndex, setDragIndex] = useState(null);
  const scene = selected !== null ? scenes[selected] : null;
  const Form = scene ? FORMS[scene.type] : null;

  function addScene(type) {
    const next = [...scenes, defaultScene(type)];
    onScenesChange(next);
    setPickingTemplate(false);
    setSelected(next.length - 1);
  }
  function updateScene(patch) {
    if (selected === null) return;
    const next = [...scenes];
    next[selected] = { ...next[selected], ...patch };
    onScenesChange(next);
  }
  function deleteScene(i) {
    const next = scenes.filter((_, idx) => idx !== i);
    onScenesChange(next);
    if (next.length === 0) {
      setSelected(null);
    } else if (i < selected) {
      setSelected(selected - 1);
    } else if (i === selected) {
      setSelected(Math.min(selected, next.length - 1));
    }
  }
  function duplicateScene(i) {
    const next = [...scenes];
    next.splice(i + 1, 0, { ...scenes[i] });
    onScenesChange(next);
    setSelected(i + 1);
  }
  function reorder(from, to) {
    if (from === to) return;
    const next = [...scenes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onScenesChange(next);
    setSelected(to);
  }

  // "Lưu" nghe nhẹ nhàng như đang soạn nháp, nhưng thật ra ghi thẳng lên Firestore — học sinh
  // thấy ngay lập tức, không có bước duyệt/nháp riêng. Đổi tên nút thành "Xuất bản" + xác nhận
  // trước khi ghi, để admin/giáo viên ý thức rõ đây là hành động công khai ngay trên web.
  function handlePublish() {
    if (window.confirm("Bài này sẽ hiển thị ngay trên website cho học sinh. Xuất bản?")) {
      onSave();
    }
  }

  return (
    <div className="studio-shell" style={accent ? { "--accent": accent } : undefined}>
      <div className="studio-topbar">
        <button className="admin-pill-btn" onClick={onBack}>← Quay lại</button>
        <input
          className="studio-title-input"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Tên Test"
        />
        <div className="studio-topbar-actions">
          {saved && <span className="admin-success">✓ Đã xuất bản</span>}
          <button className="admin-btn-primary" onClick={handlePublish} disabled={saving}>
            {saving ? "Đang xuất bản..." : "Xuất bản"}
          </button>
        </div>
      </div>

      <div className="studio-body">
        <aside className="studio-sidebar">
          {!scene && <p className="admin-muted-text">Chọn hoặc thêm 1 scene bên dưới để bắt đầu soạn.</p>}
          {scene && (
            <>
              <div className="studio-sidebar-head">
                <span className="studio-sidebar-type">
                  {templateOf(scene.type)?.icon} {templateOf(scene.type)?.label}
                </span>
                <div className="studio-sidebar-actions">
                  <button className="admin-link-btn" onClick={() => duplicateScene(selected)}>Nhân bản</button>
                  <button className="admin-link-btn admin-pill-btn-danger" onClick={() => deleteScene(selected)}>Xoá</button>
                </div>
              </div>
              <Form key={selected} scene={scene} onChange={updateScene} />
            </>
          )}
        </aside>

        <main className="studio-preview-area">
          {scene ? (
            <ScenePreview scene={scene} onChange={updateScene} />
          ) : (
            <div className="admin-empty-state">
              <span className="admin-empty-state-icon">🎬</span>
              <p>Chưa có scene nào — bấm "+ Thêm scene" bên dưới để bắt đầu.</p>
            </div>
          )}
        </main>
      </div>

      <div className="studio-filmstrip">
        <div className="studio-filmstrip-track">
          {scenes.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`studio-filmchip${i === selected ? " is-active" : ""}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              onClick={() => setSelected(i)}
              title={s.examinerLine || templateOf(s.type)?.label}
            >
              <span className="studio-filmchip-index">{i + 1}</span>
              <span className="studio-filmchip-icon">{templateOf(s.type)?.icon}</span>
              <span className="studio-filmchip-label">{s.examinerLine || templateOf(s.type)?.label}</span>
            </button>
          ))}
          <button type="button" className="studio-filmchip studio-filmchip-add" onClick={() => setPickingTemplate(v => !v)}>
            + Thêm scene
          </button>
        </div>

        {pickingTemplate && (
          <div className="studio-template-popover">
            {TEMPLATES.map(t => (
              <button key={t.type} type="button" className="admin-template-tile" onClick={() => addScene(t.type)}>
                <strong>{t.icon} {t.label}</strong>
                <span>{t.desc}</span>
              </button>
            ))}
            <button type="button" className="admin-link-btn" onClick={() => setPickingTemplate(false)}>Huỷ</button>
          </div>
        )}
      </div>
    </div>
  );
}
