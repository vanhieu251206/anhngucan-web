import { useEffect, useLayoutEffect, useRef, useState } from "react";
import AudioUploadField from "./AudioUploadField.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";
import { uploadToCloudinary } from "../../lib/cloudinaryUpload.js";
import SoundMarkWidget from "../SoundMarkWidget.jsx";

const RATIO = 3 / 4;

// Đánh số track theo đúng thứ tự đọc sách (trang → thứ tự đặt trong trang) — Track 1 là điểm audio
// đầu tiên trong cả sách, tăng dần xuyên suốt, KHÔNG reset lại theo từng trang.
function flattenTracks(sounds) {
  const list = [];
  (sounds ?? []).forEach((marks, pageIndex) => {
    (marks ?? []).forEach((m, markIndex) => list.push({ pageIndex, markIndex, ...m }));
  });
  return list;
}

function sortFilesNatural(files) {
  return [...files].sort((a, b) => {
    const na = parseInt(a.name.match(/\d+/)?.[0] ?? "", 10);
    const nb = parseInt(b.name.match(/\d+/)?.[0] ?? "", 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    if (!isNaN(na) !== !isNaN(nb)) return isNaN(na) ? 1 : -1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

// Lật từng trang xem trước NGAY TRONG CMS để đặt track audio đúng vị trí trên ảnh (chốt người dùng
// 2026-09-23): bấm vào ảnh trang để đánh dấu 1 track mới (tự đánh số Track 1, Track 2... theo thứ
// tự trong cả sách), sau đó "Tải hàng loạt" nhiều file audio đặt tên 1/2/3...N — tự khớp lần lượt
// vào đúng Track 1/2/3...N đã đánh dấu (không cần tick chọn từng cái).
export default function KidsBookSoundEditor({ pages, sounds, onChange, onClose }) {
  const confirm = useConfirm();
  const [current, setCurrent] = useState(0);
  const stageRef = useRef(null);
  const pageRef = useRef(null);
  const dragRef = useRef(null); // { markIndex, moved }
  const justDraggedRef = useRef(false);
  const [box, setBox] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStage, setBulkStage] = useState("");
  const [bulkError, setBulkError] = useState("");
  const audioRef = useRef(null);
  const [playingKey, setPlayingKey] = useState(null);
  const [progress, setProgress] = useState(0);

  const flat = flattenTracks(sounds);
  const marks = sounds?.[current] ?? [];

  useEffect(() => {
    audioRef.current?.pause();
    setPlayingKey(null);
  }, [current]);

  // Nghe thử ngay trong CMS đúng bằng widget sẽ hiện cho học sinh — bấm lại để dừng.
  function toggleTestPlay(key, url) {
    const el = audioRef.current;
    if (!el || !url) return;
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

  useLayoutEffect(() => {
    function recompute() {
      const el = stageRef.current;
      if (!el) return;
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      if (!availW || !availH) return;
      let h = availH;
      let w = h * RATIO;
      if (w > availW) {
        w = availW;
        h = w / RATIO;
      }
      setBox({ width: Math.floor(w), height: Math.floor(h) });
    }
    recompute();
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function addMark(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const next = (sounds ?? []).map(arr => arr ?? []);
    next[current] = [...(next[current] ?? []), { x, y, url: null }];
    onChange(next);
  }

  // Sửa được audio của track ở BẤT KỲ trang nào ngay từ danh sách tổng quan bên phải, không cần
  // lật tới đúng trang đó trước (chốt người dùng 2026-09-23, mở rộng danh sách thành xem toàn sách).
  function updateMarkUrlAt(pageIndex, markIndex, url) {
    const next = (sounds ?? []).map(arr => arr ?? []);
    next[pageIndex] = next[pageIndex].map((m, i) => (i === markIndex ? { ...m, url } : m));
    onChange(next);
  }

  async function removeMarkAt(pageIndex, markIndex) {
    if (!(await confirm("Xoá track này?", { danger: true }))) return;
    const next = (sounds ?? []).map(arr => arr ?? []);
    next[pageIndex] = next[pageIndex].filter((_, i) => i !== markIndex);
    onChange(next);
  }

  function updateMarkPosition(markIndex, x, y) {
    const next = (sounds ?? []).map(arr => arr ?? []);
    next[current] = next[current].map((m, i) => (i === markIndex ? { ...m, x, y } : m));
    onChange(next);
  }

  // Kéo dịch chuyển 1 track đã đặt — bắt đầu kéo NGAY TRÊN widget đó (chặn click lan ra ngoài để
  // không bị hiểu nhầm thành "đặt track mới" ở đúng chỗ vừa thả tay, chốt người dùng 2026-09-23).
  function handleMarkPointerDown(markIndex, e) {
    e.stopPropagation();
    dragRef.current = { markIndex, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function handleMarkPointerMove(e) {
    const info = dragRef.current;
    if (!info || !pageRef.current) return;
    info.moved = true;
    const rect = pageRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10));
    const y = Math.min(100, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10));
    updateMarkPosition(info.markIndex, x, y);
  }
  function handleMarkPointerUp() {
    if (dragRef.current?.moved) justDraggedRef.current = true;
    dragRef.current = null;
  }

  // Vừa kéo xong thì bỏ qua click nghe thử kế tiếp (trình duyệt vẫn bắn 1 sự kiện click sau
  // pointerup) — không thì thả tay xong lại vô tình bật/tắt audio ngoài ý muốn.
  function handleToggleAfterDrag(key, url) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    toggleTestPlay(key, url);
  }

  // Tải nhiều file audio cùng lúc, đặt tên có số thứ tự Track (vd "Track 002.mp3", "5.mp3"...) —
  // khớp theo ĐÚNG SỐ có trong tên file vào Track cùng số đó, KHÔNG theo vị trí sắp xếp (vì có thể
  // chỉ tải 1 phần, vd Track 2-6 mà chưa có Track 1 — khớp theo thứ tự sẽ bị lệch 1 track).
  async function handleBulkUpload(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (flat.length === 0) {
      setBulkError("Chưa đánh dấu track nào trên trang — bấm vào ảnh trang để đặt Track trước.");
      return;
    }
    setBulkError("");
    setBulkBusy(true);
    const sorted = sortFilesNatural(files);
    const matched = sorted
      .map(file => ({ file, num: parseInt(file.name.match(/\d+/)?.[0] ?? "", 10) }))
      .filter(({ num }) => !isNaN(num) && num >= 1 && num <= flat.length);
    const skipped = sorted.length - matched.length;
    try {
      const next = (sounds ?? []).map(arr => (arr ? arr.map(m => ({ ...m })) : []));
      for (let i = 0; i < matched.length; i++) {
        const { file, num } = matched[i];
        setBulkStage(`Đang tải Track ${num} (${i + 1}/${matched.length})...`);
        const url = await uploadToCloudinary(file);
        const { pageIndex, markIndex } = flat[num - 1];
        next[pageIndex][markIndex] = { ...next[pageIndex][markIndex], url };
      }
      onChange(next);
      if (skipped > 0) {
        setBulkError(`Đã khớp ${matched.length} file. Bỏ qua ${skipped} file không đọc được số track hợp lệ (1-${flat.length}) trong tên file.`);
      }
    } catch (err) {
      setBulkError(err.message || "Tải hàng loạt thất bại");
    } finally {
      setBulkBusy(false);
      setBulkStage("");
    }
  }

  const src = pages[current];

  return (
    <div className="kids-sound-editor">
      <div className="kids-sound-editor-topbar">
        <button type="button" className="admin-pill-btn" onClick={onClose}>← Đóng xem trước</button>
        <div className="kids-sound-editor-nav">
          <button type="button" className="book-reader-tool-btn" onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}>◀</button>
          <span>Trang {current + 1} / {pages.length}</span>
          <button type="button" className="book-reader-tool-btn" onClick={() => setCurrent(p => Math.min(pages.length - 1, p + 1))} disabled={current === pages.length - 1}>▶</button>
        </div>
        <label className="admin-pill-btn" style={{ marginLeft: "auto", cursor: bulkBusy ? "wait" : "pointer", opacity: bulkBusy ? 0.6 : 1 }}>
          {bulkBusy ? bulkStage : "📤 Tải hàng loạt Track 1,2,3..."}
          <input type="file" accept="audio/*" multiple hidden disabled={bulkBusy} onChange={handleBulkUpload} />
        </label>
      </div>
      {bulkError && <p className="admin-upload-error kids-sound-editor-error">{bulkError}</p>}

      <audio ref={audioRef} onEnded={() => setPlayingKey(null)} onTimeUpdate={handleAudioTimeUpdate} />

      <div className="kids-sound-editor-body">
        <div className="kids-sound-editor-stage" ref={stageRef}>
          {box && (
            <div ref={pageRef} className="kids-sound-editor-page" style={{ width: box.width, height: box.height }} onClick={addMark}>
              <img src={src} alt={`Trang ${current + 1}`} draggable="false" />
              {marks.map((m, mi) => {
                const trackNum = flat.findIndex(t => t.pageIndex === current && t.markIndex === mi) + 1;
                const key = `${current}-${mi}`;
                return (
                  <div
                    key={mi}
                    className="kids-sound-mark-draggable"
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => handleMarkPointerDown(mi, e)}
                    onPointerMove={handleMarkPointerMove}
                    onPointerUp={handleMarkPointerUp}
                    onPointerCancel={handleMarkPointerUp}
                  >
                    <SoundMarkWidget
                      x={m.x}
                      y={m.y}
                      pageWidth={box.width}
                      badge={trackNum}
                      empty={!m.url}
                      playing={playingKey === key}
                      progress={playingKey === key ? progress : 0}
                      onToggle={() => handleToggleAfterDrag(key, m.url)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="kids-sound-editor-list">
          <p className="admin-hint">Bấm vào ảnh trang để đặt track mới. Tổng cộng {flat.length} track trong sách.</p>
          {flat.length === 0 && <p className="admin-muted-text">Sách này chưa có track nào.</p>}
          {flat.map((t, idx) => (
            <div className={`kids-sound-list-item${t.pageIndex === current ? " is-current-page" : ""}`} key={`${t.pageIndex}-${t.markIndex}`}>
              <span className="admin-scene-list-index">{idx + 1}</span>
              <button type="button" className="kids-sound-list-page" onClick={() => setCurrent(t.pageIndex)}>
                Trang {t.pageIndex + 1}
              </button>
              <AudioUploadField value={t.url} onChange={url => updateMarkUrlAt(t.pageIndex, t.markIndex, url)} />
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeMarkAt(t.pageIndex, t.markIndex)}>Xoá</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
