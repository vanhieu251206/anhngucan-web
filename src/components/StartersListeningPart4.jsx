import { useEffect, useMemo, useRef, useState } from "react";
import { isWriteItem, itemReady } from "../lib/grading/canvasParts.js";

// Luyện đề Listening Starters — Part 4 (nghe và tô màu). Giáo viên tô sẵn vùng từng cái bánh trong CMS
// (StartersListeningPart4Editor.jsx: chạm để tô nhanh cả vùng kín, hoặc dùng cọ/tẩy cho chuẩn). Học sinh chọn
// màu bất kỳ rồi chạm vào cái bánh: đúng vùng giáo viên đã tô sẽ hiện màu đó, nét đen của tranh luôn nằm
// trên cùng (multiply) nên màu ăn sát viền, không lem. Câu đúng khi màu học sinh tô trùng màu đúng.
// Movers Part 5 (partNo = 5) dùng lại y hệt và thêm câu "viết chữ": item { kind: "write", box: {x,y,w,h}, answer } —
// học sinh bấm "Thêm chữ", gõ chữ rồi KÉO chữ tới đúng chỗ trên tranh; đúng khi chữ khớp đáp án (không phân biệt
// hoa thường) và tâm chữ nằm trong khung giáo viên vẽ sẵn (khung không hiện cho học sinh, chỉ hiện khi nộp bài).
// Học sinh TÔ TỰ DO bằng cọ / tẩy / tô nhanh vùng kín ở bất kỳ đâu; khi nộp bài, chấm bằng cách so lớp tô với vùng
// đáp án giáo viên đã tô sẵn (xem gradeColours).
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
  { id: "grey", name: "Grey", hex: "#9e9e9e" },
  { id: "black", name: "Black", hex: "#2b2b2b" },
];
export const hexOf = id => PALETTE.find(p => p.id === id)?.hex;

export { isWriteItem, itemReady };
const normText = t => String(t ?? "").toLowerCase().replace(/\s+/g, " ").trim();
export const part4Has = p => !!p?.imageUrl && !!p?.items?.some(i => (isWriteItem(i) ? !!i.box : !!i.ops?.length));

const shuffled = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// Tâm chữ nằm trong khung đáp án (nới thêm một chút cho dễ trúng).
const inBox = (l, b) => {
  const mx = b.w * 0.15;
  const my = b.h * 0.5;
  return l.x >= b.x - mx && l.x <= b.x + b.w + mx && l.y >= b.y - my && l.y <= b.y + b.h + my;
};

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

// ---- Tô tự do của học sinh (cọ / tẩy / tô nhanh vùng kín) ----
// Lớp tô của học sinh là 1 canvas riêng, dựng lại từ danh sách thao tác `ops` (để hoàn tác):
//   { t: "fill", x, y, c }  |  { t: "brush", size, e, c, pts: [x, y, ...] }   (x, y, pts theo % ảnh, c = id màu)
function drawStroke(ctx, w, h, size, erase, hex, pts, from = 0) {
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  ctx.strokeStyle = hex ?? "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, (size / 100) * w);
  ctx.beginPath();
  ctx.moveTo((pts[from] / 100) * w, (pts[from + 1] / 100) * h);
  if (pts.length - from === 2) ctx.lineTo((pts[from] / 100) * w + 0.01, (pts[from + 1] / 100) * h);
  for (let i = from + 2; i < pts.length; i += 2) ctx.lineTo((pts[i] / 100) * w, (pts[i + 1] / 100) * h);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

function replayOps(layer, ops, orig) {
  const { width: w, height: h } = layer;
  const ctx = layer.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  for (const op of ops) {
    if (op.t === "fill") {
      const region = regionOf(orig, Math.round((op.x / 100) * (w - 1)), Math.round((op.y / 100) * (h - 1)));
      if (!region) continue;
      const hex = hexOf(op.c);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const id = ctx.createImageData(w, h);
      for (const p of region) {
        id.data[p * 4] = r;
        id.data[p * 4 + 1] = g;
        id.data[p * 4 + 2] = b;
        id.data[p * 4 + 3] = 255;
      }
      const t = document.createElement("canvas");
      t.width = w;
      t.height = h;
      t.getContext("2d").putImageData(id, 0, 0);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(t, dx, dy);
    } else if (op.pts?.length >= 2) {
      drawStroke(ctx, w, h, op.size, op.e, hexOf(op.c), op.pts);
    }
  }
}

function paintLayer(canvas, img, layer) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext("2d");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(layer, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-over";
}

// Chấm: với mỗi câu tô màu, so lớp tô của học sinh với vùng đáp án giáo viên đã tô sẵn.
//  - phủ ≥ 55% vùng đáp án bằng ĐÚNG màu,
//  - màu khác đè lên vùng đáp án ≤ 35%,
//  - màu đúng tô lem ra ngoài vùng đáp án (không thuộc câu nào cùng màu) ≤ 100% diện tích vùng (chặn tô kín cả tranh).
function gradeColours(layer, colourItems, masks) {
  const { width: w, height: h } = layer;
  const d = layer.getContext("2d").getImageData(0, 0, w, h).data;
  const rgb = PALETTE.map(p => [parseInt(p.hex.slice(1, 3), 16), parseInt(p.hex.slice(3, 5), 16), parseInt(p.hex.slice(5, 7), 16)]);
  const n = w * h;
  const label = new Int8Array(n).fill(-1); // chỉ số màu gần nhất trong PALETTE, -1 = chưa tô
  for (let i = 0; i < n; i++) {
    if (d[i * 4 + 3] < 128) continue;
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < rgb.length; k++) {
      const dr = d[i * 4] - rgb[k][0];
      const dg = d[i * 4 + 1] - rgb[k][1];
      const db = d[i * 4 + 2] - rgb[k][2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bd) {
        bd = dist;
        best = k;
      }
    }
    label[i] = best;
  }
  const maskData = Object.fromEntries(colourItems.map(it => [it.id, masks[it.id]?.getContext("2d").getImageData(0, 0, w, h).data]));
  const result = {};
  for (const it of colourItems) {
    const md = maskData[it.id];
    const ci = PALETTE.findIndex(p => p.id === it.color);
    if (!md || ci < 0) {
      result[it.id] = false;
      continue;
    }
    let area = 0;
    let good = 0;
    let bad = 0;
    for (let i = 0; i < n; i++) {
      if (md[i * 4 + 3] === 0) continue;
      area++;
      if (label[i] === ci) good++;
      else if (label[i] >= 0) bad++;
    }
    // Vùng đáp án của mọi câu cùng màu — tô vào đó không tính là lem.
    const same = colourItems.filter(o => o.color === it.color).map(o => maskData[o.id]).filter(Boolean);
    let spill = 0;
    for (let i = 0; i < n; i++) {
      if (label[i] === ci && !same.some(m => m[i * 4 + 3] > 0)) spill++;
    }
    result[it.id] = area > 0 && good / area >= 0.55 && bad / area <= 0.35 && spill <= area;
  }
  return result;
}

const TOOLS = [
  { id: "brush", label: "🖌️ Cọ" },
  { id: "erase", label: "🧽 Tẩy" },
];

export default function StartersListeningPart4Runner({ part, submitted, reveal = true, onScore }) {
  const items = useMemo(() => (part.items ?? []).filter(itemReady), [part.items]);
  const colourItems = useMemo(() => items.filter(i => !isWriteItem(i)), [items]);
  const palette = useMemo(() => shuffled(PALETTE), []); // xáo ngẫu nhiên để thứ tự màu không lộ đáp án
  const hasWrite = useMemo(() => items.some(isWriteItem), [items]);
  const [labels, setLabels] = useState([]); // chữ học sinh thêm: [{ id, text, x, y }] — x, y = tâm chữ (% ảnh)
  const [draft, setDraft] = useState("");
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const canvasRef = useRef(null);
  const layerRef = useRef(null); // canvas lớp tô của học sinh
  const liveRef = useRef(null); // nét đang kéo: { pts, size, e, c }
  const art = useLineArt(part.imageUrl);
  const [color, setColor] = useState(null);
  const [tool, setTool] = useState("brush");
  const [size, setSize] = useState(2.5); // % bề rộng ảnh
  const [ops, setOps] = useState([]);
  const [zoom, setZoom] = useState(1); // 1 = vừa khung, tối đa 3

  // Vùng đáp án (giáo viên) — chỉ dùng để chấm và hiện khung khi nộp bài, KHÔNG cho học sinh thấy khi làm.
  const masks = useMemo(() => {
    if (!art.orig || !submitted) return {};
    return Object.fromEntries(colourItems.map(it => [it.id, buildMask(it.ops, art.w, art.h, art.orig)]));
  }, [art, colourItems, submitted]);

  const boxes = useMemo(() => (submitted ? Object.fromEntries(colourItems.map(it => [it.id, masks[it.id] ? maskBox(masks[it.id]) : null])) : {}), [submitted, colourItems, masks]);

  function repaint() {
    const c = canvasRef.current;
    if (c && art.img && layerRef.current) paintLayer(c, art.img, layerRef.current);
  }

  // Dựng lại lớp tô mỗi khi đổi danh sách thao tác (thêm / hoàn tác / xoá hết) hoặc ảnh vừa tải xong.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !art.img) return;
    if (c.width !== art.w) c.width = art.w;
    if (c.height !== art.h) c.height = art.h;
    if (!layerRef.current || layerRef.current.width !== art.w || layerRef.current.height !== art.h) {
      const l = document.createElement("canvas");
      l.width = art.w;
      l.height = art.h;
      layerRef.current = l;
    }
    replayOps(layerRef.current, ops, art.orig);
    repaint();
  }, [art, ops]); // eslint-disable-line react-hooks/exhaustive-deps

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return [Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 100, Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 100];
  }
  function down(e) {
    if (submitted || !art.orig || (!color && tool !== "erase")) return;
    e.preventDefault();
    const [x, y] = point(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    liveRef.current = { pts: [x, y], size, e: tool === "erase", c: color };
    drawStroke(layerRef.current.getContext("2d"), art.w, art.h, size, tool === "erase", hexOf(color), [x, y]);
    repaint();
  }
  function move(e) {
    const live = liveRef.current;
    if (!live) return;
    const [x, y] = point(e);
    const n = live.pts.length;
    if (Math.hypot(x - live.pts[n - 2], y - live.pts[n - 1]) < 0.2) return;
    live.pts.push(x, y);
    drawStroke(layerRef.current.getContext("2d"), art.w, art.h, live.size, live.e, hexOf(live.c), live.pts, n - 2);
    repaint();
  }
  function up() {
    const live = liveRef.current;
    if (!live) return;
    liveRef.current = null;
    setOps(o => [...o, { t: "brush", size: live.size, e: live.e, c: live.c, pts: live.pts }]);
  }

  const graded = useMemo(() => {
    if (!submitted || !layerRef.current || !Object.keys(masks).length) return {};
    return gradeColours(layerRef.current, colourItems, masks);
  }, [submitted, masks, colourItems]);

  const wbox = items.find(isWriteItem)?.box;
  const labelSize = wbox ? Math.min(5, Math.max(2, wbox.h * (art.h / (art.w || 1)) * 0.8)) : 3;
  const isRight = it =>
    isWriteItem(it) ? labels.some(l => normText(l.text) === normText(it.answer) && inBox(l, it.box)) : !!graded[it.id];

  function addLabel() {
    const text = draft.trim();
    if (!text || submitted) return;
    setLabels(ls => [...ls, { id: Date.now() + Math.random(), text, x: 50, y: 50 }]);
    setDraft("");
  }
  function startDrag(e, id) {
    if (submitted) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = id;
  }
  function moveDrag(e) {
    if (dragRef.current == null) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setLabels(ls => ls.map(l => (l.id === dragRef.current ? { ...l, x, y } : l)));
  }
  function endDrag() {
    dragRef.current = null;
  }
  const score = submitted ? items.filter(isRight).length : 0;
  useEffect(() => {
    onScore?.({ score, total: items.length });
  }, [score, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const canPaint = !submitted && (!!color || tool === "erase");

  return (
    <div className="p2r">
      <h2 className="p2s-title">Part {part.partNo ?? 4}</h2>
      <p className="p2s-count">– {items.length} questions –</p>
      <p className="p2s-instr">Listen and colour{hasWrite ? " and write" : ""}. There is one example.</p>
      <p className="p1r-sub">{part.partNo === 5 ? "Chọn một màu rồi tô bằng cọ lên vật cần tô; câu viết chữ thì bấm \"Thêm chữ\", gõ chữ rồi kéo tới đúng chỗ trên tranh." : "Chọn một màu rồi tô bằng cọ lên cái bánh cần tô."}</p>
      {part.audioUrl && <audio className="p2r-audio" src={part.audioUrl} controls />}

      {!submitted && (
        <>
          <div className="p4s-palette">
            {palette.map(p => (
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
          <div className="p4e-tools">
            {TOOLS.map(t => (
              <button key={t.id} type="button" className={`p4e-tool${tool === t.id ? " is-active" : ""}`} onClick={() => setTool(t.id)}>{t.label}</button>
            ))}
            <label className="p4e-size">
              Cỡ cọ
              <input type="range" min="0.6" max="8" step="0.2" value={size} onChange={e => setSize(Number(e.target.value))} />
            </label>
          </div>
        </>
      )}

      {hasWrite && !submitted && (
        <div className="p4s-addtext">
          <input
            className="admin-input"
            placeholder="Gõ chữ cần viết..."
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addLabel()}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn btn-primary" onClick={addLabel} disabled={!draft.trim()}>✏️ Thêm chữ</button>
        </div>
      )}

      <div className="p4e-tools">
        <button type="button" className="p4e-tool" onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 100) / 100))} disabled={zoom <= 1} aria-label="Thu nhỏ ảnh">−</button>
        <input type="range" min="1" max="3" step="0.25" value={zoom} onChange={e => setZoom(Number(e.target.value))} aria-label="Kích cỡ ảnh" />
        <button type="button" className="p4e-tool" onClick={() => setZoom(z => Math.min(3, Math.round((z + 0.25) * 100) / 100))} disabled={zoom >= 3} aria-label="Phóng to ảnh">+</button>
        <span className="p4e-size">Ảnh {Math.round(zoom * 100)}%</span>
        {zoom !== 1 && <button type="button" className="p4e-tool" onClick={() => setZoom(1)}>Vừa khung</button>}
      </div>

      <div className="p4e-scroll" style={zoom === 1 ? { maxHeight: "none", overflow: "visible" } : undefined}>
      <div ref={stageRef} className="p4s-stage" style={{ containerType: "inline-size", width: `${zoom * 100}%` }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <canvas
          ref={canvasRef}
          className="p4s-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ cursor: canPaint ? "crosshair" : "default", touchAction: canPaint ? "none" : "auto" }}
        />
        {submitted && reveal &&
          colourItems.map(it => {
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
        {labels.map(l => (
          <span
            key={l.id}
            className={`p4s-label${submitted ? " is-locked" : ""}`}
            style={{ left: `${l.x}%`, top: `${l.y}%`, fontSize: `${labelSize}cqw` }}
            onPointerDown={e => startDrag(e, l.id)}
          >
            {l.text}
            {!submitted && (
              <button type="button" className="p4s-label-x" onPointerDown={e => e.stopPropagation()} onClick={() => setLabels(ls => ls.filter(x => x.id !== l.id))} aria-label="Xoá chữ">✕</button>
            )}
          </span>
        ))}
        {submitted && reveal &&
          items.filter(isWriteItem).map(it => {
            const ok = isRight(it);
            return (
              <div key={it.id} className={`p4s-frame ${ok ? "is-ok" : "is-wrong"}`} style={{ left: `${it.box.x}%`, top: `${it.box.y}%`, width: `${it.box.w}%`, height: `${it.box.h}%` }}>
                {!ok && <span>{it.answer}</span>}
              </div>
            );
          })}
      </div>
      </div>
      {art.error && <p className="admin-upload-error">{art.error}</p>}

      {!submitted && (
        <div className="p1r-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOps(o => o.slice(0, -1))} disabled={ops.length === 0}>↶ Hoàn tác</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setOps([]); setLabels([]); }} disabled={ops.length === 0 && labels.length === 0}>Xóa hết</button>
        </div>
      )}
    </div>
  );
}
