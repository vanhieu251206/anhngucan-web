import { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { PALETTE, hexOf, buildMask, paintScene, regionOf, useLineArt } from "../StartersListeningPart4.jsx";

// CMS Luyện đề Listening Starters — Part 4 (nghe và tô màu): mỗi câu có màu đúng + vùng cái bánh do giáo
// viên tô sẵn ngay trên ảnh xem trước (chạm để tô nhanh vùng kín, hoặc cọ/tẩy cho chuẩn). Học sinh chọn màu
// bất kỳ rồi chạm bánh thì vùng này hiện màu đó; câu đúng khi màu trùng màu đúng. Ảnh xem trước hiện đúng
// như học sinh sẽ thấy khi tô đúng đáp án. Ví dụ đã tô sẵn trong ảnh nên không cần soạn. Mặc định gán sẵn
// màu theo đề Test 1 (pink, yellow, orange, green, blue).
const DEFAULT_COLORS = ["pink", "yellow", "orange", "green", "blue"];

export function blankPart4() {
  return {
    audioUrl: "",
    imageUrl: "",
    items: DEFAULT_COLORS.map((color, i) => ({ id: `q${i + 1}`, color, ops: [] })),
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
      return r ? { id: b.id, color: r.color ?? b.color, ops: r.ops ?? [] } : b;
    }),
  };
}

export function part4HasContent(part) {
  return !!part.imageUrl && part.items.some(i => i.ops?.length);
}

export function validatePart4(part) {
  if (part.items.some(i => i.ops?.length) && !part.imageUrl) return "Part 4: chưa có ảnh tranh.";
  const bad = part.items.find(i => i.ops?.length && !i.color);
  if (bad) return `Part 4: Câu ${bad.id.slice(1)} chưa chọn màu.`;
  return null;
}

export function Part4Editor({ part, onChange, activeId, onActiveId }) {
  function setItem(id, patch) {
    onChange({ ...part, items: part.items.map(i => (i.id === id ? { ...i, ...patch } : i)) });
  }
  const done = part.items.filter(i => i.ops?.length).length;

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
            const has = !!it.ops?.length;
            return (
              <div className={`p1e-pair${has ? " is-full" : ""}`} key={it.id}>
                <div className="p1e-pair-head">
                  <span className="p1e-pair-num">{it.id.slice(1)}</span>
                  <strong className="p1e-pair-title">Câu {it.id.slice(1)}</strong>
                  <span className={`p1e-pair-status${has ? " is-ok" : ""}`}>{has ? "Đã tô" : "Trống"}</span>
                  <button
                    type="button"
                    className="p1e-clear"
                    disabled={!has}
                    onClick={() => setItem(it.id, { ops: it.ops.slice(0, -1) })}
                    title="Hoàn tác thao tác cuối"
                  >↶</button>
                  <button
                    type="button"
                    className="p1e-clear"
                    disabled={!has}
                    onClick={() => { setItem(it.id, { ops: [] }); if (active) onActiveId(null); }}
                    title="Xoá vùng đã tô"
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
                  className={`p1e-slot is-a${active ? " is-active" : ""}${has ? " is-done" : ""}`}
                  disabled={!part.imageUrl}
                  onClick={() => onActiveId(active ? null : it.id)}
                >
                  <span className="p1e-slot-dot" />
                  <span className="p1e-slot-text">
                    <strong>Tô vùng bánh</strong>
                    <small>{active ? "Đang tô trên ảnh..." : has ? "✓ Đã tô" : "Chưa tô"}</small>
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

const r2 = v => Math.round(v * 100) / 100;
const TOOLS = [
  { id: "fill", label: "🪣 Chạm tô vùng" },
  { id: "brush", label: "🖌️ Cọ" },
  { id: "erase", label: "🧽 Tẩy" },
];

// Xem trước: ảnh + vùng từng bánh tô bằng màu đúng — cũng là nơi giáo viên tô vùng (chọn 1 câu ở cột trái).
export function Part4Preview({ part, onChange, activeId, onActiveId }) {
  const art = useLineArt(part.imageUrl);
  const canvasRef = useRef(null);
  const [tool, setTool] = useState("fill");
  const [size, setSize] = useState(2.5);
  const [live, setLive] = useState(null); // nét đang kéo: { pts: [x, y, ...] }
  const [msg, setMsg] = useState("");
  const [zoom, setZoom] = useState(1);
  const count = part.items.filter(i => i.ops?.length).length;

  const masks = useMemo(() => {
    if (!art.orig) return {};
    return Object.fromEntries(
      part.items.map(it => {
        const ops = it.id === activeId && live ? [...it.ops, { t: "brush", size, e: tool === "erase", pts: live.pts }] : it.ops;
        return [it.id, buildMask(ops, art.w, art.h, art.orig)];
      }),
    );
  }, [art, part.items, activeId, live, size, tool]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !art.img) return;
    if (c.width !== art.w) c.width = art.w;
    if (c.height !== art.h) c.height = art.h;
    paintScene(c, art.img, masks, Object.fromEntries(part.items.map(it => [it.id, hexOf(it.color)])));
  }, [art, masks, part.items]);

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return [r2(((e.clientX - rect.left) / rect.width) * 100), r2(((e.clientY - rect.top) / rect.height) * 100)];
  }
  function addOp(op) {
    onChange({ ...part, items: part.items.map(i => (i.id === activeId ? { ...i, ops: [...i.ops, op] } : i)) });
  }

  function down(e) {
    if (!activeId || !art.orig) return;
    e.preventDefault();
    setMsg("");
    const [x, y] = point(e);
    if (tool === "fill") {
      const region = regionOf(art.orig, Math.round((x / 100) * (art.w - 1)), Math.round((y / 100) * (art.h - 1)));
      if (region) addOp({ t: "fill", x, y });
      else setMsg("Không tô nhanh được ở đây (chạm trúng nét viền hoặc viền bị hở) — dùng Cọ để tô.");
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setLive({ pts: [x, y] });
  }
  function move(e) {
    if (!live) return;
    const [x, y] = point(e);
    const n = live.pts.length;
    if (Math.hypot(x - live.pts[n - 2], y - live.pts[n - 1]) < 0.25) return;
    setLive({ pts: [...live.pts, x, y] });
  }
  function up() {
    if (!live) return;
    addOp({ t: "brush", size, e: tool === "erase", pts: live.pts });
    setLive(null);
  }

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
      {activeId && (
        <div className="p4e-tools">
          {TOOLS.map(t => (
            <button key={t.id} type="button" className={`p4e-tool${tool === t.id ? " is-active" : ""}`} onClick={() => setTool(t.id)}>{t.label}</button>
          ))}
          {tool !== "fill" && (
            <label className="p4e-size">
              Cỡ cọ
              <input type="range" min="0.6" max="8" step="0.2" value={size} onChange={e => setSize(Number(e.target.value))} />
            </label>
          )}
        </div>
      )}
      {msg && <p className="admin-upload-error">{msg}</p>}
      {part.imageUrl && (
        <div className="p4e-tools">
          <button type="button" className="p4e-tool" onClick={() => setZoom(z => Math.max(1, r2(z - 0.5)))} disabled={zoom <= 1}>−</button>
          <input type="range" min="1" max="5" step="0.25" value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          <button type="button" className="p4e-tool" onClick={() => setZoom(z => Math.min(5, r2(z + 0.5)))} disabled={zoom >= 5}>+</button>
          <span className="p4e-size">Zoom {Math.round(zoom * 100)}%</span>
          {zoom !== 1 && <button type="button" className="p4e-tool" onClick={() => setZoom(1)}>Vừa khung</button>}
        </div>
      )}
      {part.imageUrl ? (
        <div className="p4e-scroll">
          <div className="p4s-stage" style={{ width: `${zoom * 100}%` }}>
          <canvas
            ref={canvasRef}
            className="p4s-canvas"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            style={{ cursor: activeId ? "crosshair" : "default", touchAction: activeId ? "none" : "auto" }}
          />
          </div>
        </div>
      ) : (
        <p className="admin-muted-text">Chưa có ảnh tranh.</p>
      )}
      {art.error && <p className="admin-upload-error">{art.error}</p>}
    </div>
  );
}
