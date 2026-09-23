import { useEffect, useLayoutEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import SoundMarkWidget from "./SoundMarkWidget.jsx";

// Tỉ lệ khung 1 trang mặc định (khổ dọc kiểu sách giáo trình thiếu nhi, 3:4) — dùng khi chưa đo
// được ảnh trang thật, để không bị vỡ layout trước khi ảnh đầu tiên tải xong.
const DEFAULT_RATIO = 3 / 4;

// Sách online cho Kids — dùng react-pageflip để có đúng hiệu ứng "cong trang giấy thật" (bẻ góc +
// đổ bóng) như sách lật thật, kéo được ở BẤT KỲ đâu trên trang. `showCover: true` (đánh dấu trang
// đầu/cuối là "hard page" hiện một mình) đã THỬ nhưng bị lỗi thực tế: trang bìa (hard page) không
// kéo lật được như các trang khác (thư viện xử lý vùng kéo của hard page khác hẳn soft page) — nên
// đã tắt showCover để MỌI trang (kể cả bìa) kéo được nhất quán, đánh đổi việc trang bìa không còn
// hiện tách biệt hẳn 1 mình nữa (chốt người dùng 2026-09-23, ưu tiên kéo được hơn đúng bố cục bìa).
// QUAN TRỌNG: size="stretch" của thư viện tính sai (ưu tiên khớp chiều rộng, không kiểm tra đủ
// chiều cao còn lại, khiến trang vỡ khung/bị cắt — lỗi thực tế gặp phải) — nên tự đo container bằng
// ResizeObserver, tính khít CẢ 2 chiều, rồi truyền size="fixed".
export default function BookReader({ book, onBack }) {
  const pages = book.pages ?? [];
  const sounds = book.sounds ?? []; // Array<{x,y,url}>[] — điểm audio đặt ngay trên ảnh từng trang
  const [current, setCurrent] = useState(0);
  const [playingKey, setPlayingKey] = useState(null); // `${pageIndex}-${markIndex}` đang phát
  const [progress, setProgress] = useState(0); // 0..1, tiến trình phát của playingKey
  const [fullscreen, setFullscreen] = useState(false);
  const [pageInput, setPageInput] = useState("1");
  const audioRef = useRef(null);
  const stageRef = useRef(null);
  const flipBookRef = useRef(null);
  const rootRef = useRef(null);
  const [box, setBox] = useState(null); // { pageWidth, pageHeight, spread }
  const ratioRef = useRef(DEFAULT_RATIO);

  useEffect(() => {
    setPageInput(String(current + 1));
  }, [current]);

  useEffect(() => {
    function onFsChange() {
      setFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function pageFlip() {
    return flipBookRef.current?.pageFlip?.();
  }
  function goFirst() {
    pageFlip()?.flip(0);
  }
  function goPrev() {
    pageFlip()?.flipPrev();
  }
  function goNext() {
    pageFlip()?.flipNext();
  }
  function goLast() {
    pageFlip()?.flip(pages.length - 1);
  }
  function jumpToPage() {
    const n = Math.min(pages.length, Math.max(1, parseInt(pageInput, 10) || 1));
    pageFlip()?.flip(n - 1);
    setPageInput(String(n));
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }

  useEffect(() => {
    audioRef.current?.pause();
    setPlayingKey(null);
  }, [current]);

  // Đo tỉ lệ thật của ảnh trang đầu tiên (thay cho DEFAULT_RATIO đoán sẵn) — các trang PDF xuất ra
  // thường cùng khổ nên đo 1 lần là đủ cho cả sách.
  useEffect(() => {
    if (!pages[0]) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        ratioRef.current = img.naturalWidth / img.naturalHeight;
        recompute();
      }
    };
    img.src = pages[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages[0]]);

  function recompute() {
    const el = stageRef.current;
    if (!el) return;
    const availW = el.clientWidth;
    const availH = el.clientHeight;
    if (!availW || !availH) return;
    const ratio = ratioRef.current;
    const spread = availW >= 700 && availW / availH > ratio * 1.3;

    // Luôn ưu tiên vừa hết CHIỀU CAO trước — chỉ thu nhỏ thêm nếu bề ngang cần dùng (1 hoặc 2 trang
    // cạnh nhau) vượt quá bề ngang khả dụng, để trang không bao giờ tràn cao hơn màn hình.
    const widthDivisor = spread ? 2 : 1;
    const pageHeight = Math.min(availH, availW / widthDivisor / ratio);
    const pageWidth = pageHeight * ratio;
    setBox({ pageWidth: Math.floor(pageWidth), pageHeight: Math.floor(pageHeight), spread });
  }

  useLayoutEffect(() => {
    recompute();
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bấm 1 điểm loa trên trang: bấm lại đúng điểm đang phát thì dừng, bấm điểm khác thì phát điểm đó.
  function toggleMark(key, url) {
    const el = audioRef.current;
    if (!el) return;
    if (playingKey === key) {
      el.pause();
      setPlayingKey(null);
      return;
    }
    el.src = url;
    el.currentTime = 0;
    setProgress(0);
    el.play();
    setPlayingKey(key);
  }

  function handleAudioTimeUpdate() {
    const el = audioRef.current;
    if (!el?.duration) return;
    setProgress(el.currentTime / el.duration);
  }

  return (
    <div className="book-reader" ref={rootRef}>
      <div className="book-reader-topbar">
        <button className="speaking-fullscreen-back" onClick={onBack}>
          ⬅ Quay lại
        </button>
        <span className="speaking-fullscreen-title">{book.title}</span>

        {pages.length > 0 && (
          <div className="book-reader-tools">
            <button type="button" className="book-reader-tool-btn" title="Trang đầu" onClick={goFirst}>⏮</button>
            <button type="button" className="book-reader-tool-btn" title="Trang trước" onClick={goPrev}>◀</button>
            <input
              className="book-reader-page-input"
              value={pageInput}
              onChange={e => setPageInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && jumpToPage()}
              onBlur={jumpToPage}
            />
            <span className="book-reader-page-total">/ {pages.length}</span>
            <button type="button" className="book-reader-tool-btn" title="Trang sau" onClick={goNext}>▶</button>
            <button type="button" className="book-reader-tool-btn" title="Trang cuối" onClick={goLast}>⏭</button>
            <button type="button" className="book-reader-tool-btn" title="Toàn màn hình" onClick={toggleFullscreen}>
              {fullscreen ? "⤡" : "⤢"}
            </button>
          </div>
        )}
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingKey(null)} onTimeUpdate={handleAudioTimeUpdate} />

      <div className="book-reader-stage" ref={stageRef}>
        {pages.length === 0 ? (
          <p className="admin-muted-text">Sách này chưa có trang nào.</p>
        ) : box ? (
          <HTMLFlipBook
            ref={flipBookRef}
            key={`${pages.length}-${box.pageWidth}-${box.pageHeight}-${box.spread}`}
            width={box.pageWidth}
            height={box.pageHeight}
            size="fixed"
            showCover={false}
            usePortrait={!box.spread}
            disableFlipByClick={true}
            mobileScrollSupport={false}
            drawShadow={true}
            maxShadowOpacity={0.5}
            flippingTime={500}
            className="book-flipbook"
            style={{}}
            startPage={current}
            onFlip={e => setCurrent(e.data)}
          >
            {pages.map((src, i) => (
              <div className="book-flip-page" key={i}>
                <img src={src} alt={`${book.title} — trang ${i + 1}`} draggable="false" />
                {(sounds[i] ?? []).map((m, mi) => {
                  const key = `${i}-${mi}`;
                  return m.url ? (
                    <div
                      key={mi}
                      onPointerDown={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                      onTouchStart={e => e.stopPropagation()}
                    >
                      <SoundMarkWidget
                        x={m.x}
                        y={m.y}
                        pageWidth={box.pageWidth}
                        playing={playingKey === key}
                        progress={playingKey === key ? progress : 0}
                        onToggle={() => toggleMark(key, m.url)}
                      />
                    </div>
                  ) : null;
                })}
              </div>
            ))}
          </HTMLFlipBook>
        ) : null}
      </div>
    </div>
  );
}
