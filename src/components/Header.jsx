import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Logo from "./Logo.jsx";
import AssignmentBell from "./AssignmentBell.jsx";
import { useNextClass } from "../lib/useNextClass.js";
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

// Chỉ học sinh: trang "Bài của con" (MyWorkPage.jsx).
const STUDENT_NAV_ITEMS = [{ key: "my-work", label: "Bài của con" }];

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
  const { user, role, profile, isStaff, isStudent, logout } = useAuth();
  const navItems = isStudent ? [...NAV_ITEMS, ...STUDENT_NAV_ITEMS] : NAV_ITEMS;
  const nextClass = useNextClass();
  // Học sinh hiện họ tên đầy đủ; admin/giáo viên/tài khoản đặc biệt hiện tên đăng nhập (không có thì theo vai trò).
  const userLabel = role === "student"
    ? profile?.displayName ?? "Học sinh"
    : profile?.username ?? ROLE_LABELS[role] ?? "Giáo viên";
  const [menuOpen, setMenuOpen] = useState(false);

  // Sidebar đang mở: khoá cuộn trang phía sau + Esc để đóng.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = e => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
            {navItems.map(item => (
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

          <AssignmentBell />

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
      </div>

      {/* Màn hình nhỏ: sidebar trượt từ phải (portal ra body để position: fixed không bị khung cha cắt). */}
      {createPortal(
        <div className={`topbar-drawer-root${menuOpen ? " is-open" : ""}`} aria-hidden={!menuOpen} inert={!menuOpen}>
          <div className="topbar-drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <aside className="topbar-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="topbar-drawer-head">
              <button className="brand-btn" onClick={() => handleNavClick("home")} aria-label="Về trang chủ">
                <Logo size={36} />
              </button>
              <button type="button" className="topbar-drawer-close" onClick={() => setMenuOpen(false)} aria-label="Đóng menu">✕</button>
            </div>

            {user && (
              <button type="button" className="topbar-drawer-user" onClick={() => handleNavClick("change-password")}>
                <span className="top-nav-user-avatar" aria-hidden="true">{userLabel.trim().charAt(0).toUpperCase()}</span>
                <span className="topbar-drawer-user-text">
                  <strong>{userLabel}</strong>
                  <small>Đổi mật khẩu</small>
                </span>
              </button>
            )}
            {nextClass && (
              <div className="topbar-drawer-next">
                <span>Buổi học tiếp theo</span>
                <strong>{nextClass.when}</strong>
                {nextClass.left && <small>{nextClass.left}</small>}
              </div>
            )}

            <nav className="topbar-drawer-nav">
              {navItems.map(item => (
                <button
                  key={item.key}
                  className={`topbar-drawer-link${page === item.key ? " is-active" : ""}`}
                  onClick={() => handleNavClick(item.key)}
                >
                  {item.label}
                </button>
              ))}
              {isStaff && (
                <button
                  className={`topbar-drawer-link${page === "dashboard" ? " is-active" : ""}`}
                  onClick={() => handleNavClick("dashboard")}
                >
                  Quản trị
                </button>
              )}
            </nav>

            <div className="topbar-drawer-foot">
              <button className={`top-nav-login${user ? " top-nav-logout" : ""}`} onClick={handleAuthClick}>
                {user ? "Đăng xuất" : "Đăng nhập"}
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
