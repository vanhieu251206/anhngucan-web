import { useState } from "react";
import Logo from "./Logo.jsx";
import { useAuth } from "../lib/authContext.jsx";

// Header DUY NHẤT dùng chung cho TOÀN BỘ trang công khai (Trang chủ, Bài học, Giới thiệu,
// Liên hệ, Đăng nhập) — tránh mỗi trang tự vẽ 1 thanh topbar riêng như trước. "Cài đặt" của
// admin/teacher nằm trong Sidebar khu vực quản trị (Sidebar.jsx/DashboardPage.jsx), không ở đây.
const NAV_ITEMS = [
  { key: "home", label: "Trang chủ" },
  // Tạm ẩn (2026-09-26) — trang vẫn còn, mở lại chỉ cần bỏ comment.
  // { key: "about", label: "Giới thiệu" },
  // { key: "contact", label: "Liên hệ" },
];

const ROLE_LABELS = { admin: "Admin", teacher: "Giáo viên", tester: "Tài khoản đặc biệt" };

// Đã đăng nhập: chip tên (bấm để đổi mật khẩu) + nút Đăng xuất riêng; chưa đăng nhập: nút Đăng nhập.
function UserControls({ user, label, onAuthClick, onChangePassword }) {
  if (!user) {
    return <button className="top-nav-login" onClick={onAuthClick}>Đăng nhập</button>;
  }
  return (
    <>
      <button type="button" className="top-nav-user" title="Đổi mật khẩu" onClick={onChangePassword}>
        <span className="top-nav-user-avatar" aria-hidden="true">{label.trim().charAt(0).toUpperCase()}</span>
        <span className="top-nav-user-name">{label}</span>
      </button>
      <button className="top-nav-login top-nav-logout" onClick={onAuthClick}>Đăng xuất</button>
    </>
  );
}

export default function Header({ page, onNavigate }) {
  const { user, role, profile, isStaff, logout } = useAuth();
  // Học sinh hiện họ tên đầy đủ; admin/giáo viên/tài khoản đặc biệt hiện tên đăng nhập (không có thì theo vai trò).
  const userLabel = role === "student"
    ? profile?.displayName ?? "Học sinh"
    : profile?.username ?? ROLE_LABELS[role] ?? "Giáo viên";
  const [menuOpen, setMenuOpen] = useState(false);

  function handleAuthClick() {
    setMenuOpen(false);
    if (user) {
      logout();
      onNavigate("home");
    } else {
      onNavigate("login");
    }
  }

  function handleNavClick(key) {
    setMenuOpen(false);
    onNavigate(key);
  }

  return (
    <div className="home-v2-topbar-wrap">
      <div className="home-v2-inner-topbar">
        <div className="home-topbar">
          <button className="brand-btn" onClick={() => handleNavClick("home")} aria-label="Về trang chủ">
            <Logo size={40} />
          </button>

          <nav className="home-topbar-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                className={`home-topbar-navlink${page === item.key ? " is-active" : ""}`}
                onClick={() => handleNavClick(item.key)}
              >
                {item.label}
              </button>
            ))}
            {isStaff && (
              <button
                className={`home-topbar-navlink${page === "dashboard" ? " is-active" : ""}`}
                onClick={() => handleNavClick("dashboard")}
              >
                Quản trị
              </button>
            )}
          </nav>

          <div className="home-topbar-actions">
            <UserControls user={user} label={userLabel} onAuthClick={handleAuthClick} onChangePassword={() => handleNavClick("change-password")} />
          </div>

          <button
            className={`home-topbar-burger${menuOpen ? " is-open" : ""}`}
            onClick={() => setMenuOpen(open => !open)}
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>

        {menuOpen && (
          <div className="home-topbar-mobile-menu">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                className={`home-topbar-navlink${page === item.key ? " is-active" : ""}`}
                onClick={() => handleNavClick(item.key)}
              >
                {item.label}
              </button>
            ))}
            {isStaff && (
              <button
                className={`home-topbar-navlink${page === "dashboard" ? " is-active" : ""}`}
                onClick={() => handleNavClick("dashboard")}
              >
                Quản trị
              </button>
            )}
            <div className="home-topbar-mobile-actions">
              <UserControls user={user} label={userLabel} onAuthClick={handleAuthClick} onChangePassword={() => handleNavClick("change-password")} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
