import { useState } from "react";
import PasswordInput from "./PasswordInput.jsx";
import { verifyOpeningPassword } from "../lib/openings.js";

// Màn nhập mật khẩu vào 1 bài đã được giáo viên mở (xem lib/openings.js). Bài không đặt mật khẩu thì không hiện.
export default function OpeningPasswordScreen({ opening, title, onSuccess, onBack }) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setChecking(true);
    setError("");
    try {
      if (await verifyOpeningPassword(opening, password)) onSuccess();
      else setError("Sai mật khẩu rồi 🐝 — hỏi lại giáo viên nhé.");
    } catch {
      setError("Không kiểm tra được mật khẩu (mất mạng?) — thử lại nhé.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="home-v2 lessons-screen-v2">
      <div className="name-prompt-shell">
        <div className="name-prompt-card">
          <h2>Nhập mật khẩu vào bài</h2>
          {title && <p className="admin-muted-text">{title}</p>}
          <form className="admin-form" onSubmit={handleSubmit}>
            <PasswordInput className="admin-input" placeholder="Mật khẩu bài" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            {error && <p className="admin-error">{error}</p>}
            <div className="name-prompt-actions">
              <button type="button" className="btn btn-secondary" onClick={onBack}>Quay lại</button>
              <button type="submit" className="btn btn-primary" disabled={checking || !password}>{checking ? "Đang kiểm tra..." : "Vào làm bài"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
