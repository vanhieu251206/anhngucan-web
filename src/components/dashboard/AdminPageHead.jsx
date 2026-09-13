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

export function PageHeadSaveButton({ onSave, saving, saved }) {
  return (
    <>
      <button type="button" className="admin-btn-primary admin-page-head-save" onClick={onSave} disabled={saving}>
        {saving ? "Đang lưu..." : "Xuất bản"}
      </button>
      {saved && <span className="admin-success admin-page-head-saved">✓ Đã lưu</span>}
    </>
  );
}
