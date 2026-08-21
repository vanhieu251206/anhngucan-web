import { useState } from "react";
import { useAuth } from "../lib/authContext.jsx";
import { setAccessPassword } from "../lib/lessonAccess.js";

// Chỉ admin/teacher vào được (App.jsx đã chặn route này với guest) — đổi mật khẩu chung dùng để
// mở khoá bài học cho guest/học sinh, xem PasswordGate.jsx + lib/lessonAccess.js.
export default function SettingsPage() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (password.length < 4) {
      setError("Mật khẩu cần ít nhất 4 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("2 ô mật khẩu chưa khớp nhau.");
      return;
    }
    setSaving(true);
    try {
      await setAccessPassword(password, user.uid);
      setSaved(true);
      setPassword("");
      setConfirm("");
    } catch {
      setError("Lưu mật khẩu thất bại, thử lại nhé.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card">
      <h2>Đổi mật khẩu chung</h2>
      <p>Mật khẩu này dùng để mở khoá bài học (Listening/Speaking) cho học sinh/guest.</p>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input
          className="admin-input"
          type="password"
          placeholder="Mật khẩu mới"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <input
          className="admin-input"
          type="password"
          placeholder="Nhập lại mật khẩu mới"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
        <button className="admin-btn-primary" type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu mật khẩu"}
        </button>
        {error && <p className="auth-error">{error}</p>}
        {saved && <p className="auth-success">Đã lưu mật khẩu mới!</p>}
      </form>
    </div>
  );
}
