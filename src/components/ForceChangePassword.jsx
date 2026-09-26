import { useState } from "react";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { useAuth } from "../lib/authContext.jsx";
import PasswordInput from "./PasswordInput.jsx";

// Màn CHẶN toàn app: học sinh đăng nhập bằng mật khẩu ban đầu (do giáo viên đặt chung) phải đặt mật khẩu mới
// của riêng mình mới dùng tiếp được (cờ mustChangePassword trong users/{uid}, xem adminUsers.js).
export default function ForceChangePassword() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (pw.length < 6) return setError("Mật khẩu mới cần ít nhất 6 ký tự.");
    if (pw !== pw2) return setError("Hai lần nhập mật khẩu chưa giống nhau.");
    setBusy(true);
    try {
      await updatePassword(auth.currentUser, pw);
      await updateDoc(doc(db, "users", user.uid), { mustChangePassword: false });
      await refreshProfile();
    } catch (err) {
      setError(err.code === "auth/requires-recent-login" ? "Phiên đăng nhập đã cũ — hãy đăng xuất rồi đăng nhập lại." : "Không đổi được mật khẩu, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="login-screen">
      <div className="password-gate-card login-card">
        <h1 className="page-title">Đặt mật khẩu mới</h1>
        <p className="lead">
          {profile?.role === "student"
            ? `Chào ${profile?.displayName ?? "con"}! Đây là lần đăng nhập đầu tiên, con hãy tự đặt mật khẩu của riêng mình.`
            : `Chào ${profile?.username ?? "thầy cô"}! Đây là lần đăng nhập đầu tiên, vui lòng đặt mật khẩu của riêng mình.`}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordInput className="auth-input" placeholder="Mật khẩu mới (ít nhất 6 ký tự)" value={pw} onChange={e => setPw(e.target.value)} required />
          <PasswordInput className="auth-input" placeholder="Nhập lại mật khẩu mới" value={pw2} onChange={e => setPw2(e.target.value)} required />
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Lưu mật khẩu"}</button>
          <button className="btn btn-secondary" type="button" onClick={logout}>Đăng xuất</button>
          {error && <p className="auth-error">{error}</p>}
        </form>
      </div>
    </section>
  );
}
