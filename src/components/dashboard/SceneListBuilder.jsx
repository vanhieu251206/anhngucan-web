import { useState } from "react";
import SceneEditorForm from "./SceneEditorForm.jsx";

const TEMPLATES = [
  { type: "mic", label: "Câu hỏi mic", desc: "Học sinh trả lời bằng giọng nói" },
  { type: "narration", label: "Lời dẫn", desc: "Giám khảo nói, không cần trả lời" },
  { type: "scene-click", label: "Chạm vào tranh", desc: "Bấm đúng vị trí trong ảnh Scene" },
  { type: "card-select", label: "Chọn thẻ", desc: "Chọn đúng 1 trong 4 thẻ" },
  { type: "drag-drop", label: "Kéo-thả", desc: "Kéo thẻ vào đúng vị trí trên ảnh" },
];

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

function sceneSummary(scene) {
  const typeLabel = TEMPLATES.find(t => t.type === scene.type)?.label ?? scene.type;
  const line = scene.examinerLine ? `"${scene.examinerLine}"` : "(chưa có câu thoại)";
  return `${typeLabel} — ${line}`;
}

// Danh sách "slide" scene kiểu Canva/PowerPoint: thêm/sửa/xoá/nhân bản/sắp xếp lại thứ tự.
// Component có kiểm soát (controlled) — nhận `scenes` + báo lại qua `onChange` toàn bộ mảng mới.
export default function SceneListBuilder({ scenes, onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [pickingTemplate, setPickingTemplate] = useState(false);

  function addScene(type) {
    const next = [...scenes, defaultScene(type)];
    onChange(next);
    setPickingTemplate(false);
    setEditingIndex(next.length - 1);
  }
  function updateScene(i, scene) {
    const next = [...scenes];
    next[i] = scene;
    onChange(next);
  }
  function deleteScene(i) {
    onChange(scenes.filter((_, idx) => idx !== i));
    setEditingIndex(null);
  }
  function duplicateScene(i) {
    const next = [...scenes];
    next.splice(i + 1, 0, { ...scenes[i] });
    onChange(next);
  }
  function moveScene(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= scenes.length) return;
    const next = [...scenes];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  if (editingIndex !== null) {
    return (
      <div className="admin-card">
        <div className="admin-scene-editor-head">
          <strong>Sửa scene {editingIndex + 1}/{scenes.length}</strong>
          <button className="admin-pill-btn" onClick={() => setEditingIndex(null)}>
            ← Xong, quay lại danh sách
          </button>
        </div>
        <SceneEditorForm scene={scenes[editingIndex]} onChange={scene => updateScene(editingIndex, scene)} />
      </div>
    );
  }

  return (
    <div className="admin-card">
      <div className="admin-scene-editor-head">
        <strong>Danh sách scene ({scenes.length})</strong>
        <button className="admin-btn-primary" onClick={() => setPickingTemplate(true)}>
          + Thêm scene
        </button>
      </div>

      {pickingTemplate && (
        <div className="admin-template-grid">
          {TEMPLATES.map(t => (
            <button key={t.type} className="admin-template-tile" onClick={() => addScene(t.type)}>
              <strong>{t.label}</strong>
              <span>{t.desc}</span>
            </button>
          ))}
          <button className="admin-link-btn" onClick={() => setPickingTemplate(false)}>
            Huỷ
          </button>
        </div>
      )}

      {scenes.length === 0 && !pickingTemplate && <p className="admin-muted-text">Chưa có scene nào.</p>}

      <ul className="admin-scene-list">
        {scenes.map((scene, i) => (
          <li key={i} className="admin-scene-list-item">
            <span className="admin-scene-list-index">{i + 1}</span>
            <span className="admin-scene-list-summary">{sceneSummary(scene)}</span>
            <span className="admin-scene-list-actions">
              <button className="admin-link-btn" onClick={() => moveScene(i, -1)} disabled={i === 0}>↑</button>
              <button className="admin-link-btn" onClick={() => moveScene(i, 1)} disabled={i === scenes.length - 1}>↓</button>
              <button className="admin-link-btn" onClick={() => setEditingIndex(i)}>Sửa</button>
              <button className="admin-link-btn" onClick={() => duplicateScene(i)}>Nhân bản</button>
              <button className="admin-link-btn admin-pill-btn-danger" onClick={() => deleteScene(i)}>Xoá</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
