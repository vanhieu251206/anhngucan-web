import { useEffect, useState } from "react";
import { createTeacherAccount, listTeachers } from "../../lib/adminUsers.js";
import PasswordInput from "../../components/PasswordInput.jsx";

export default function TeacherAccountsPage() {
  const [teachers, setTeachers] = useState(null); // null = đang tải
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function reload() {
    setLoadError("");
    listTeachers()
      .then(setTeachers)
      .catch(err => setLoadError(err.message || String(err)));
  }

  useEffect(reload, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    if (password.length < 6) {
      setCreateError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    setCreating(true);
    try {
      await createTeacherAccount(email, password);
      setEmail("");
      setPassword("");
      reload();
    } catch {
      setCreateError("Tạo tài khoản thất bại — kiểm tra email đã dùng chưa, hoặc thử lại.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2>Danh sách giáo viên</h2>
        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
        {teachers === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
        {teachers && teachers.length === 0 && <p className="admin-muted-text">Chưa có giáo viên nào.</p>}
        {teachers && teachers.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>UID</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.uid}>
                  <td>{t.email}</td>
                  <td>{t.uid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-card">
        <h2>Tạo tài khoản giáo viên mới</h2>
        <form className="admin-form" onSubmit={handleCreate}>
          <input
            className="admin-input"
            type="email"
            placeholder="Email giáo viên"
            value={email}
            onChange={e => setEmail(e.target.value)}
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
