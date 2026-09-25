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

// Chặn dò mật khẩu ngay trên trình duyệt (audit bảo mật 2026-09-25): sai liên tiếp FREE_FAILS lần thì phải chờ, mỗi
// lần sai thêm chờ lâu hơn. Chỉ là lớp phụ — Firebase Auth vẫn tự chặn phía server (auth/too-many-requests).
const FREE_FAILS = 5;
const LOCK_STEP_MS = 30 * 1000;
const FAIL_KEY = "loginFails";

function readFails() {
  try {
    return JSON.parse(localStorage.getItem(FAIL_KEY)) ?? { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

function writeFails(value) {
  try {
    if (value) localStorage.setItem(FAIL_KEY, JSON.stringify(value));
    else localStorage.removeItem(FAIL_KEY);
  } catch {
    // Trình duyệt chặn lưu trữ — bỏ qua, vẫn còn giới hạn phía Firebase.
  }
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
    const waitMs = readFails().until - Date.now();
    if (waitMs > 0) {
      setError(`Sai quá nhiều lần — đợi ${Math.ceil(waitMs / 1000)} giây rồi thử lại nhé.`);
      return;
    }
    setLoading(true);
    try {
      let snap = null;
      let orphan = false;
      let tooMany = false;
      for (const addr of toAuthEmails(email)) {
        try {
          const cred = await signInWithEmailAndPassword(auth, addr, password);
          const s = await getDoc(doc(db, "users", cred.user.uid));
          if (s.exists()) {
            snap = s;
            break;
          }
          // Tài khoản Auth mồ côi (hồ sơ đã xoá) — vd học sinh "pool" cũ che mất tài khoản đặc biệt "pool"
          // cùng tên: đăng xuất rồi thử địa chỉ kế tiếp thay vì chặn luôn.
          orphan = true;
          await signOut(auth);
        } catch (err) {
          if (err?.code === "auth/too-many-requests") tooMany = true;
          // thử địa chỉ kế tiếp
        }
      }
      if (!snap) {
        if (orphan) {
          setError("Tài khoản này không còn tồn tại — hỏi giáo viên nhé.");
          return;
        }
        const fails = readFails().count + 1;
        writeFails({ count: fails, until: fails >= FREE_FAILS ? Date.now() + LOCK_STEP_MS * (fails - FREE_FAILS + 1) : 0 });
        throw new Error(tooMany ? "too-many" : "login-failed");
      }
      writeFails(null);
      if (snap.data().disabled) {
        await signOut(auth);
        setError("Tài khoản này đã bị khoá — hỏi giáo viên nhé.");
        return;
      }
      const role = snap.data().role;
      onNavigate(role === "admin" || role === "teacher" ? "dashboard" : "lessons");
    } catch (err) {
      setError(err?.message === "too-many" ? "Đăng nhập sai quá nhiều lần — đợi vài phút rồi thử lại nhé." : "Sai tài khoản hoặc mật khẩu.");
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
          <button type="button" className="auth-privacy-link" onClick={() => onNavigate("privacy")}>
            Chính sách bảo mật
          </button>
        </form>
      </div>
    </section>
  );
}
