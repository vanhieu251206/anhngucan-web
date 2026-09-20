import { useEffect, useMemo, useRef, useState } from "react";

// Luyện đề Listening Starters — Part 4 (nghe và tô màu). Giáo viên tô sẵn vùng từng cái bánh trong CMS
// (StartersListeningPart4Editor.jsx: chạm để tô nhanh cả vùng kín, hoặc dùng cọ/tẩy cho chuẩn). Học sinh chọn
// màu bất kỳ rồi chạm vào cái bánh: đúng vùng giáo viên đã tô sẽ hiện màu đó, nét đen của tranh luôn nằm
// trên cùng (multiply) nên màu ăn sát viền, không lem. Câu đúng khi màu học sinh tô trùng màu đúng.
// Dữ liệu: { audioUrl, imageUrl, items: [{ id, color, ops }] } — ops theo thứ tự:
//   { t: "fill", x, y }                       tô nhanh vùng kín quanh điểm (toạ độ % ảnh)
//   { t: "brush", size, e, pts: [x, y, ...] } nét cọ (size = % bề rộng ảnh, e = tẩy), pts phẳng vì Firestore không cho mảng lồng.
export const PALETTE = [
  { id: "pink", name: "Pink", hex: "#ff8fc0" },
  { id: "yellow", name: "Yellow", hex: "#ffe14d" },
  { id: "orange", name: "Orange", hex: "#ff9a2e" },
  { id: "green", name: "Green", hex: "#4cc35a" },
  { id: "blue", name: "Blue", hex: "#4da3ff" },
  { id: "brown", name: "Brown", hex: "#9c6234" },
  { id: "red", name: "Red", hex: "#f04848" },
  { id: "purple", name: "Purple", hex: "#a66be0" },
];
export const hexOf = id => PALETTE.find(p => p.id === id)?.hex;

const LINE_LUM = 120; // sáng hơn mức này = không phải nét vẽ

// Vùng kín liền nhau quanh điểm (chỉ số điểm ảnh) trên ảnh gốc. null nếu chạm trúng nét đen hoặc vùng
// quá lớn (viền hở làm màu tràn ra cả nền). Có cache vì kéo cọ vẽ lại mask liên tục.
const regionCache = new WeakMap();
export function regionOf(orig, sx, sy) {
  const { width: w, height: h, data: src } = orig;
  const key = `${sx},${sy}`;
  let cache = regionCache.get(orig);
  if (!cache) regionCache.set(orig, (cache = new Map()));
  if (cache.has(key)) return cache.get(key);
  const lum = q => 0.299 * src[q * 4] + 0.587 * src[q * 4 + 1] + 0.114 * src[q * 4 + 2];
  const start = sy * w + sx;
  let result = null;
  if (lum(start) >= LINE_LUM) {
    const limit = w * h * 0.12;
    const mark = new Uint8Array(w * h);
    const stack = [start];
    const list = [];
    mark[start] = 1;
    while (stack.length && list.length <= limit) {
      const p = stack.pop();
      list.push(p);
      const x = p % w;
      const nb = [];
      if (x > 0) nb.push(p - 1);
      if (x < w - 1) nb.push(p + 1);
      if (p >= w) nb.push(p - w);
      if (p < w * (h - 1)) nb.push(p + w);
      for (const q of nb) {
        if (!mark[q] && lum(q) >= LINE_LUM) {
          mark[q] = 1;
          stack.push(q);
        }
      }
    }
    if (list.length <= limit) result = list;
  }
  cache.set(key, result);
  return result;
}

// Ảnh mask (canvas, alpha>0 = thuộc cái bánh) dựng từ danh sách ops.
export function buildMask(ops, w, h, orig) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";
  for (const op of ops ?? []) {
    if (op.t === "fill") {
      const region = regionOf(orig, Math.round((op.x / 100) * (w - 1)), Math.round((op.y / 100) * (h - 1)));
      if (!region) continue;
      const id = ctx.createImageData(w, h);
      for (const p of region) id.data[p * 4 + 3] = 255;
      const t = document.createElement("canvas");
      t.width = w;
      t.height = h;
      t.getContext("2d").putImageData(id, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      // Nở 1px ra bốn phía để màu chui dưới nét viền, không để lại quầng trắng.
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(t, dx, dy);
    } else if (op.pts?.length >= 2) {
      ctx.globalCompositeOperation = op.e ? "destination-out" : "source-over";
      ctx.lineWidth = Math.max(1, (op.size / 100) * w);
      ctx.beginPath();
      ctx.moveTo((op.pts[0] / 100) * w, (op.pts[1] / 100) * h);
      if (op.pts.length === 2) ctx.lineTo((op.pts[0] / 100) * w + 0.01, (op.pts[1] / 100) * h);
      for (let i = 2; i < op.pts.length; i += 2) ctx.lineTo((op.pts[i] / 100) * w, (op.pts[i + 1] / 100) * h);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = "source-over";
  return c;
}

// Vẽ cảnh: nền trắng → màu (tô theo mask từng bánh) → ảnh line art nhân (multiply) lên trên.
// colors: { [itemId]: hex }.
export function paintScene(canvas, img, masks, colors) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext("2d");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  const t = document.createElement("canvas");
  t.width = w;
  t.height = h;
  const tc = t.getContext("2d");
  for (const [id, hex] of Object.entries(colors)) {
    if (!hex || !masks[id]) continue;
    tc.globalCompositeOperation = "source-over";
    tc.clearRect(0, 0, w, h);
    tc.fillStyle = hex;
    tc.fillRect(0, 0, w, h);
    tc.globalCompositeOperation = "destination-in";
    tc.drawImage(masks[id], 0, 0);
    ctx.drawImage(t, 0, 0);
  }
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-over";
}

// Tải ảnh line art và lấy ImageData gốc (cần crossOrigin để đọc điểm ảnh từ Cloudinary).
export function useLineArt(url) {
  const [art, setArt] = useState({ img: null, w: 0, h: 0, orig: null, error: "" });
  useEffect(() => {
    if (!url) {
      setArt({ img: null, w: 0, h: 0, orig: null, error: "" });
      return undefined;
    }
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!alive) return;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      setArt({ img, w: c.width, h: c.height, orig: ctx.getImageData(0, 0, c.width, c.height), error: "" });
    };
    img.onerror = () => alive && setArt({ img: null, w: 0, h: 0, orig: null, error: "Không tải được ảnh." });
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return art;
}

// Khung bao (theo % ảnh) của vùng mask — để hiện nhãn đúng/sai khi nộp bài.
function maskBox(mask) {
  const { width: w, height: h } = mask;
  const d = mask.getContext("2d").getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: (x0 / w) * 100, y: (y0 / h) * 100, w: ((x1 - x0 + 1) / w) * 100, h: ((y1 - y0 + 1) / h) * 100 };
}

export default function StartersListeningPart4Runner({ part, submitted, onScore }) {
  const items = useMemo(() => (part.items ?? []).filter(i => i.ops?.length && i.color), [part.items]);
  const canvasRef = useRef(null);
  const art = useLineArt(part.imageUrl);
  const [color, setColor] = useState(null);
  const [colors, setColors] = useState({}); // { itemId: colorId } — màu học sinh đã tô
  const [history, setHistory] = useState([]);

  const masks = useMemo(() => {
    if (!art.orig) return {};
    return Object.fromEntries(items.map(it => [it.id, buildMask(it.ops, art.w, art.h, art.orig)]));
  }, [art, items]);

  const boxes = useMemo(() => (submitted ? Object.fromEntries(items.map(it => [it.id, masks[it.id] ? maskBox(masks[it.id]) : null])) : {}), [submitted, items, masks]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !art.img) return;
    if (c.width !== art.w) c.width = art.w;
    if (c.height !== art.h) c.height = art.h;
    paintScene(c, art.img, masks, Object.fromEntries(Object.entries(colors).map(([id, cid]) => [id, hexOf(cid)])));
  }, [art, masks, colors]);

  function handleClick(e) {
    if (submitted || !color || !art.orig) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = Math.min(art.w - 1, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * (art.w - 1))));
    const py = Math.min(art.h - 1, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * (art.h - 1))));
    for (const it of [...items].reverse()) {
      const m = masks[it.id];
      if (m && m.getContext("2d").getImageData(px, py, 1, 1).data[3] > 0) {
        if (colors[it.id] === color) return;
        setHistory(h => [...h, colors]);
        setColors({ ...colors, [it.id]: color });
        return;
      }
    }
  }

  function undo() {
    setColors(history[history.length - 1] ?? {});
    setHistory(h => h.slice(0, -1));
  }

  function clearAll() {
    setHistory(h => [...h, colors]);
    setColors({});
  }

  const isRight = it => colors[it.id] === it.color;
  const score = items.filter(isRight).length;
  useEffect(() => {
    onScore?.({ score, total: items.length });
  }, [score, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p2r">
      <h2 className="p2s-title">Part 4</h2>
      <p className="p2s-count">– {items.length} questions –</p>
      <p className="p2s-instr">Listen and colour. There is one example.</p>
      <p className="p1r-sub">Chọn một màu, rồi chạm vào cái bánh cần tô.</p>
      {part.audioUrl && <audio className="p2r-audio" src={part.audioUrl} controls />}

      {!submitted && (
        <div className="p4s-palette">
          {PALETTE.map(p => (
            <button
              key={p.id}
              type="button"
              className={`p4s-swatch${color === p.id ? " is-active" : ""}`}
              style={{ "--c": p.hex }}
              onClick={() => setColor(p.id)}
              title={p.name}
            >
              <span className="p4s-swatch-dot" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="p4s-stage">
        <canvas ref={canvasRef} className="p4s-canvas" onClick={handleClick} style={{ cursor: color && !submitted ? "pointer" : "default" }} />
        {submitted &&
          items.map(it => {
            const b = boxes[it.id];
            if (!b) return null;
            const ok = isRight(it);
            return (
              <div
                key={it.id}
                className={`p4s-frame ${ok ? "is-ok" : "is-wrong"}`}
                style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
              >
                {!ok && <span>{PALETTE.find(p => p.id === it.color)?.name}</span>}
              </div>
            );
          })}
      </div>
      {art.error && <p className="admin-upload-error">{art.error}</p>}

      {!submitted && (
        <div className="p1r-actions">
          <button type="button" className="btn btn-secondary" onClick={undo} disabled={history.length === 0}>↶ Hoàn tác</button>
          <button type="button" className="btn btn-secondary" onClick={clearAll} disabled={Object.keys(colors).length === 0}>Xóa hết</button>
        </div>
      )}
    </div>
  );
}
