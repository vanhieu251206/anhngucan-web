import { useState } from "react";
import Logo from "./Logo.jsx";
import { useAuth } from "../lib/authContext.jsx";

const NAV_ITEMS = [
  { key: "home", label: "Trang chủ" },
  { key: "lessons", label: "Bài học" },
  { key: "about", label: "Giới thiệu" },
  { key: "contact", label: "Liên hệ" },
];

export default function Header({ page, onNavigate }) {
  const [open, setOpen] = useState(false);
  const { user, role, isStaff, logout } = useAuth();

  function go(key) {
    onNavigate(key);
    setOpen(false);
  }

  function handleLogout() {
    logout();
    setOpen(false);
    onNavigate("home");
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="brand-btn" onClick={() => go("home")} aria-label="Về trang chủ">
          <Logo />
        </button>

        <nav className={`top-nav${open ? " open" : ""}`}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`top-nav-link${page === item.key ? " active" : ""}`}
              onClick={() => go(item.key)}
            >
              {item.label}
            </button>
          ))}

          {isStaff && (
            <button
              className={`top-nav-link${page === "settings" ? " active" : ""}`}
              onClick={() => go("settings")}
            >
              Cài đặt
            </button>
          )}

          {user ? (
            <button className="top-nav-link auth-status" onClick={handleLogout} title={user.email}>
              {role === "admin" ? "Admin" : "Giáo viên"} · Đăng xuất
            </button>
          ) : (
            <button className="top-nav-link" onClick={() => go("login")}>
              Đăng nhập
            </button>
          )}

          <button className="top-nav-cta" onClick={() => go("lessons")}>
            Học ngay
          </button>
        </nav>

        <button
          className={`menu-toggle${open ? " open" : ""}`}
          aria-label="Mở menu"
          onClick={() => setOpen(o => !o)}
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
  );
}
