import { useEffect, useRef, useState } from "react";

// Luyện đề Listening Starters — Part 4 (nghe và tô màu). Học sinh chọn 1 màu rồi chạm vào cái bánh cần
// tô: vùng kín đó được đổ đầy màu ngay trên ảnh line art (flood fill trên canvas). Chấm: mỗi câu có 1
// khung toạ độ quanh cái bánh + màu đúng (soạn ở StartersListeningPart4Editor.jsx); câu đúng khi màu
// đang phủ trong khung khớp màu đúng. Dữ liệu: { audioUrl, imageUrl, items: [{ id, color, frame: {x,y,w,h} }] }.
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
export const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
// Đổ màu cho vùng kín quanh điểm chạm. Vùng được xác định trên ẢNH GỐC `orig` (ImageData chưa tô): mọi
// điểm ảnh đủ sáng (không phải nét vẽ) và liền nhau với điểm chạm — không phụ thuộc màu đã tô trước đó,
// và không bị lốm đốm do nhiễu xám của ảnh quét. Trả về false (không đổi gì) nếu chạm trúng nét đen hoặc
// vùng quá lớn (nét viền hở làm màu tràn ra cả nền).
const LINE_LUM = 120; // sáng hơn mức này = không phải nét vẽ
export function floodFill(ctx, w, h, sx, sy, rgb, orig) {
  const src = orig.data;
  const lumAt = q => 0.299 * src[q * 4] + 0.587 * src[q * 4 + 1] + 0.114 * src[q * 4 + 2];
  const start = sy * w + sx;
  if (lumAt(start) < LINE_LUM) return false;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const o0 = start * 4;
  if (d[o0] === rgb[0] && d[o0 + 1] === rgb[1] && d[o0 + 2] === rgb[2]) return false;
  const limit = w * h * 0.12;
  const mark = new Uint8Array(w * h);
  const stack = [start];
  mark[start] = 1;
  const list = [];
  const neighbours = p => {
    const x = p % w;
    const y = (p - x) / w;
    const nb = [];
    if (x > 0) nb.push(p - 1);
    if (x < w - 1) nb.push(p + 1);
    if (y > 0) nb.push(p - w);
    if (y < h - 1) nb.push(p + w);
    return nb;
  };
  while (stack.length) {
    const p = stack.pop();
    list.push(p);
    if (list.length > limit) return false;
    for (const q of neighbours(p)) {
      if (!mark[q] && lumAt(q) >= LINE_LUM) {
        mark[q] = 1;
        stack.push(q);
      }
    }
  }
  // Lan thêm 2px ra viền khử răng cưa (pha màu theo độ sáng gốc) để màu ăn sát nét viền, không để lại
  // quầng trắng; lõi nét đen giữ nguyên.
  const ring = [];
  let frontier = list;
  for (let pass = 0; pass < 2; pass++) {
    const next = [];
    for (const p of frontier) {
      for (const q of neighbours(p)) {
        if (!mark[q] && lumAt(q) >= 90) {
          mark[q] = 2;
          next.push(q);
          ring.push(q);
        }
      }
    }
    frontier = next;
  }
  for (const q of ring) {
    const f = Math.min(1, Math.max(0, (lumAt(q) - 60) / 170));
    const o = q * 4;
    d[o] = Math.round(rgb[0] * f);
    d[o + 1] = Math.round(rgb[1] * f);
    d[o + 2] = Math.round(rgb[2] * f);
    d[o + 3] = 255;
  }
  for (const p of list) {
    const o = p * 4;
    d[o] = rgb[0];
    d[o + 1] = rgb[1];
    d[o + 2] = rgb[2];
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return true;
}

export default function StartersListeningPart4Runner({ part, submitted, onScore }) {
  const items = (part.items ?? []).filter(i => i.frame && i.color);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const origRef = useRef(null); // ImageData gốc (chưa tô)
  const [color, setColor] = useState(null);
  const [fills, setFills] = useState([]); // [{ x, y, color }] theo % ảnh
  const [ready, setReady] = useState(false);
  const [okIds, setOkIds] = useState([]);
  const [error, setError] = useState("");

  function paint(list) {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    for (const f of list) {
      floodFill(ctx, c.width, c.height, Math.round((f.x / 100) * (c.width - 1)), Math.round((f.y / 100) * (c.height - 1)), hexToRgb(PALETTE.find(p => p.id === f.color).hex), origRef.current);
    }
  }

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const c = canvasRef.current;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx0 = c.getContext("2d", { willReadFrequently: true });
      ctx0.drawImage(img, 0, 0);
      origRef.current = ctx0.getImageData(0, 0, c.width, c.height);
      setReady(true);
    };
    img.onerror = () => setError("Không tải được ảnh.");
    img.src = part.imageUrl;
  }, [part.imageUrl]);

  function handleClick(e) {
    if (submitted || !ready || !color) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pt = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    const c = canvasRef.current;
    try {
      const ctx = c.getContext("2d", { willReadFrequently: true });
      const ok = floodFill(ctx, c.width, c.height, Math.round((pt.x / 100) * (c.width - 1)), Math.round((pt.y / 100) * (c.height - 1)), hexToRgb(PALETTE.find(p => p.id === color).hex), origRef.current);
      if (ok) setFills(f => [...f, { ...pt, color }]);
    } catch {
      setError("Không tô được ảnh này.");
    }
  }

  function undo() {
    const next = fills.slice(0, -1);
    setFills(next);
    paint(next);
  }

  function clearAll() {
    setFills([]);
    paint([]);
  }

  // Chấm: trong khung của từng câu, màu nào phủ nhiều nhất trong 8 màu của bảng — trùng màu đúng (và phủ
  // đủ nhiều, tránh tô 1 chấm nhỏ) thì câu đúng.
  useEffect(() => {
    const c = canvasRef.current;
    if (!ready || !c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const palette = PALETTE.map(p => ({ id: p.id, rgb: hexToRgb(p.hex) }));
    const ok = items
      .filter(it => {
        const x0 = Math.max(0, Math.floor((it.frame.x / 100) * c.width));
        const y0 = Math.max(0, Math.floor((it.frame.y / 100) * c.height));
        const w = Math.min(c.width - x0, Math.max(1, Math.round((it.frame.w / 100) * c.width)));
        const h = Math.min(c.height - y0, Math.max(1, Math.round((it.frame.h / 100) * c.height)));
        const d = ctx.getImageData(x0, y0, w, h).data;
        const counts = {};
        for (let i = 0; i < d.length; i += 8) {
          for (const p of palette) {
            if (Math.abs(d[i] - p.rgb[0]) <= 14 && Math.abs(d[i + 1] - p.rgb[1]) <= 14 && Math.abs(d[i + 2] - p.rgb[2]) <= 14) {
              counts[p.id] = (counts[p.id] ?? 0) + 1;
              break;
            }
          }
        }
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return best && best[0] === it.color && best[1] >= Math.max(30, (d.length / 8) * 0.06);
      })
      .map(it => it.id);
    setOkIds(ok);
  }, [fills, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRight = it => okIds.includes(it.id);
  const score = okIds.length;
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
        <canvas ref={canvasRef} className="p4s-canvas" onClick={handleClick} style={{ cursor: color && !submitted ? "crosshair" : "default" }} />
        {submitted &&
          items.map(it => {
            const ok = isRight(it);
            const name = PALETTE.find(p => p.id === it.color)?.name;
            return (
              <div
                key={it.id}
                className={`p4s-frame ${ok ? "is-ok" : "is-wrong"}`}
                style={{ left: `${it.frame.x}%`, top: `${it.frame.y}%`, width: `${it.frame.w}%`, height: `${it.frame.h}%` }}
              >
                {!ok && <span>{name}</span>}
              </div>
            );
          })}
      </div>
      {error && <p className="admin-upload-error">{error}</p>}

      {!submitted && (
        <div className="p1r-actions">
          <button type="button" className="btn btn-secondary" onClick={undo} disabled={fills.length === 0}>↶ Hoàn tác</button>
          <button type="button" className="btn btn-secondary" onClick={clearAll} disabled={fills.length === 0}>Xóa hết</button>
        </div>
      )}
    </div>
  );
}
