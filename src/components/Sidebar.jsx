import Logo from "./Logo.jsx";

// 1 bộ icon duy nhất (cùng stroke-width, cùng style) cho mọi mục sidebar — tránh trộn icon rối mắt.
const SIDEBAR_ICONS = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  "create-lesson": <><path d="M12 5v14M5 12h14" /></>,
  teachers: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="18" cy="8.5" r="2.4" /><path d="M15 20c0-2.6 1.6-4.6 4-5.3" /></>,
  results: <><path d="M4 20V10M12 20V4M20 20v-7" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
};

// Component thuần, không có logic auth — DashboardPage.jsx tính sẵn `items`/thông tin user
// theo role rồi truyền xuống, Sidebar chỉ lo hiển thị + báo lại khi chọn mục/bấm nút khác.
export default function Sidebar({ items, activeKey, onSelect, userEmail, roleLabel, onGoHome, onLogout }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <Logo size={32} />
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
        <button className="admin-pill-btn admin-pill-btn-danger" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
