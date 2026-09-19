import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import PasswordInput from "../components/PasswordInput.jsx";

const AUTH_BG = `${import.meta.env.BASE_URL}assets/img/backgrounds/auth-bg.jpg`;

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
        try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const role = snap.exists() ? snap.data().role : null;
      onNavigate(role === "admin" || role === "teacher" ? "dashboard" : "lessons");
    } catch {
      setError("Sai email hoặc mật khẩu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-screen" style={{ "--login-bg-image": `url(${AUTH_BG})` }}>
      <div className="password-gate-card login-card">
        <h1 className="page-title">Đăng nhập</h1>
        <p className="lead">Dành riêng cho giáo viên và quản trị viên.</p>

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
