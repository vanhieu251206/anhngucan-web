import { useEffect, useState } from "react";
import { createTesterAccount, listTesters } from "../../lib/adminUsers.js";
import PasswordInput from "../../components/PasswordInput.jsx";

// Quản lý tài khoản đặc biệt (role "tester") — đăng nhập làm được mọi dạng bài trên web, bỏ qua
// mật khẩu bộ đề/giới hạn lượt, nhưng KHÔNG ghi lịch sử làm bài vào hệ thống (lib/historyGuard.js).
export default function TesterAccountsPage() {
  const [testers, setTesters] = useState(null); // null = đang tải
  const [loadError, setLoadError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function reload() {
    setLoadError("");
    listTesters()
      .then(setTesters)
      .catch(err => setLoadError(err.message || String(err)));
  }

  useEffect(reload, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(name)) {
      setCreateError("Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu . _ -");
      return;
    }
    if (password.length < 6) {
      setCreateError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    setCreating(true);
    try {
      await createTesterAccount(name, password);
      setUsername("");
      setPassword("");
      reload();
    } catch {
      setCreateError("Tạo tài khoản thất bại — kiểm tra tên đăng nhập đã dùng chưa, hoặc thử lại.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2>Danh sách tài khoản đặc biệt</h2>
        <p className="admin-muted-text">
          Đăng nhập rồi làm được mọi dạng bài, không cần mật khẩu bộ đề và không giới hạn lượt. Kết quả
          làm bài không được ghi vào hệ thống.
        </p>
        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
        {testers === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
        {testers && testers.length === 0 && <p className="admin-muted-text">Chưa có tài khoản đặc biệt nào.</p>}
        {testers && testers.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>UID</th>
              </tr>
            </thead>
            <tbody>
              {testers.map(t => (
                <tr key={t.uid}>
                  <td>{t.username ?? t.email}</td>
                  <td>{t.uid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-card">
        <h2>Tạo tài khoản đặc biệt mới</h2>
        <form className="admin-form" onSubmit={handleCreate}>
          <input
            className="admin-input"
            type="text"
            placeholder="Tên đăng nhập (vd: tester1)"
            autoCapitalize="none"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <PasswordInput
            className="admin-input"
            placeholder="Mật khẩu (ít nhất 6 ký tự)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button className="admin-btn-primary" type="submit" disabled={creating}>
            {creating ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
          {createError && <p className="admin-error">{createError}</p>}
        </form>
      </div>
    </div>
  );
}
