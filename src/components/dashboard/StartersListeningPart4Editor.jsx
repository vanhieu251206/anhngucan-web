import { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { PALETTE, hexOf, buildMask, paintScene, useLineArt, isWriteItem, part4Has } from "../StartersListeningPart4.jsx";
import { useRectDraw } from "./ScenePreview.jsx";

// CMS Luyện đề Listening Starters — Part 4 (nghe và tô màu): mỗi câu có màu đúng + vùng cái bánh do giáo
// viên tô sẵn ngay trên ảnh xem trước (dùng cọ/tẩy). Học sinh chọn màu
// bất kỳ rồi chạm bánh thì vùng này hiện màu đó; câu đúng khi màu trùng màu đúng. Ảnh xem trước hiện đúng
// như học sinh sẽ thấy khi tô đúng đáp án. Ví dụ đã tô sẵn trong ảnh nên không cần soạn. Mặc định gán sẵn
// màu theo đề Test 1 (pink, yellow, orange, green, blue).
const DEFAULT_COLORS = ["pink", "yellow", "orange", "green", "blue"];

// movers = true: Movers Part 5 (tô màu + viết chữ) — mặc định theo Test 1: cam, xanh dương, vàng, viết chữ, nâu.
const MOVERS_DEFAULTS = [
  { color: "orange" },
  { color: "blue" },
  { color: "yellow" },
  { kind: "write", answer: "" },
  { color: "brown" },
];

export function blankPart4(movers = false) {
  return {
    ...(movers ? { partNo: 5 } : {}),
    audioUrl: "",
    imageUrl: "",
    items: movers
      ? MOVERS_DEFAULTS.map((d, i) => ({ id: `q${i + 1}`, color: d.color ?? "orange", ops: [], ...(d.kind ? { kind: d.kind, box: null, answer: d.answer } : {}) }))
      : DEFAULT_COLORS.map((color, i) => ({ id: `q${i + 1}`, color, ops: [] })),
  };
}

export function normalizePart4(raw, movers = false) {
  const base = blankPart4(movers);
  if (!raw) return base;
  return {
    ...(movers ? { partNo: 5 } : {}),
    audioUrl: raw.audioUrl ?? "",
    imageUrl: raw.imageUrl ?? "",
    items: base.items.map(b => {
      const r = raw.items?.find(i => i.id === b.id);
      return r ? { ...b, id: b.id, color: r.color ?? b.color, ops: r.ops ?? [], ...(movers ? { kind: r.kind ?? null, box: r.box ?? null, answer: r.answer ?? "" } : {}) } : b;
    }),
  };
}

export const part4HasContent = part4Has;

export function validatePart4(part) {
  const n = part.partNo ?? 4;
  if (part.items.some(i => i.ops?.length || i.box) && !part.imageUrl) return `Part ${n}: chưa có ảnh tranh.`;
  const bad = part.items.find(i => !isWriteItem(i) && i.ops?.length && !i.color);
  if (bad) return `Part ${n}: Câu ${bad.id.slice(1)} chưa chọn màu.`;
  const noAns = part.items.find(i => isWriteItem(i) && i.box && !i.answer?.trim());
  if (noAns) return `Part ${n}: Câu ${noAns.id.slice(1)} chưa có đáp án chữ.`;
  return null;
}

export function Part4Editor({ part, onChange, activeId, onActiveId }) {
  function setItem(id, patch) {
    onChange({ ...part, items: part.items.map(i => (i.id === id ? { ...i, ...patch } : i)) });
  }
  const has = it => (isWriteItem(it) ? !!it.box : !!it.ops?.length);
  const done = part.items.filter(has).length;

  return (
    <div className="admin-form p1e">
      <fieldset className="admin-fieldset">
        <legend>🎧 Audio Part {part.partNo ?? 4}</legend>
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
            const filled = has(it);
            const write = isWriteItem(it);
            return (
              <div className={`p1e-pair${filled ? " is-full" : ""}`} key={it.id}>
                <div className="p1e-pair-head">
                  <span className="p1e-pair-num">{it.id.slice(1)}</span>
                  <strong className="p1e-pair-title">Câu {it.id.slice(1)}</strong>
                  <span className={`p1e-pair-status${has ? " is-ok" : ""}`}>{has ? "Đã tô" : "Trống"}</span>
                  <button
                    type="button"
                    className="p1e-clear"
                    disabled={write || !filled}
                    onClick={() => setItem(it.id, { ops: it.ops.slice(0, -1) })}
                    title="Hoàn tác thao tác cuối"
                  >↶</button>
                  <button
                    type="button"
                    className="p1e-clear"
                    disabled={!filled}
                    onClick={() => { setItem(it.id, write ? { box: null } : { ops: [] }); if (active) onActiveId(null); }}
                    title="Xoá vùng đã tô"
                  >✕</button>
                </div>
                {part.partNo === 5 && (
                  <div className="p4e-kind">
                    <button type="button" className={`p4e-tool${!write ? " is-active" : ""}`} onClick={() => setItem(it.id, { kind: null })}>🎨 Tô màu</button>
                    <button type="button" className={`p4e-tool${write ? " is-active" : ""}`} onClick={() => setItem(it.id, { kind: "write" })}>✏️ Viết chữ</button>
                  </div>
                )}
                {write && <input className="admin-input" placeholder="Đáp án chữ (vd: STONE)" value={it.answer ?? ""} onChange={e => setItem(it.id, { answer: e.target.value })} />}
                {!write && <div className="p4e-colors">
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
                </div>}
                <button
                  type="button"
                  className={`p1e-slot is-a${active ? " is-active" : ""}${filled ? " is-done" : ""}`}
                  disabled={!part.imageUrl}
                  onClick={() => onActiveId(active ? null : it.id)}
                >
                  <span className="p1e-slot-dot" />
                  <span className="p1e-slot-text">
                    <strong>{write ? "Vẽ khung viết chữ" : part.partNo === 5 ? "Tô vùng" : "Tô vùng bánh"}</strong>
                    <small>{active ? (write ? "Kéo trên ảnh..." : "Đang tô trên ảnh...") : filled ? "✓ Đã xong" : "Chưa làm"}</small>
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
  { id: "brush", label: "🖌️ Cọ" },
  { id: "erase", label: "🧽 Tẩy" },
];

// Xem trước: ảnh + vùng từng bánh tô bằng màu đúng — cũng là nơi giáo viên tô vùng (chọn 1 câu ở cột trái).
export function Part4Preview({ part, onChange, activeId, onActiveId }) {
  const art = useLineArt(part.imageUrl);
  const canvasRef = useRef(null);
  const [tool, setTool] = useState("brush");
  const [size, setSize] = useState(2.5);
  const [live, setLive] = useState(null); // nét đang kéo: { pts: [x, y, ...] }
  const [zoom, setZoom] = useState(1);
  const activeItem = part.items.find(i => i.id === activeId);
  const writing = !!activeItem && isWriteItem(activeItem);
  const count = part.items.filter(i => (isWriteItem(i) ? !!i.box : !!i.ops?.length)).length;
  const rect = useRectDraw(box => {
    onChange({ ...part, items: part.items.map(i => (i.id === activeId ? { ...i, box } : i)) });
    onActiveId(null);
  });

  const masks = useMemo(() => {
    if (!art.orig) return {};
    return Object.fromEntries(
      part.items.filter(it => !isWriteItem(it)).map(it => {
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
    paintScene(c, art.img, masks, Object.fromEntries(part.items.filter(it => !isWriteItem(it)).map(it => [it.id, hexOf(it.color)])));
  }, [art, masks, part.items]);

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return [r2(((e.clientX - rect.left) / rect.width) * 100), r2(((e.clientY - rect.top) / rect.height) * 100)];
  }
  function addOp(op) {
    onChange({ ...part, items: part.items.map(i => (i.id === activeId ? { ...i, ops: [...i.ops, op] } : i)) });
  }

  function down(e) {
    if (!activeId || !art.orig || writing) return;
    e.preventDefault();
    const [x, y] = point(e);
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
      <h2 className="p2s-title">Part {part.partNo ?? 4}</h2>
      <p className="p2s-count">– {count} questions –</p>
      <p className="p2s-instr">Listen and colour{part.items.some(isWriteItem) ? " and write" : ""}. There is one example.</p>
      {part.audioUrl && <audio className="p2r-audio" src={part.audioUrl} controls />}
      {activeId && !writing && (
        <div className="p4e-tools">
          {TOOLS.map(t => (
            <button key={t.id} type="button" className={`p4e-tool${tool === t.id ? " is-active" : ""}`} onClick={() => setTool(t.id)}>{t.label}</button>
          ))}
          <label className="p4e-size">
            Cỡ cọ
            <input type="range" min="0.6" max="8" step="0.2" value={size} onChange={e => setSize(Number(e.target.value))} />
          </label>
        </div>
      )}
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
          <div ref={rect.stageRef} className="p4s-stage" style={{ width: `${zoom * 100}%` }} {...(writing ? rect.handlers : {})}>
          <canvas
            ref={canvasRef}
            className="p4s-canvas"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            style={{ cursor: activeId ? "crosshair" : "default", touchAction: activeId ? "none" : "auto" }}
          />
          {part.items.filter(isWriteItem).map(it => it.box && (
            <div key={it.id} className="admin-p1-frame is-b" style={{ left: `${it.box.x}%`, top: `${it.box.y}%`, width: `${it.box.w}%`, height: `${it.box.h}%` }}>
              <span>{it.id.slice(1)}</span>
            </div>
          ))}
          {rect.liveRect && <div className="admin-p1-frame is-live" style={{ left: `${rect.liveRect.x}%`, top: `${rect.liveRect.y}%`, width: `${rect.liveRect.w}%`, height: `${rect.liveRect.h}%` }} />}
          </div>
        </div>
      ) : (
        <p className="admin-muted-text">Chưa có ảnh tranh.</p>
      )}
      {art.error && <p className="admin-upload-error">{art.error}</p>}
    </div>
  );
}
