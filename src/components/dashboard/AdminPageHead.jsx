import { useEffect, useRef, useState } from "react";
import { useUploadsPending } from "../../lib/cloudinaryUpload.js";
import { useConfirm } from "./ConfirmDialog.jsx";
// Đầu trang soạn bài dùng chung — dính cố định trên đầu (sticky) khi trang soạn dài, để nút
// "Xuất bản"/"Preview" luôn bấm được ngay mà không phải cuộn lên lại (chốt người dùng 2026-09-14,
// áp dụng đồng bộ cho MỌI dạng bài/loại sách — trước đó chỉ LuyenDePage trong PracticeStudio.jsx
// có sticky, các Studio khác để nút "Xuất bản" trôi theo cuối trang). ReadingStudio.jsx/
// TestStudio.jsx dùng `.studio-topbar` riêng (position: fixed nguyên màn hình kiểu Canva) nên
// KHÔNG cần đổi sang PageHead này — đã luôn cố định trên đầu sẵn.
export function PageHead({ label, backLabel = "← Quay lại", onBack, sticky = true, children }) {
  return (
    <div className={`admin-dictation-head${sticky ? " admin-page-head-sticky" : ""}`}>
      <button type="button" className="admin-pill-btn" onClick={onBack}>{backLabel}</button>
      {label && <span className="admin-practice-page-label">{label}</span>}
      {children}
    </div>
  );
}

// Nút "Xuất bản" dùng ở các trang soạn có thanh trên riêng — khoá khi còn file đang tải lên (lib/cloudinaryUpload.js).
export function PublishButton({ onClick, saving, className = "admin-btn-primary", savingLabel = "Đang xuất bản..." }) {
  const uploading = useUploadsPending() > 0;
  return (
    <button type="button" className={className} onClick={onClick} disabled={saving || uploading}>
      {saving ? savingLabel : uploading ? "Đang tải file..." : "Xuất bản"}
    </button>
  );
}

// Nhãn "⚠ N chỗ cần kiểm tra" cạnh nút Xuất bản — bấm để xem danh sách (lib/lessonValidation.js). Không chặn lưu.
export function WarningBadge({ warnings }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (!warnings?.length) return <span className="admin-warn-badge is-ok" title="Chưa thấy lỗi nào">✓ Đủ nội dung</span>;
  return (
    <span className="admin-warn-wrap" ref={ref}>
      <button type="button" className="admin-warn-badge" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        ⚠ {warnings.length} chỗ cần kiểm tra
      </button>
      {open && (
        <ul className="admin-warn-list">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </span>
  );
}

// Nội dung hộp xác nhận khi xuất bản mà còn cảnh báo (dùng chung mọi trang soạn).
export function publishWarningText(warnings, tail = "Vẫn xuất bản?") {
  if (!warnings?.length) return null;
  const shown = warnings.slice(0, 6).map(w => `• ${w}`);
  if (warnings.length > 6) shown.push(`…và ${warnings.length - 6} chỗ khác`);
  return `Còn ${warnings.length} chỗ cần kiểm tra:\n${shown.join("\n")}\n\n${tail}`;
}

// `warnings` (tuỳ chọn): hiện nhãn cảnh báo + hỏi lại trước khi lưu nếu còn lỗi.
export function PageHeadSaveButton({ onSave, saving, saved, warnings }) {
  const uploading = useUploadsPending() > 0;
  const confirm = useConfirm();
  async function handleClick() {
    const text = publishWarningText(warnings);
    if (text && !(await confirm(text))) return;
    onSave();
  }
  return (
    <>
      {warnings && <WarningBadge warnings={warnings} />}
      <button type="button" className="admin-btn-primary admin-page-head-save" onClick={handleClick} disabled={saving || uploading}>
        {saving ? "Đang lưu..." : uploading ? "Đang tải file..." : "Xuất bản"}
      </button>
      {saved && <span className="admin-success admin-page-head-saved">✓ Đã lưu</span>}
    </>
  );
}
