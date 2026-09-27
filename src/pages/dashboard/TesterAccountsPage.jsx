import { useEffect, useState } from "react";
import { createTesterAccount, deleteTester, listTesters, setAccountDisabled } from "../../lib/adminUsers.js";
import PasswordInput from "../../components/PasswordInput.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";

// Quản lý tài khoản đặc biệt (role "tester") — đăng nhập làm được mọi dạng bài trên web, bỏ qua
// giới hạn lượt, nhưng KHÔNG ghi lịch sử làm bài vào hệ thống (lib/historyGuard.js).
// Giao diện theo khuôn TeacherAccountsPage (nút "+ Tạo tài khoản" mở modal, Khoá/Xoá từng dòng — 2026-09-27).
function TesterModal({ onDone, onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,}$/.test(name)) return setError("Tên đăng nhập ít nhất 3 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -");
    if (password.length < 6) return setError("Mật khẩu cần ít nhất 6 ký tự.");
    setBusy(true);
    try {
      await createTesterAccount(name, password);
      onDone();
    } catch (err) {
      console.error(err);
      setError(
        err?.code === "auth/email-already-in-use" ? "Tên đăng nhập đã có người dùng."
        : err?.code === "permission-denied" ? "Không có quyền (firestore.rules chưa đúng bản mới)."
        : `Tạo tài khoản thất bại (${err?.code || err?.message || err}).`
      );
      setBusy(false);
    }
  }

  return (
    <div className="confirm-overlay" role="presentation" onClick={() => !busy && onClose()}>
      <div className="opening-modal teacher-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h2>Tạo tài khoản đặc biệt</h2>
        <form className="teacher-modal-form" onSubmit={handleSubmit}>
          <div className="teacher-modal-row">
            <label className="admin-mini-field">
              <span>Tên đăng nhập</span>
              <input className="admin-input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required autoFocus />
            </label>
            <label className="admin-mini-field">
              <span>Mật khẩu</span>
              <PasswordInput className="admin-input" autoComplete="new-password" placeholder="Ít nhất 6 ký tự" value={password} onChange={e => setPassword(e.target.value)} required />
            </label>
          </div>
          <div className="opening-form-actions">
            {error && <p className="admin-error">{error}</p>}
            <button type="button" className="admin-pill-btn" onClick={onClose} disabled={busy}>Huỷ</button>
            <button className="admin-btn-primary" type="submit" disabled={busy}>
              {busy ? "Đang lưu..." : "Tạo tài khoản"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TesterAccountsPage() {
  const confirm = useConfirm();
  const [testers, setTesters] = useState(null); // null = đang tải
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyUid, setBusyUid] = useState(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoadError("");
    listTesters()
      .then(setTesters)
      .catch(err => setLoadError(err.message || String(err)));
  }

  useEffect(reload, []);

  async function runAction(t, fn) {
    setActionError("");
    setBusyUid(t.uid);
    try {
      await fn();
      reload();
    } catch (err) {
      console.error(err);
      setActionError(err?.message || String(err));
    } finally {
      setBusyUid(null);
    }
  }

  async function handleToggleLock(t) {
    const name = t.username ?? t.email;
    if (!t.disabled && !(await confirm(`Khoá tài khoản ${name}? Tài khoản này sẽ bị đăng xuất và không đăng nhập được.`))) return;
    runAction(t, () => setAccountDisabled(t.uid, !t.disabled));
  }

  async function handleDelete(t) {
    const name = t.username ?? t.email;
    if (!(await confirm(`Xoá hẳn tài khoản ${name}? Không khôi phục được.`, { danger: true }))) return;
    runAction(t, () => deleteTester(t.uid));
  }

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="opening-list-head">
          <h2>Danh sách tài khoản đặc biệt</h2>
          <button type="button" className="admin-btn-primary" onClick={() => setCreating(true)}>+ Tạo tài khoản</button>
        </div>
        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
        {actionError && <p className="admin-error">{actionError}</p>}
        {testers === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
        {testers && testers.length === 0 && <p className="admin-muted-text">Chưa có tài khoản đặc biệt nào.</p>}
        {testers && testers.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {testers.map(t => (
                <tr key={t.uid} className={t.disabled ? "teacher-row-disabled" : ""}>
                  <td>
                    {t.username ?? t.email}
                    {t.disabled && <span className="teacher-locked-chip">Đã khoá</span>}
                  </td>
                  <td>
                    <div className="teacher-row-actions">
                      <button className="admin-pill-btn" onClick={() => handleToggleLock(t)} disabled={busyUid === t.uid}>
                        {t.disabled ? "Mở khoá" : "Khoá"}
                      </button>
                      <button className="admin-pill-btn admin-pill-btn-danger" onClick={() => handleDelete(t)} disabled={busyUid === t.uid}>Xoá</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <TesterModal
          onDone={() => { setCreating(false); reload(); }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
