import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase.js";

const AUTH_BG = `${import.meta.env.BASE_URL}assets/img/backgrounds/auth-bg.jpg`;

// Đăng nhập cho admin/teacher (email/password). KHÔNG có đăng ký/quên mật khẩu ở Phase 1 —
// tài khoản được admin tạo thủ công qua Firebase Console, xem docs/quy-trinh (nội bộ) hoặc
// ghi chú trong CLAUDE.md.
export default function LoginPage({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Khoá cuộn trang khi ở màn đăng nhập (nền ảnh full màn không cần cuộn) — trả lại bình thường
  // khi rời trang, vì các trang khác (About/Contact/Settings) vẫn cần cuộn được.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onNavigate("dashboard");
    } catch {
      setError("Sai email hoặc mật khẩu. Thử lại nhé.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-screen" style={{ "--login-bg-image": `url(${AUTH_BG})` }}>
      <div className="password-gate-card login-card">
        <span className="lessons-info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h1 className="page-title">Đăng nhập</h1>
        <p className="lead">Dành cho giáo viên/quản trị viên.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
          {error && <p className="auth-error">{error}</p>}
        </form>
      </div>
    </section>
  );
}
