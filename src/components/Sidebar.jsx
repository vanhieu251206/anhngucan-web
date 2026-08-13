import Logo from "./Logo.jsx";

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
          >
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
