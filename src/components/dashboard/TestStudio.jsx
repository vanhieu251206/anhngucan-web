import { useLayoutEffect, useRef, useState } from "react";
import MicSceneForm from "./scene-forms/MicSceneForm.jsx";
import NarrationSceneForm from "./scene-forms/NarrationSceneForm.jsx";
import SceneClickSceneForm from "./scene-forms/SceneClickSceneForm.jsx";
import CardSelectSceneForm from "./scene-forms/CardSelectSceneForm.jsx";
import DragDropSceneForm from "./scene-forms/DragDropSceneForm.jsx";
import SceneLineFields from "./scene-forms/SceneLineFields.jsx";
import ScenePreview from "./ScenePreview.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";

// Tỉ lệ đúng khung thẻ thật ở màn Speaking học sinh — PHẢI khớp CARD_RATIO trong ScenePreview.jsx.
const PREVIEW_CARD_RATIO = 600 / 640;

// Khung xem trước (.studio-preview-area) KHÔNG được chiếm cứng 1 tỉ lệ màn hình cố định (vd 50vw)
// — sẽ để trống 1 mảng lớn bên trong nếu card thực tế nhỏ hơn (card luôn bị giới hạn bởi CHIỀU
// CAO khả dụng vì tỉ lệ 600:640 khá "đứng"), làm phí không gian lẽ ra sidebar form có thể dùng.
// Thay vào đó: đo CHIỀU CAO thật (luôn xác định được ngay cả khi width chưa biết, nhờ flexbox
// stretch chiều cao theo hàng), tự tính width = height × tỉ lệ, rồi áp CHÍNH XÁC width đó cho
// khung ngoài — sidebar chiếm phần còn lại, không còn khoảng trống thừa (chốt 2026-08-23).
function usePreviewAreaWidth(ratio) {
  const ref = useRef(null);
  const [width, setWidth] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function measure() {
      const h = el.clientHeight;
      if (!h) return;
      setWidth(h * ratio);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);
  return { ref, width };
}

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

// Scene mới luôn bắt đầu KHÔNG có hành động (type: null) — câu dẫn/audio nhập trước, chọn hành
// động sau (xem TestStudio bên dưới). Đây là phần chung mọi loại scene đều có.
function blankScene() {
  return { type: null, examinerLine: "", audioUrl: null };
}

// Field riêng theo từng loại hành động — gắn kèm base (examinerLine/audioUrl) hiện có của scene
// khi người soạn chọn/đổi hành động, để không mất câu dẫn đã gõ trước đó.
function extraFieldsOf(type) {
  if (type === "mic") return { answerTemplate: "" };
  if (type === "card-select")
    return {
      options: [
        { id: "", label: "", image: null },
        { id: "", label: "", image: null },
        { id: "", label: "", image: null },
        { id: "", label: "", image: null },
      ],
      correctIds: [],
    };
  if (type === "drag-drop") return { card: { id: "", label: "", image: null }, target: null };
  return {};
}

// Màn thiết kế bài Speaking riêng biệt kiểu Canva: đổi tên Test ở top bar, form nhập liệu ở
// sidebar trái theo đúng scene đang chọn, xem trước Y HỆT giao diện thật ở giữa, danh sách scene
// dạng filmstrip kéo-thả sắp xếp lại ở dưới cùng.
//
// Sidebar CỐ ĐỊNH: câu dẫn/câu hỏi (SceneLineFields) luôn ở đầu tiên, không phụ thuộc scene đã
// chọn hành động hay chưa. Sau đó mới đến việc chọn hành động (5 ô như cũ, nhưng nằm ngay trong
// sidebar thay vì popover riêng) — chọn xong mới hiện tiếp phần nội dung/ảnh riêng của hành động
// đó. Thay cho luồng cũ (bắt buộc chọn loại scene trước khi soạn được gì).
export default function TestStudio({ accent, title, onTitleChange, scenes, onScenesChange, onBack, onSave, saving, saved }) {
  const { ref: previewAreaRef, width: previewAreaWidth } = usePreviewAreaWidth(PREVIEW_CARD_RATIO);
  const [selected, setSelected] = useState(scenes.length ? 0 : null);
  const [dragIndex, setDragIndex] = useState(null);
  const scene = selected !== null ? scenes[selected] : null;
  const Form = scene?.type ? FORMS[scene.type] : null;

  function addScene() {
    const next = [...scenes, blankScene()];
    onScenesChange(next);
    setSelected(next.length - 1);
  }
  function updateScene(patch) {
    if (selected === null) return;
    const next = [...scenes];
    next[selected] = { ...next[selected], ...patch };
    onScenesChange(next);
  }
  function chooseAction(type) {
    updateScene({ type, ...extraFieldsOf(type) });
  }
  function changeAction() {
    // Quay lại chọn hành động khác — giữ nguyên câu dẫn/audio, xoá field riêng của hành động cũ.
    updateScene({ type: null });
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
  const confirm = useConfirm();
  async function handlePublish() {
    if (await confirm("Bài này sẽ hiển thị ngay trên website cho học sinh. Xuất bản?")) {
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
                  {scene.type ? `${templateOf(scene.type)?.icon} ${templateOf(scene.type)?.label}` : "Scene mới"}
                </span>
                <div className="studio-sidebar-actions">
                  <button className="admin-link-btn" onClick={() => duplicateScene(selected)}>Nhân bản</button>
                  <button className="admin-link-btn admin-pill-btn-danger" onClick={() => deleteScene(selected)}>Xoá</button>
                </div>
              </div>

              <div className="admin-scene-form">
                <SceneLineFields scene={scene} onChange={updateScene} />

                {scene.type ? (
                  <>
                    <button type="button" className="admin-link-btn studio-change-action-btn" onClick={changeAction}>
                      ↺ Đổi hành động
                    </button>
                    <Form key={`${selected}-${scene.type}`} scene={scene} onChange={updateScene} />
                  </>
                ) : (
                  <fieldset className="admin-fieldset">
                    <legend>⚡ Chọn hành động</legend>
                    <div className="studio-action-grid">
                      {TEMPLATES.map(t => (
                        <button
                          key={t.type}
                          type="button"
                          className="admin-template-tile"
                          onClick={() => chooseAction(t.type)}
                        >
                          <strong>{t.icon} {t.label}</strong>
                          <span>{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            </>
          )}
        </aside>

        <main
          className="studio-preview-area"
          ref={previewAreaRef}
          style={previewAreaWidth ? { flexBasis: previewAreaWidth, width: previewAreaWidth } : undefined}
        >
          {scene?.type ? (
            <ScenePreview scene={scene} onChange={updateScene} />
          ) : (
            <div className="admin-empty-state">
              <span className="admin-empty-state-icon">🎬</span>
              <p>
                {scene
                  ? "Chọn 1 hành động ở sidebar bên trái để xem trước."
                  : 'Chưa có scene nào — bấm "+ Thêm scene" bên dưới để bắt đầu.'}
              </p>
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
              title={s.examinerLine || templateOf(s.type)?.label || "Scene mới"}
            >
              <span className="studio-filmchip-index">{i + 1}</span>
              <span className="studio-filmchip-icon">{templateOf(s.type)?.icon ?? "❓"}</span>
              <span className="studio-filmchip-label">{s.examinerLine || templateOf(s.type)?.label || "Chưa chọn hành động"}</span>
            </button>
          ))}
          <button type="button" className="studio-filmchip studio-filmchip-add" onClick={addScene}>
            + Thêm scene
          </button>
        </div>
      </div>
    </div>
  );
}
