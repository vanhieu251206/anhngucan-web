import Logo from "./Logo.jsx";

// 1 bộ icon duy nhất (cùng stroke-width, cùng style) cho mọi mục sidebar — tránh trộn icon rối mắt.
const SIDEBAR_ICONS = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  "create-lesson": <><path d="M12 5v14M5 12h14" /></>,
  "image-splitter": <><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M2 6h14a2 2 0 0 1 2 2v14" /></>,
  openings: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.7-1.5" /></>,
  students: <><path d="M2 9l10-5 10 5-10 5-10-5z" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /><path d="M22 9v6" /></>,
  accounts: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2.2" /><path d="M5.5 16.5c.6-1.6 1.9-2.4 3.5-2.4s2.9.8 3.5 2.4" /><path d="M15 10h4M15 14h3" /></>,
  tuition: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  "speech-logs": <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></>,
  teachers: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="18" cy="8.5" r="2.4" /><path d="M15 20c0-2.6 1.6-4.6 4-5.3" /></>,
  results: <><path d="M4 20V10M12 20V4M20 20v-7" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
};

// Component thuần, không có logic auth — DashboardPage.jsx tính sẵn `items`/thông tin user
// theo role rồi truyền xuống, Sidebar chỉ lo hiển thị + báo lại khi chọn mục/bấm nút khác.
// Màn hẹp (≤900px): sidebar thành ngăn kéo trượt từ trái, mở bằng nút 3 gạch trên .admin-topbar (`open`/`onClose`).
export default function Sidebar({ items, activeKey, onSelect, userEmail, roleLabel, onGoHome, onChangePassword, onLogout, open = false, onClose }) {
  return (
    <>
    <div className={`admin-sidebar-backdrop${open ? " is-open" : ""}`} onClick={onClose} aria-hidden="true" />
    <aside className={`admin-sidebar${open ? " is-open" : ""}`}>
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-brand-row">
          <Logo size={32} />
          <button type="button" className="admin-sidebar-close" onClick={onClose} aria-label="Đóng menu">✕</button>
        </div>
        <span className="admin-sidebar-brand-sub">Khu vực quản trị</span>
      </div>

      <nav className="admin-sidebar-nav">
        {items.map(item => (
          <button
            key={item.key}
            className={`admin-sidebar-link${activeKey === item.key ? " active" : ""}`}
            onClick={() => onSelect(item.key)}
            aria-current={activeKey === item.key ? "page" : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {SIDEBAR_ICONS[item.key]}
            </svg>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-user-badge">
          <span className="admin-user-avatar">{(userEmail || "?")[0].toUpperCase()}</span>
          <div className="admin-user-info">
            <span className="admin-user-email">{userEmail}</span>
            <span className="admin-user-role">{roleLabel}</span>
          </div>
        </div>
        <button className="admin-pill-btn" onClick={onGoHome}>
          Về trang học sinh
        </button>
        <button className="admin-pill-btn" onClick={onChangePassword}>
          Đổi mật khẩu
        </button>
        <button className="admin-pill-btn admin-pill-btn-danger" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </aside>
    </>
  );
}
