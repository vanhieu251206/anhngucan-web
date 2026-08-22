import { useState } from "react";
import Logo from "./Logo.jsx";
import { useAuth } from "../lib/authContext.jsx";

// Header DUY NHẤT dùng chung cho TOÀN BỘ trang công khai (Trang chủ, Bài học, Giới thiệu,
// Liên hệ, Đăng nhập) — tránh mỗi trang tự vẽ 1 thanh topbar riêng như trước. "Cài đặt" của
// admin/teacher nằm trong Sidebar khu vực quản trị (Sidebar.jsx/DashboardPage.jsx), không ở đây.
const NAV_ITEMS = [
  { key: "home", label: "Trang chủ" },
  { key: "about", label: "Giới thiệu" },
  { key: "contact", label: "Liên hệ" },
];

export default function Header({ page, onNavigate }) {
  const { user, role, isStaff, logout } = useAuth();
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
            <button className="top-nav-login" onClick={handleAuthClick} title={user?.email}>
              {user ? `${role === "admin" ? "Admin" : "Giáo viên"} · Đăng xuất` : "Đăng nhập"}
            </button>
            <button className="top-nav-cta" onClick={() => handleNavClick("lessons")}>
              Học thử ngay
            </button>
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
              <button className="top-nav-login" onClick={handleAuthClick} title={user?.email}>
                {user ? `${role === "admin" ? "Admin" : "Giáo viên"} · Đăng xuất` : "Đăng nhập"}
              </button>
              <button className="top-nav-cta" onClick={() => handleNavClick("lessons")}>
                Học thử ngay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
