import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../lib/firebase.js";
import { useAuth } from "../lib/authContext.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

// Tự đổi mật khẩu khi đang đăng nhập (mọi tài khoản). Firebase yêu cầu xác thực lại bằng mật khẩu hiện tại trước khi đổi.
export default function ChangePasswordPage({ onNavigate }) {
  const { user, isStaff } = useAuth();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (pw.length < 6) return setError("Mật khẩu mới cần ít nhất 6 ký tự.");
    if (pw !== pw2) return setError("Hai lần nhập mật khẩu mới chưa giống nhau.");
    if (pw === current) return setError("Mật khẩu mới phải khác mật khẩu hiện tại.");
    setBusy(true);
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user.email, current));
      await updatePassword(auth.currentUser, pw);
      setDone(true);
    } catch (err) {
      setError(
        err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" ? "Mật khẩu hiện tại chưa đúng."
        : err?.code === "auth/too-many-requests" ? "Thử sai quá nhiều lần, vui lòng đợi một lúc."
        : "Không đổi được mật khẩu, thử lại nhé."
      );
    } finally {
      setBusy(false);
    }
  }

  const backPage = isStaff ? "dashboard" : "home";

  if (done) {
    return (
      <section className="login-screen">
        <div className="password-gate-card login-card">
          <h1 className="page-title">Đã đổi mật khẩu</h1>
          <p className="lead">Lần đăng nhập sau hãy dùng mật khẩu mới.</p>
          <button className="btn btn-primary" type="button" onClick={() => onNavigate(backPage)}>Quay lại</button>
        </div>
      </section>
    );
  }

  return (
    <section className="login-screen">
      <div className="password-gate-card login-card">
        <h1 className="page-title">Đổi mật khẩu</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordInput className="auth-input" placeholder="Mật khẩu hiện tại" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required autoFocus />
          <PasswordInput className="auth-input" placeholder="Mật khẩu mới (ít nhất 6 ký tự)" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} required />
          <PasswordInput className="auth-input" placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} required />
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Lưu mật khẩu"}</button>
          <button className="btn btn-secondary" type="button" onClick={() => onNavigate(backPage)} disabled={busy}>Huỷ</button>
          {error && <p className="auth-error">{error}</p>}
        </form>
      </div>
    </section>
  );
}
