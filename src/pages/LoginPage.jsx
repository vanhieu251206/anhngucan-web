import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { TESTER_EMAIL_DOMAIN, STUDENT_EMAIL_DOMAIN } from "../lib/adminUsers.js";
import PasswordInput from "../components/PasswordInput.jsx";

const AUTH_BG = `${import.meta.env.BASE_URL}assets/img/backgrounds/auth-bg.jpg`;

// Đăng nhập chung cho cả admin/teacher (email thật) LẪN học sinh (tên đăng nhập do CMS tự sinh,
// không có "@" — tự nối "@hocsinh.local" trước khi gọi Firebase Auth, xem adminUsers.js). KHÔNG
// có đăng ký/quên mật khẩu — tài khoản admin/teacher tạo thủ công qua Firebase Console/CMS, tài
// khoản học sinh tạo hàng loạt qua CMS (StudentAccountsPage.jsx). Sau khi đăng nhập, đọc thẳng
// role từ Firestore (không đợi AuthProvider ở App.jsx kịp cập nhật) để điều hướng đúng: học sinh
// vào thẳng "lessons", admin/teacher vào "dashboard".
// Tài khoản đặc biệt đăng nhập bằng tên đăng nhập (không có "@") — tự nối domain giả, xem adminUsers.js.
// Tên đăng nhập (không có "@") thử "@hocsinh.local" (học sinh) trước, không khớp thì thử "@tester.local".
function toAuthEmails(input) {
  const v = input.trim();
  if (v.includes("@")) return [v];
  const u = v.toLowerCase();
  return [`${u}@${STUDENT_EMAIL_DOMAIN}`, `${u}@${TESTER_EMAIL_DOMAIN}`];
}

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
      let cred = null;
      for (const addr of toAuthEmails(email)) {
        try {
          cred = await signInWithEmailAndPassword(auth, addr, password);
          break;
        } catch {
          // thử địa chỉ kế tiếp
        }
      }
      if (!cred) throw new Error("login-failed");
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists() || snap.data().disabled) {
        await signOut(auth);
        setError(snap.exists() ? "Tài khoản này đã bị khoá — hỏi giáo viên nhé." : "Tài khoản này không còn tồn tại — hỏi giáo viên nhé.");
        return;
      }
      const role = snap.data().role;
      onNavigate(role === "admin" || role === "teacher" ? "dashboard" : "lessons");
    } catch {
      setError("Sai tài khoản hoặc mật khẩu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-screen" style={{ "--login-bg-image": `url(${AUTH_BG})` }}>
      <div className="password-gate-card login-card">
        <h1 className="page-title">Đăng nhập</h1>
        <p className="lead">Nhập tên đăng nhập và mật khẩu được cấp.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="text"
            autoCapitalize="none"
            placeholder="Email hoặc tên đăng nhập"
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
