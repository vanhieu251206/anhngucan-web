import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase.js";

// Đăng nhập cho admin/teacher (email/password). KHÔNG có đăng ký/quên mật khẩu ở Phase 1 —
// tài khoản được admin tạo thủ công qua Firebase Console, xem docs/quy-trinh (nội bộ) hoặc
// ghi chú trong CLAUDE.md.
export default function LoginPage({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onNavigate("home");
    } catch {
      setError("Sai email hoặc mật khẩu. Thử lại nhé.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section narrow">
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
    </section>
  );
}
