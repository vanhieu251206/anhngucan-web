import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/authContext.jsx";
import { importReviewMeta, loadReviewMeta } from "../lib/duyetSo.js";
import { startReview } from "../lib/duyetSoReview.js";
import "./duyetSo.css";

// Trang Duyệt số thửa (2026-10-25, lib/duyetSo.js): tài khoản đặc biệt `phonglon` đăng nhập là vào thẳng đây (App.jsx);
// admin vào qua ?page=duyet-so, nhập dữ liệu (file du_lieu_duyet_*.json do Claude chuẩn bị) và tải kết quả.
// Markup giữ đúng id của trang Claude (tiền tố ds-) — logic DOM ở lib/duyetSoReview.js.
export default function DuyetSoPage() {
  const { isAdmin, logout, profile } = useAuth();
  const root = useRef(null);
  const [meta, setMeta] = useState(undefined);  // undefined = đang tải, null = chưa nhập dữ liệu
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let alive = true;
    loadReviewMeta().then(m => alive && setMeta(m), e => alive && setError("Không tải được dữ liệu: " + (e?.message || e)));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!meta || !root.current) return;
    return startReview(root.current, { ...meta, title: meta.ten || "Duyệt số thửa" });
  }, [meta]);

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (meta && !window.confirm("Nhập đè dữ liệu ô và ảnh? Kết quả đã duyệt vẫn giữ (theo mã ô).")) return;
    setImporting(true); setError("");
    try {
      const n = await importReviewMeta(file);
      window.alert(`Đã nhập ${n} ô.`);
      setMeta(await loadReviewMeta());
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setImporting(false);
    }
  }

  const importButton = isAdmin && (
    <label style={{ cursor: "pointer" }}>
      <input type="file" accept="application/json,.json" hidden onChange={onImport} disabled={importing} />
      <span className="ds-sub">{importing ? "Đang nhập…" : "Nhập dữ liệu (admin)"}</span>
    </label>
  );

  return (
    <div className="ds">
      {meta === undefined && !error && <div className="ds-empty">Đang tải…</div>}
      {(meta === null || error) && (
        <div className="ds-empty">
          {error ? <p>{error}</p> : <p>Chưa có dữ liệu duyệt.{isAdmin ? " Bấm Nhập dữ liệu và chọn file du_lieu_duyet_*.json." : " Báo anh Hiếu nhập dữ liệu."}</p>}
          <p>{importButton} <button type="button" onClick={logout}>Đăng xuất</button></p>
        </div>
      )}
      {meta && (
        <div className="ds-wrap" ref={root}>
          <div className="ds-head">
            <span>{profile?.username || profile?.email}</span>
            {importButton}
            <button type="button" id="ds-export" title="Tải file kết quả để gửi anh Hiếu (gửi được nhiều lần, mỗi lần đủ mọi ô đã duyệt)">⬇ Tải kết quả</button>
            <button type="button" onClick={logout}>Đăng xuất</button>
          </div>
          <div className="ds-top">
            <h1 id="ds-title" /> <span className="ds-sub" id="ds-count" />
            <label className="ds-pick">File <select id="ds-tif" /></label>
            <label className="ds-pick">Nhóm <select id="ds-loai" /></label>
          </div>
          <div className="ds-bar"><i id="ds-bar" /></div>
          <div className="ds-finished" id="ds-finished" hidden>
            Đã duyệt hết. Bấm tải kết quả và gửi file cho anh Hiếu.
            <button type="button" id="ds-export2">⬇ Tải kết quả</button>
          </div>
          <div className="ds-notice" id="ds-notice" hidden />
          <div className="ds-stage">
            <div className="ds-tile" id="ds-tile" role="img" />
            <div className="ds-panel">
              <div className="ds-code" id="ds-code" />
              <span className="ds-kind" id="ds-kind" />
              <div className="ds-hint" id="ds-hint" />
              <form id="ds-form" autoComplete="off"><div className="ds-rows" id="ds-rows" /><button type="submit" hidden /></form>
              <span className="ds-done" id="ds-done" hidden />
              <div className="ds-tools">
                <button type="button" id="ds-add" title="Thêm số (Tab)">+ Số</button>
                <button type="button" id="ds-peek" title="Giữ để ẩn các điểm (Ctrl)">Ẩn điểm</button>
                <button type="button" id="ds-help" aria-expanded="false" title="Phím tắt">?</button>
              </div>
              <div className="ds-help" id="ds-helpbox" hidden>
                <b>Lưu</b>: Enter (hoặc nút Lưu) · <b>Xoá + Lưu</b> (Shift+Delete hoặc Ctrl+Backspace): bỏ ô, không đặt số · để trống hết rồi lưu = không rõ, bỏ ô này<br />
                <b>Ô gộp</b>: Tab / nút + Số: thêm số · Shift+Tab: số trước · Backspace ở ô trống: xoá dòng<br />
                <b>Điểm</b> 1, 2, 3… ứng với dòng số 1, 2, 3…<br />
                Bấm vào điểm: bôi đen số của điểm đó để gõ lại · kéo: dời điểm · chạm / bấm chỗ trống: thêm điểm · chuột phải hoặc <b>nhấn giữ</b> điểm: xoá · Esc: trả như code tìm<br />
                Vòng xanh: có số · vòng cam: chưa có số (bỏ qua)<br />
                Lưu: sang ô kế · ↑ / nút Trước: quay lại ô trước để sửa · giữ Ctrl hoặc nút Ẩn điểm: nhìn rõ số<br />
                <b>Tải kết quả</b>: tải file gửi anh Hiếu — tải lúc nào cũng được, mỗi file có đủ mọi ô đã duyệt tới lúc đó
              </div>
              <div className="ds-nav">
                <button type="button" id="ds-prev">↑ Trước</button>
                <button type="button" id="ds-skip" className="no" title="Xoá số điền sẵn, lưu là không rõ (Shift+Delete hoặc Ctrl+Backspace)">Xoá + Lưu</button>
                <button type="button" id="ds-save" className="go">Lưu ↵</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
