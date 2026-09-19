import ImageUploadField from "./ImageUploadField.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { useRectDraw } from "./ScenePreview.jsx";
import { PALETTE } from "../StartersListeningPart4.jsx";

// CMS Luyện đề Listening Starters — Part 4 (nghe và tô màu): mỗi câu có màu đúng + khung toạ độ bao quanh
// cái bánh cần tô (kéo chuột trên ảnh xem trước, giống Part 1). Học sinh tô trên ảnh; câu đúng khi màu phủ
// trong khung khớp màu đúng. Ví dụ đã tô sẵn trong ảnh nên không cần soạn. Mặc định gán sẵn màu theo đề
// Test 1 (pink, yellow, orange, green, blue).
const DEFAULT_COLORS = ["pink", "yellow", "orange", "green", "blue"];

export function blankPart4() {
  return {
    audioUrl: "",
    imageUrl: "",
    items: DEFAULT_COLORS.map((color, i) => ({ id: `q${i + 1}`, color, frame: null })),
  };
}

export function normalizePart4(raw) {
  const base = blankPart4();
  if (!raw) return base;
  return {
    audioUrl: raw.audioUrl ?? "",
    imageUrl: raw.imageUrl ?? "",
    items: base.items.map(b => {
      const r = raw.items?.find(i => i.id === b.id);
      if (!r) return b;
      // Dữ liệu dạng điểm chạm (bản cũ) → khung nhỏ quanh điểm đó.
      const frame = r.frame ?? (r.point ? { x: Math.max(0, r.point.x - 4), y: Math.max(0, r.point.y - 4), w: 8, h: 8 } : null);
      return { id: b.id, color: r.color ?? b.color, frame };
    }),
  };
}

export function part4HasContent(part) {
  return !!part.imageUrl && part.items.some(i => i.frame);
}

export function validatePart4(part) {
  if (part.items.some(i => i.frame) && !part.imageUrl) return "Part 4: chưa có ảnh tranh.";
  const bad = part.items.find(i => i.frame && !i.color);
  if (bad) return `Part 4: Câu ${bad.id.slice(1)} chưa chọn màu.`;
  return null;
}

export function Part4Editor({ part, onChange, activeId, onActiveId }) {
  function setItem(id, patch) {
    onChange({ ...part, items: part.items.map(i => (i.id === id ? { ...i, ...patch } : i)) });
  }
  const done = part.items.filter(i => i.frame).length;

  return (
    <div className="admin-form p1e">
      <fieldset className="admin-fieldset">
        <legend>🎧 Audio Part 4</legend>
        <AudioUploadField value={part.audioUrl} onChange={v => onChange({ ...part, audioUrl: v ?? "" })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🖼️ Ảnh tranh (line art)</legend>
        <ImageUploadField value={part.imageUrl} onChange={v => onChange({ ...part, imageUrl: v ?? "" })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🎨 Đáp án tô màu <span className="admin-scene-count-badge">{done}/{part.items.length} câu</span></legend>
        <div className="p1e-pairs">
          {part.items.map(it => {
            const active = activeId === it.id;
            return (
              <div className={`p1e-pair${it.frame ? " is-full" : ""}`} key={it.id}>
                <div className="p1e-pair-head">
                  <span className="p1e-pair-num">{it.id.slice(1)}</span>
                  <strong className="p1e-pair-title">Câu {it.id.slice(1)}</strong>
                  <span className={`p1e-pair-status${it.frame ? " is-ok" : ""}`}>{it.frame ? "Đã có khung" : "Trống"}</span>
                  <button
                    type="button"
                    className="p1e-clear"
                    disabled={!it.frame}
                    onClick={() => { setItem(it.id, { frame: null }); if (active) onActiveId(null); }}
                    title="Xoá khung"
                  >✕</button>
                </div>
                <div className="p4e-colors">
                  {PALETTE.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`p4e-color${it.color === p.id ? " is-active" : ""}`}
                      style={{ "--c": p.hex }}
                      title={p.name}
                      onClick={() => setItem(it.id, { color: p.id })}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className={`p1e-slot is-a${active ? " is-active" : ""}${it.frame ? " is-done" : ""}`}
                  disabled={!part.imageUrl}
                  onClick={() => onActiveId(active ? null : it.id)}
                >
                  <span className="p1e-slot-dot" />
                  <span className="p1e-slot-text">
                    <strong>Khung bánh</strong>
                    <small>{active ? "Kéo trên ảnh..." : it.frame ? "✓ Đã vẽ" : "Chưa vẽ"}</small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

// Xem trước: ảnh + khung của từng câu (viền theo màu đúng) — cũng là nơi kéo chuột vẽ khung.
export function Part4Preview({ part, onChange, activeId, onActiveId }) {
  function commit(rect) {
    if (!activeId) return;
    onChange({ ...part, items: part.items.map(i => (i.id === activeId ? { ...i, frame: rect } : i)) });
    onActiveId(null);
  }
  const { stageRef, liveRect, handlers } = useRectDraw(commit);
  const count = part.items.filter(i => i.frame).length;

  return (
    <div className="admin-reading-preview-panel">
      <h3>Thông tin chung của bài tập</h3>
      <div className="admin-reading-preview-stats">
        <span>Tổng Part: <strong>1</strong></span>
        <span>Tổng số câu: <strong>{count}</strong></span>
      </div>
      <div className="admin-reading-preview-head"><h3>Xem trước bài</h3></div>
      <h2 className="p2s-title">Part 4</h2>
      <p className="p2s-count">– {count} questions –</p>
      <p className="p2s-instr">Listen and colour. There is one example.</p>
      {part.audioUrl && <audio className="p2r-audio" src={part.audioUrl} controls />}
      {part.imageUrl ? (
        <div
          ref={stageRef}
          className="admin-p1-pair-stage"
          {...(activeId ? handlers : {})}
          style={{ cursor: activeId ? "crosshair" : "default", touchAction: activeId ? "none" : "auto" }}
        >
          <img src={part.imageUrl} alt="" draggable={false} />
          {part.items.map(it => {
            const c = PALETTE.find(p => p.id === it.color);
            return it.frame ? (
              <div
                key={it.id}
                className="admin-p1-frame p4e-frame"
                style={{ left: `${it.frame.x}%`, top: `${it.frame.y}%`, width: `${it.frame.w}%`, height: `${it.frame.h}%`, "--c": c?.hex }}
              >
                <span>{it.id.slice(1)} · {c?.name}</span>
              </div>
            ) : null;
          })}
          {liveRect && (
            <div
              className="admin-p1-frame is-live"
              style={{ left: `${liveRect.x}%`, top: `${liveRect.y}%`, width: `${liveRect.w}%`, height: `${liveRect.h}%` }}
            />
          )}
        </div>
      ) : (
        <p className="admin-muted-text">Chưa có ảnh tranh.</p>
      )}
    </div>
  );
}
