import { useState } from "react";
import Logo from "./Logo.jsx";

const NAV_ITEMS = [
  { key: "home", label: "Trang chủ" },
  { key: "lessons", label: "Bài học" },
  { key: "about", label: "Giới thiệu" },
  { key: "contact", label: "Liên hệ" },
];

export default function Header({ page, onNavigate }) {
  const [open, setOpen] = useState(false);

  function go(key) {
    onNavigate(key);
    setOpen(false);
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
