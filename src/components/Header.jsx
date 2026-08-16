import { useState } from "react";
import Logo from "./Logo.jsx";
import { useAuth } from "../lib/authContext.jsx";

// Menu chính chỉ còn "Trang chủ" (giống bố cục mẫu) — Bài học/Giới thiệu/Liên hệ
// vẫn vào được qua nút "Học thử ngay" (→ lessons) và Footer ở các trang khác trang chủ.
const NAV_ITEMS = [{ key: "home", label: "Trang chủ" }];

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
              className={`top-nav-link${page === "dashboard" ? " active" : ""}`}
              onClick={() => go("dashboard")}
            >
              Quản trị
            </button>
          )}

          {isStaff && (
            <button
              className={`top-nav-link${page === "settings" ? " active" : ""}`}
              onClick={() => go("settings")}
            >
              Cài đặt
            </button>
          )}

          {user ? (
            <button className="top-nav-login" onClick={handleLogout} title={user.email}>
              {role === "admin" ? "Admin" : "Giáo viên"} · Đăng xuất
            </button>
          ) : (
            <button className="top-nav-login" onClick={() => go("login")}>
              Đăng nhập
            </button>
          )}

          <button className="top-nav-cta" onClick={() => go("lessons")}>
            Học thử ngay
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
