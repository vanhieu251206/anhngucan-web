import { useEffect, useRef, useState } from "react";

// Lớp phủ toàn màn hình hiện khung hình vừa chụp của cửa sổ PDF (lib/screenScan.js) để giáo viên kéo
// khung chữ nhật bằng 2 lần click (góc thứ nhất → góc đối diện) — mỗi khung = 1 ảnh, gửi toạ độ theo pixel
// ảnh gốc qua onCrop. Chọn được nhiều khung liên tiếp; Esc huỷ góc đang chọn dở, bấm Esc lần nữa để thoát.
const MIN_SIZE_PX = 8;

export default function ScreenCropOverlay({ frame, nextLabel, onCrop, onClose }) {
  const canvasRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [done, setDone] = useState([]);

  useEffect(() => {
    const c = canvasRef.current;
    c.width = frame.width;
    c.height = frame.height;
    c.getContext("2d").drawImage(frame, 0, 0);
  }, [frame]);

  useEffect(() => {
    const onKey = e => {
      if (e.key !== "Escape") return;
      if (drag) setDrag(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag, onClose]);

  // Toạ độ chuột → pixel trên ảnh gốc (canvas hiển thị đã co cho vừa màn hình).
  function toFrame(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
    return { x: (x / r.width) * frame.width, y: (y / r.height) * frame.height };
  }

  function rectOf(d) {
    return { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) };
  }

  function handleClick(e) {
    if (!nextLabel) return;
    const p = toFrame(e);
    if (!drag) {
      setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      return;
    }
    const r = rectOf({ ...drag, x1: p.x, y1: p.y });
    if (r.w < MIN_SIZE_PX || r.h < MIN_SIZE_PX) return;
    setDrag(null);
    const rounded = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
    setDone(list => [...list, rounded]);
    onCrop(rounded);
  }

  function handleMove(e) {
    if (!drag) return;
    const p = toFrame(e);
    setDrag(d => ({ ...d, x1: p.x, y1: p.y }));
  }

  const pct = r => ({
    left: `${(r.x / frame.width) * 100}%`,
    top: `${(r.y / frame.height) * 100}%`,
    width: `${(r.w / frame.width) * 100}%`,
    height: `${(r.h / frame.height) * 100}%`,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 1, background: "#fff", color: "#222", borderRadius: 999, padding: "6px 16px", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
        {nextLabel ? `Ô tiếp theo: ${nextLabel}` : "Đã đủ ảnh"} · Esc để thoát
      </div>
      <div
        style={{ position: "relative", lineHeight: 0, cursor: nextLabel ? "crosshair" : "default", userSelect: "none", touchAction: "none" }}
        onClick={handleClick}
        onPointerMove={handleMove}
      >
        <canvas ref={canvasRef} style={{ maxWidth: "100vw", maxHeight: "100vh", display: "block" }} />
        {done.map((r, i) => (
          <div key={i} style={{ position: "absolute", ...pct(r), border: "2px solid #22c55e", background: "rgba(34,197,94,0.15)" }} />
        ))}
        {drag && <div style={{ position: "absolute", ...pct(rectOf(drag)), border: "2px dashed #fff", boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />}
      </div>
    </div>
  );
}
