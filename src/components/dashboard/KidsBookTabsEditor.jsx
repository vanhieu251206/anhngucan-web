import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import BookTabs from "../BookTabs.jsx";

const RATIO = 3 / 4;
const TAB_SIZE = 26;
const LOUPE_PIXELS = 11; // số pixel ảnh gốc mỗi chiều hiện trong kính lúp
const LOUPE_SIZE = 110;

function toHex(r, g, b) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

// Soạn tab đánh dấu unit ở mép sách: mỗi tab = { label, page (0-based), color }. Lật tới trang đầu
// unit → "Thêm tab tại trang này"; màu lấy bằng công cụ hút màu (bấm 🎯 rồi bấm vào đúng chỗ màu
// unit trên ảnh trang, có kính lúp phóng to pixel như phần mềm thiết kế). Tab hiện xem trước ngay
// cạnh trang bằng đúng component học sinh thấy (BookTabs.jsx).
export default function KidsBookTabsEditor({ pages, tabs, onChange, onClose }) {
  const confirm = useConfirm();
  const [current, setCurrent] = useState(0);
  const [box, setBox] = useState(null);
  const [pickingIndex, setPickingIndex] = useState(null); // tab đang hút màu
  const [loupe, setLoupe] = useState(null); // { x, y, hex } theo toạ độ khung trang
  const [pickError, setPickError] = useState("");
  const stageRef = useRef(null);
  const loupeCanvasRef = useRef(null);
  const sampleCanvasRef = useRef(null); // canvas chứa ảnh trang đầy đủ để đọc pixel
  const src = pages[current];

  useLayoutEffect(() => {
    function recompute() {
      const el = stageRef.current;
      if (!el) return;
      const availW = el.clientWidth - TAB_SIZE * 3;
      const availH = el.clientHeight - 20;
      if (availW <= 0 || availH <= 0) return;
      let h = availH;
      let w = h * RATIO;
      if (w > availW) {
        w = availW;
        h = w / RATIO;
      }
      setBox({ width: Math.floor(w), height: Math.floor(h), stageW: el.clientWidth, stageH: el.clientHeight });
    }
    recompute();
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Nạp ảnh trang vào canvas ẩn (crossOrigin — Cloudinary có trả CORS) để đọc được màu pixel.
  useEffect(() => {
    sampleCanvasRef.current = null;
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      try {
        ctx.getImageData(0, 0, 1, 1);
        sampleCanvasRef.current = c;
      } catch {
        sampleCanvasRef.current = null;
      }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    if (pickingIndex == null) return;
    function onKey(e) {
      if (e.key === "Escape") stopPicking();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickingIndex]);

  function stopPicking() {
    setPickingIndex(null);
    setLoupe(null);
  }

  // Toạ độ chuột → pixel ảnh gốc (ảnh hiển thị object-fit: contain nên tính đúng phần ảnh thật).
  function pixelAt(e) {
    const c = sampleCanvasRef.current;
    if (!c) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / c.width, rect.height / c.height);
    const offX = (rect.width - c.width * scale) / 2;
    const offY = (rect.height - c.height * scale) / 2;
    const px = Math.floor((e.clientX - rect.left - offX) / scale);
    const py = Math.floor((e.clientY - rect.top - offY) / scale);
    if (px < 0 || py < 0 || px >= c.width || py >= c.height) return null;
    return { px, py, x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePageMove(e) {
    if (pickingIndex == null) return;
    const p = pixelAt(e);
    const c = sampleCanvasRef.current;
    if (!p || !c) {
      setLoupe(null);
      return;
    }
    const [r, g, b] = c.getContext("2d").getImageData(p.px, p.py, 1, 1).data;
    setLoupe({ x: p.x, y: p.y, hex: toHex(r, g, b) });
    const lc = loupeCanvasRef.current;
    if (lc) {
      const ctx = lc.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
      const half = Math.floor(LOUPE_PIXELS / 2);
      ctx.drawImage(c, p.px - half, p.py - half, LOUPE_PIXELS, LOUPE_PIXELS, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
      const cell = LOUPE_SIZE / LOUPE_PIXELS;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(half * cell, half * cell, cell, cell);
    }
  }

  async function startPicking(index) {
    setPickError("");
    if (sampleCanvasRef.current) {
      setPickingIndex(index);
      return;
    }
    // Không đọc được pixel ảnh (ảnh chặn CORS) → dùng công cụ hút màu có sẵn của trình duyệt nếu có.
    if (typeof window.EyeDropper === "function") {
      try {
        const { sRGBHex } = await new window.EyeDropper().open();
        updateTab(index, { color: sRGBHex });
      } catch {
        // người dùng bấm Esc
      }
      return;
    }
    setPickError("Không đọc được màu trên ảnh này — bấm vào ô màu để chọn tay.");
  }

  function handlePageClick(e) {
    if (pickingIndex == null) return;
    if (loupe) updateTab(pickingIndex, { color: loupe.hex });
    stopPicking();
  }

  function updateTab(index, patch) {
    onChange(tabs.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTabHere() {
    const last = tabs[tabs.length - 1];
    const next = [...tabs, { label: String(tabs.length + 1), page: current, color: last?.color ?? "#F2A93B" }];
    onChange(next);
    startPicking(next.length - 1);
  }

  async function removeTab(index) {
    if (!(await confirm("Xoá tab này?", { danger: true }))) return;
    onChange(tabs.filter((_, i) => i !== index));
  }

  const pageRect = box && {
    left: (box.stageW - box.width) / 2,
    top: (box.stageH - box.height) / 2,
    width: box.width,
    height: box.height,
  };

  return (
    <div className="kids-sound-editor">
      <div className="kids-sound-editor-topbar">
        <button type="button" className="admin-pill-btn" onClick={onClose}>← Đóng</button>
        <div className="kids-sound-editor-nav">
          <button type="button" className="book-reader-tool-btn" onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}>◀</button>
          <span>Trang {current + 1} / {pages.length}</span>
          <button type="button" className="book-reader-tool-btn" onClick={() => setCurrent(p => Math.min(pages.length - 1, p + 1))} disabled={current === pages.length - 1}>▶</button>
        </div>
        <button type="button" className="admin-pill-btn" style={{ marginLeft: "auto" }} onClick={addTabHere}>
          🔖 Thêm tab tại trang này
        </button>
      </div>
      {pickError && <p className="admin-upload-error kids-sound-editor-error">{pickError}</p>}

      <div className="kids-sound-editor-body">
        <div className="kids-sound-editor-stage kids-tabs-stage" ref={stageRef}>
          {box && (
            <>
              <BookTabs tabs={tabs} rect={pageRect} currentPage={current} size={TAB_SIZE} onJump={setCurrent} />
              <div
                className={`kids-sound-editor-page kids-tabs-page${pickingIndex != null ? " is-picking" : ""}`}
                style={{ width: box.width, height: box.height, left: pageRect.left, top: pageRect.top }}
                onMouseMove={handlePageMove}
                onMouseLeave={() => setLoupe(null)}
                onClick={handlePageClick}
              >
                <img src={src} alt={`Trang ${current + 1}`} draggable="false" />
                {pickingIndex != null && (
                  <div
                    className="kids-color-loupe"
                    style={{ left: loupe?.x ?? 0, top: loupe?.y ?? 0, visibility: loupe ? "visible" : "hidden" }}
                  >
                    <canvas ref={loupeCanvasRef} width={LOUPE_SIZE} height={LOUPE_SIZE} />
                    <span style={{ background: loupe?.hex }}>{loupe?.hex}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="kids-sound-editor-list">
          {tabs.length === 0 && <p className="admin-muted-text">Chưa có tab nào.</p>}
          {tabs.map((t, i) => (
            <div className={`kids-sound-list-item${t.page === current ? " is-current-page" : ""}`} key={i}>
              <span className="admin-scene-list-index">{i + 1}</span>
              <input
                className="kids-tab-label-input"
                value={t.label}
                onChange={e => updateTab(i, { label: e.target.value })}
                title="Chữ trên tab"
              />
              <label className="kids-tab-page-field">
                Trang
                <input
                  type="number"
                  min={1}
                  max={pages.length}
                  value={t.page + 1}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    if (n >= 1 && n <= pages.length) updateTab(i, { page: n - 1 });
                  }}
                />
              </label>
              <button type="button" className="kids-sound-list-page" onClick={() => setCurrent(t.page)}>Xem</button>
              <input
                type="color"
                className="kids-tab-color-input"
                value={t.color || "#F2A93B"}
                onChange={e => updateTab(i, { color: e.target.value })}
                title="Chọn màu tay"
              />
              <button
                type="button"
                className={`admin-pill-btn kids-tab-pick-btn${pickingIndex === i ? " is-active" : ""}`}
                onClick={() => (pickingIndex === i ? stopPicking() : startPicking(i))}
                title="Hút màu trên ảnh trang"
              >
                🎯
              </button>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeTab(i)}>Xoá</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
