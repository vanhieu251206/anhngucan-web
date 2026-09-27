import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { useAuth } from "../lib/authContext.jsx";
import PasswordInput from "./PasswordInput.jsx";
import { savePasswordCopy } from "../lib/passwordVault.js";

const AUTH_BG = `${import.meta.env.BASE_URL}assets/img/backgrounds/auth-bg.jpg`;

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
      // Chặn đặt lại đúng mật khẩu ban đầu (lỗi thật 2026-09-27): xác thực lại bằng chính mật khẩu mới — thành
      // công nghĩa là trùng mật khẩu đang dùng. Sai (khác mật khẩu) là bình thường, đi tiếp.
      let same = false;
      try {
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user.email, pw));
        same = true;
      } catch (err) {
        if (err.code === "auth/too-many-requests") throw err;
      }
      if (same) {
        setError(profile?.role === "student" ? "Mật khẩu mới phải khác mật khẩu cô giáo cấp nhé." : "Mật khẩu mới phải khác mật khẩu ban đầu.");
        return;
      }
      await updatePassword(auth.currentUser, pw);
      if (profile?.role !== "admin") await savePasswordCopy(user.uid, pw);
      await updateDoc(doc(db, "users", user.uid), { mustChangePassword: false });
      await refreshProfile();
    } catch (err) {
      console.error("Đổi mật khẩu lần đầu lỗi:", err);
      setError(
        err.code === "auth/requires-recent-login" ? "Phiên đăng nhập đã cũ — bấm Đăng xuất rồi đăng nhập lại để đổi mật khẩu."
        : err.code === "auth/too-many-requests" ? "Thử quá nhiều lần, vui lòng đợi một lúc."
        : err.code === "permission-denied" ? "Đã đổi mật khẩu nhưng chưa lưu được trạng thái (lỗi quyền) — báo admin."
        : `Không đổi được mật khẩu (${err.code || err.message}), thử lại nhé.`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    // Màn này không có Header → phủ trọn màn hình (login-screen-full), cùng ảnh nền với trang Đăng nhập.
    <section className="login-screen login-screen-full" style={{ "--login-bg-image": `url(${AUTH_BG})` }}>
      <div className="password-gate-card login-card force-pw-card">
        <span className="force-pw-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h1 className="page-title">Đặt mật khẩu mới</h1>
        <p className="lead">
          {profile?.role === "student"
            ? `Chào ${profile?.displayName ?? "con"}! Đây là lần đăng nhập đầu tiên, con hãy tự đặt mật khẩu của riêng mình.`
            : `Chào ${profile?.username ?? "thầy cô"}! Đây là lần đăng nhập đầu tiên, vui lòng đặt mật khẩu của riêng mình.`}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordInput className="auth-input" placeholder="Mật khẩu mới (ít nhất 6 ký tự)" value={pw} onChange={e => setPw(e.target.value)} required />
          <PasswordInput className="auth-input" placeholder="Nhập lại mật khẩu mới" value={pw2} onChange={e => setPw2(e.target.value)} required />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Lưu mật khẩu"}</button>
          <button className="force-pw-logout" type="button" onClick={logout}>Đăng xuất</button>
        </form>
      </div>
    </section>
  );
}
