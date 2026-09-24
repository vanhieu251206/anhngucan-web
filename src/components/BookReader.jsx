import { useEffect, useLayoutEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import SoundMarkWidget from "./SoundMarkWidget.jsx";
import BookTabs from "./BookTabs.jsx";

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
  const tabs = book.tabs ?? []; // [{ label, page, color }] — tab đánh dấu unit ở mép sách
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
  // Lỗi thư viện: flipPrev() dùng toạ độ cứng x=10, ở chế độ 1 trang (portrait) điểm đó rơi vào
  // giữa trang chứ không phải góc → bị `disableFlipByClick` chặn, nút lùi trang không chạy. Tắt tạm
  // cờ này trong lúc gọi lật bằng nút (kiểm tra góc chạy đồng bộ nên bật lại ngay được).
  function withButtonFlip(fn, pf = pageFlip()) {
    if (!pf) return;
    const settings = pf.getSettings();
    const prev = settings.disableFlipByClick;
    settings.disableFlipByClick = false;
    try {
      fn(pf);
    } finally {
      settings.disableFlipByClick = prev;
    }
  }
  function goFirst() {
    withButtonFlip(pf => pf.flip(0));
  }
  function goPrev() {
    if (backBookEnabled) startBackFlip(pf => withButtonFlip(p => p.flipNext(), pf));
    else withButtonFlip(pf => pf.flipPrev());
  }

  // Chế độ 1 trang: hiệu ứng lùi trang mặc định của thư viện là kéo trang TRƯỚC bay vào từ bên trái
  // (lôi mép phải của trang trước) — không giống lật sách thật. Nên dùng 1 cuốn "soi gương" riêng
  // (lật ngang bằng CSS scaleX(-1), chỉ gồm [trang hiện tại, trang trước]): lật TỚI trên cuốn gương
  // = nhìn thấy mép TRÁI trang hiện tại cuộn sang phải, lộ trang trước bên dưới — đúng đối xứng với
  // lật tới. Cuốn gương ẩn sẵn, chỉ hiện trong lúc lùi trang; lật xong thì cuốn chính nhảy về trang
  // trước (không hiệu ứng) rồi mới ẩn gương, nên không bị nháy.
  const backBookEnabled = !!box && !box.spread && current > 0;
  const [backActive, setBackActive] = useState(false);
  const [backBase, setBackBase] = useState(current); // trang "hiện tại" của cuốn gương
  const backActiveRef = useRef(false);
  const backFlippedRef = useRef(false);
  const backBookRef = useRef(null);
  const wrapRef = useRef(null);
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    if (!backActiveRef.current) setBackBase(current);
  }, [current]);

  function backFlip() {
    return backBookRef.current?.pageFlip?.();
  }
  function isFlipBusy() {
    return backActiveRef.current || (pageFlip() && pageFlip().getState() !== "read");
  }
  // Trả về true nếu cuốn gương đã bắt đầu (để nơi gọi biết có nên chặn sự kiện hay không).
  function startBackFlip(run) {
    const pf = backFlip();
    if (!pf || isFlipBusy()) return false;
    backActiveRef.current = true;
    backFlippedRef.current = false;
    setBackActive(true);
    run(pf);
    return true;
  }
  function finishBackFlip() {
    if (!backActiveRef.current) return;
    if (backFlippedRef.current) {
      const prev = currentRef.current - 1;
      pageFlip()?.turnToPage(prev);
      setCurrent(prev);
    }
    backFlippedRef.current = false;
    // Đợi cuốn chính vẽ xong trang mới (thư viện vẽ ở requestAnimationFrame) rồi mới ẩn gương.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        backActiveRef.current = false;
        setBackActive(false);
        backFlip()?.turnToPage(0);
        setBackBase(currentRef.current);
      })
    );
  }

  // Kéo ở vùng mép trái trang (40% bề ngang, giống vùng "lật lùi" của thư viện) → chuyển thao tác
  // sang cuốn gương với toạ độ lật ngang. Bắt ở pha capture để cuốn chính không nhận được.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !backBookEnabled) return;

    function pointOf(e) {
      const t = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
      return { clientX: t.clientX, clientY: t.clientY };
    }
    function toMirror(block, p) {
      const r = block.getBoundingClientRect();
      return { x: r.width - (p.clientX - r.left), y: p.clientY - r.top };
    }

    function onDown(e) {
      if (e.type === "mousedown" && e.button !== 0) return;
      if (e.target.closest?.(".sound-mark-widget")) return;
      const main = pageFlip();
      const block = wrap.querySelector(".stf__block");
      if (!main || !block) return;
      const p = pointOf(e);
      const r = block.getBoundingClientRect();
      const b = main.getBoundsRect();
      const x = p.clientX - r.left;
      const y = p.clientY - r.top;
      const pageLeft = b.left + b.pageWidth;
      if (x < pageLeft || x > pageLeft + b.pageWidth * 0.4 || y < b.top || y > b.top + b.height) return;

      const isTouch = e.type === "touchstart";
      const started = startBackFlip(pf => pf.startUserTouch(toMirror(block, p)));
      if (!started) return;
      e.stopPropagation();
      e.preventDefault();

      function onMove(ev) {
        backFlip()?.userMove(toMirror(block, pointOf(ev)), isTouch);
        if (isTouch) ev.preventDefault();
      }
      function onUp(ev) {
        window.removeEventListener(isTouch ? "touchmove" : "mousemove", onMove);
        window.removeEventListener(isTouch ? "touchend" : "mouseup", onUp);
        const pf = backFlip();
        pf?.userStop(toMirror(block, pointOf(ev)));
        // Chạm rồi thả mà không kéo/không trúng góc → thư viện không lật, trạng thái vẫn "read".
        if (!pf || pf.getState() === "read") finishBackFlip();
      }
      window.addEventListener(isTouch ? "touchmove" : "mousemove", onMove, { passive: false });
      window.addEventListener(isTouch ? "touchend" : "mouseup", onUp);
    }

    wrap.addEventListener("mousedown", onDown, true);
    wrap.addEventListener("touchstart", onDown, { capture: true, passive: false });
    return () => {
      wrap.removeEventListener("mousedown", onDown, true);
      wrap.removeEventListener("touchstart", onDown, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backBookEnabled, box]);
  function goNext() {
    withButtonFlip(pf => pf.flipNext());
  }
  function goLast() {
    withButtonFlip(pf => pf.flip(pages.length - 1));
  }
  function jumpToPage() {
    const n = Math.min(pages.length, Math.max(1, parseInt(pageInput, 10) || 1));
    withButtonFlip(pf => pf.flip(n - 1));
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
    // Chừa chỗ 2 bên cho tab đánh dấu unit thò ra ngoài mép sách.
    const tabSize = tabs.length ? (el.clientWidth < 500 ? 16 : 26) : 0;
    const availW = el.clientWidth - 32 - tabSize * 2.6;
    const availH = el.clientHeight - 32;
    if (availW <= 0 || availH <= 0) return;
    const ratio = ratioRef.current;
    const spread = availW >= 700 && availW / availH > ratio * 1.3;

    // Luôn ưu tiên vừa hết CHIỀU CAO trước — chỉ thu nhỏ thêm nếu bề ngang cần dùng (1 hoặc 2 trang
    // cạnh nhau) vượt quá bề ngang khả dụng, để trang không bao giờ tràn cao hơn màn hình.
    const widthDivisor = spread ? 2 : 1;
    const pageHeight = Math.min(availH, availW / widthDivisor / ratio);
    const pageWidth = pageHeight * ratio;
    setBox({ pageWidth: Math.floor(pageWidth), pageHeight: Math.floor(pageHeight), spread, tabSize });
  }

  // Vùng sách đang hiện (theo toạ độ của .book-flip-wrap) để đặt tab đúng mép. Thư viện khởi tạo
  // trễ vài khung hình sau khi render nên dò lại bằng requestAnimationFrame tới khi đo được.
  const [bookRect, setBookRect] = useState(null);
  useEffect(() => {
    if (!box || !tabs.length) return;
    let raf;
    let tries = 0;
    function measure() {
      const pf = pageFlip();
      const wrap = wrapRef.current;
      const block = wrap?.querySelector(".stf__block");
      const b = pf?.getBoundsRect?.();
      if (!pf || !block || !b) {
        if (tries++ < 60) raf = requestAnimationFrame(measure);
        return;
      }
      const wr = wrap.getBoundingClientRect();
      const br = block.getBoundingClientRect();
      const portrait = pf.getOrientation() === "portrait";
      setBookRect({
        left: br.left - wr.left + b.left + (portrait ? b.pageWidth : 0),
        top: br.top - wr.top + b.top,
        width: portrait ? b.pageWidth : b.pageWidth * 2,
        height: b.height,
      });
    }
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, tabs.length]);

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

  const flipBookProps = box && {
    width: box.pageWidth,
    height: box.pageHeight,
    size: "fixed",
    showCover: false,
    disableFlipByClick: true,
    mobileScrollSupport: false,
    drawShadow: true,
    maxShadowOpacity: 0.5,
    flippingTime: 500,
    className: "book-flipbook",
    style: {},
  };

  function renderPageContent(i) {
    return (
      <>
        <img src={pages[i]} alt={`${book.title} — trang ${i + 1}`} draggable="false" />
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
      </>
    );
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
          <div className="book-flip-wrap" ref={wrapRef}>
            <BookTabs
              tabs={tabs}
              rect={bookRect}
              currentPage={current}
              size={box.tabSize}
              onJump={page => withButtonFlip(pf => pf.flip(page))}
            />
            <HTMLFlipBook
              ref={flipBookRef}
              key={`${pages.length}-${box.pageWidth}-${box.pageHeight}-${box.spread}`}
              {...flipBookProps}
              usePortrait={!box.spread}
              startPage={current}
              onFlip={e => setCurrent(e.data)}
            >
              {pages.map((src, i) => (
                <div className="book-flip-page" key={i}>
                  {renderPageContent(i)}
                </div>
              ))}
            </HTMLFlipBook>

            {backBookEnabled && (
              <div className={`book-back-layer ${backActive ? "is-active" : ""}`}>
                <HTMLFlipBook
                  ref={backBookRef}
                  key={`back-${pages.length}-${box.pageWidth}-${box.pageHeight}`}
                  {...flipBookProps}
                  usePortrait={true}
                  useMouseEvents={false}
                  startPage={0}
                  onFlip={e => { backFlippedRef.current = e.data === 1; }}
                  onChangeState={e => e.data === "read" && finishBackFlip()}
                >
                  {/* key cố định để React chỉ thay nội dung trong trang, không gỡ DOM mà thư viện đang giữ */}
                  {["cur", "prev"].map((slot, si) => {
                    const i = backBase - si;
                    return (
                      <div className="book-flip-page" key={slot}>
                        <div className="book-back-page-inner">{i >= 0 && renderPageContent(i)}</div>
                      </div>
                    );
                  })}
                </HTMLFlipBook>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
