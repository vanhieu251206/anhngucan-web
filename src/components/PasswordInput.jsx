import { useState } from "react";

// Ô nhập mật khẩu có nút "hiện/ẩn" (con mắt) — dùng chung mọi nơi có ô mật khẩu (LoginPage,
// TeacherAccountsPage, StudentAccountsPage...) thay vì để mỗi chỗ tự implement riêng (chốt
// 2026-08-27). Nhận mọi prop input bình thường (value/onChange/placeholder/required...) qua rest.
export default function PasswordInput({ className, wrapperClassName, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={`password-input-wrap${wrapperClassName ? ` ${wrapperClassName}` : ""}`}>
      <input className={className} type={visible ? "text" : "password"} {...rest} />
      <button
        type="button"
        className="password-input-toggle"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" />
            <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
            <path d="M9.88 4.24A9.77 9.77 0 0 1 12 4c6 0 9.5 6 9.5 8a10.9 10.9 0 0 1-3.06 3.94M6.6 6.6C3.9 8.3 2.5 10.8 2.5 12c0 2 3.5 8 9.5 8a9.7 9.7 0 0 0 3.4-.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
