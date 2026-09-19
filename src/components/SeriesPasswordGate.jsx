import { useState } from "react";
import PasswordInput from "./PasswordInput.jsx";
import { verifySeriesPassword } from "../lib/seriesAccess.js";

// Màn nhập mật khẩu để mở khoá 1 bộ đề (Starters/Movers/Flyers...) — thay thế đăng nhập tài khoản
// học sinh (chốt 2026-09-17). Admin/giáo viên đặt mật khẩu ở Quản trị → "Mật khẩu bộ đề"
// (SeriesPasswordsPage.jsx), học sinh chỉ cần biết đúng mật khẩu của bộ đề muốn học.
export default function SeriesPasswordGate({ seriesId, seriesTitle, seriesColor, onUnlock, onBack }) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setChecking(true);
    setError("");
    try {
      const ok = await verifySeriesPassword(seriesId, password);
      if (ok) onUnlock();
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
          <h2>Nhập mật khẩu để vào {seriesTitle}</h2>
          <p className="admin-muted-text">Hỏi giáo viên mật khẩu của bộ đề này nếu con chưa biết nhé.</p>
          <form className="admin-form" onSubmit={handleSubmit}>
            <PasswordInput
              className="admin-input"
              placeholder="Mật khẩu"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{ "--accent": seriesColor }}
            />
            {error && <p className="admin-error">{error}</p>}
            <div className="name-prompt-actions">
              <button type="button" className="btn btn-secondary" onClick={onBack}>
                Quay lại
              </button>
              <button type="submit" className="btn btn-primary" disabled={checking || !password}>
                {checking ? "Đang kiểm tra..." : "Vào học"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
