import { useEffect, useState } from "react";
import { checkPassword, getAccessHash, setUnlockedInSession } from "../lib/lessonAccess.js";

// Hiện thay cho nội dung bài học (Listening/Speaking) khi người xem là guest và chưa nhập đúng
// mật khẩu chung trong phiên này — xem LessonsPage.jsx.
export default function PasswordGate({ onUnlock }) {
  const [hash, setHash] = useState(null);
  const [hashLoaded, setHashLoaded] = useState(false);
  const [hashError, setHashError] = useState(false);
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAccessHash()
      .then(h => setHash(h))
      .catch(() => setHashError(true))
      .finally(() => setHashLoaded(true));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hash || checking) return;
    setChecking(true);
    setError("");
    const ok = await checkPassword(value, hash);
    setChecking(false);
    if (!ok) {
      setError("Sai mật khẩu rồi, thử lại nhé!");
      return;
    }
    setUnlockedInSession();
    onUnlock();
  }

  return (
    <div className="section narrow password-gate">
      <h1 className="page-title">Bài học đang khoá 🔒</h1>
      <p className="lead">Nhập mật khẩu cô/thầy đã cung cấp để mở khoá bài học nhé.</p>

      {hashError && (
        <p className="auth-error">Không tải được thông tin khoá bài học. Kiểm tra lại kết nối mạng.</p>
      )}
      {hashLoaded && !hashError && !hash && (
        <p className="auth-error">Giáo viên/Admin chưa đặt mật khẩu chung — vào Cài đặt để đặt trước nhé.</p>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input"
          type="password"
          placeholder="Mật khẩu"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={!hash || checking}>
          {checking ? "Đang kiểm tra..." : "Mở khoá"}
        </button>
        {error && <p className="auth-error">{error}</p>}
      </form>
    </div>
  );
}
