import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import PasswordInput from "../components/PasswordInput.jsx";

const AUTH_BG = `${import.meta.env.BASE_URL}assets/img/backgrounds/auth-bg.jpg`;
const STUDENT_EMAIL_DOMAIN = "hocsinh.local";

// Đăng nhập chung cho cả admin/teacher (email thật) LẪN học sinh (tên đăng nhập do CMS tự sinh,
// không có "@" — tự nối "@hocsinh.local" trước khi gọi Firebase Auth, xem adminUsers.js). KHÔNG
// có đăng ký/quên mật khẩu — tài khoản admin/teacher tạo thủ công qua Firebase Console/CMS, tài
// khoản học sinh tạo hàng loạt qua CMS (StudentAccountsPage.jsx). Sau khi đăng nhập, đọc thẳng
// role từ Firestore (không đợi AuthProvider ở App.jsx kịp cập nhật) để điều hướng đúng: học sinh
// vào thẳng "lessons", admin/teacher vào "dashboard".
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
    const loginId = email.includes("@") ? email.trim() : `${email.trim()}@${STUDENT_EMAIL_DOMAIN}`;
    try {
      const cred = await signInWithEmailAndPassword(auth, loginId, password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const role = snap.exists() ? snap.data().role : null;
      onNavigate(role === "admin" || role === "teacher" ? "dashboard" : "lessons");
    } catch {
      setError("Sai tên đăng nhập/email hoặc mật khẩu. Thử lại nhé.");
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
        <p className="lead">Học sinh dùng tên đăng nhập được cấp — giáo viên/quản trị viên dùng email.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="text"
            placeholder="Email (giáo viên) hoặc tên đăng nhập (học sinh)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
          />
          <PasswordInput
            className="auth-input"
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
