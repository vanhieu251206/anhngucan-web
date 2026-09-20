import { useEffect, useState } from "react";
import PasswordInput from "../../components/PasswordInput.jsx";
import { listStudents, bulkCreateStudents } from "../../lib/adminUsers.js";

// Tạo HÀNG LOẠT tài khoản học sinh: dán "Tên, Lớp" mỗi dòng, tên đăng nhập tự sinh từ họ tên (bỏ dấu, viết
// liền; trùng thì thêm số). Tất cả dùng CHUNG 1 mật khẩu ban đầu do giáo viên nhập lúc tạo — mỗi em BẮT BUỘC
// đổi mật khẩu ngay lần đăng nhập đầu (components/ForceChangePassword.jsx). Mật khẩu ban đầu không lưu lại ở
// đâu cả; nếu học sinh quên mật khẩu đã đổi thì cần tạo lại tài khoản (không có Admin SDK/Cloud Functions).
export default function StudentAccountsPage() {
  const [students, setStudents] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const [bulkText, setBulkText] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkError, setBulkError] = useState("");

  function reload() {
    setLoadError("");
    listStudents()
      .then(list => setStudents(list.sort((a, b) => (a.className || "").localeCompare(b.className || "") || (a.displayName || "").localeCompare(b.displayName || ""))))
      .catch(err => setLoadError(err.message || String(err)));
  }
  useEffect(reload, []);

  async function handleBulkCreate(e) {
    e.preventDefault();
    setBulkError("");
    setBulkResults(null);
    if (initialPassword.length < 6) {
      setBulkError("Mật khẩu ban đầu cần ít nhất 6 ký tự.");
      return;
    }
    const rows = bulkText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [name, cls] = line.split(",").map(s => s?.trim());
        return { displayName: name || "", className: cls || "" };
      })
      .filter(r => r.displayName);
    if (!rows.length) {
      setBulkError("Chưa dán tên học sinh nào.");
      return;
    }
    setCreating(true);
    try {
      setBulkResults(await bulkCreateStudents(rows, initialPassword));
      setBulkText("");
      reload();
    } catch (err) {
      setBulkError(err.message || String(err));
    } finally {
      setCreating(false);
    }
  }

  function copyResults() {
    const lines = bulkResults.filter(r => r.ok).map(r => `${r.displayName}\t${r.className}\t${r.username}\t${initialPassword}`);
    navigator.clipboard?.writeText(lines.join("\n"));
  }

  const classes = [...new Set((students ?? []).map(s => s.className).filter(Boolean))].sort();
  const visibleStudents = classFilter ? (students ?? []).filter(s => s.className === classFilter) : students;

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2>Tạo hàng loạt tài khoản học sinh</h2>
        <form className="admin-form" onSubmit={handleBulkCreate}>
          <label className="admin-mini-field">
            <span>Dán mỗi dòng 1 em, dạng "Tên, Lớp"</span>
            <textarea
              className="admin-input admin-textarea"
              rows={6}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"vd:\nNguyễn Văn An, 3A\nTrần Thị Bình, 3A\nLê Minh Châu, 4B"}
            />
          </label>
          <label className="admin-mini-field">
            <span>Mật khẩu ban đầu (chung, học sinh phải đổi ngay lần đầu đăng nhập)</span>
            <PasswordInput
              className="admin-input"
              placeholder="Ít nhất 6 ký tự"
              value={initialPassword}
              onChange={e => setInitialPassword(e.target.value)}
            />
          </label>
          <button className="admin-btn-primary" type="submit" disabled={creating}>
            {creating ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
          {bulkError && <p className="admin-error">{bulkError}</p>}
        </form>
        {bulkResults && (
          <>
            <button className="admin-link-btn" style={{ marginTop: 16 }} onClick={copyResults}>📋 Sao chép danh sách (Tên, Lớp, Tên đăng nhập, Mật khẩu)</button>
            <table className="admin-table" style={{ marginTop: 8 }}>
              <thead>
                <tr><th>Tên</th><th>Lớp</th><th>Tên đăng nhập</th><th>Kết quả</th></tr>
              </thead>
              <tbody>
                {bulkResults.map((r, i) => (
                  <tr key={i}>
                    <td>{r.displayName}</td>
                    <td>{r.className}</td>
                    <td>{r.username}</td>
                    <td>{r.ok ? <span className="admin-success">✓ Đã tạo</span> : <span className="admin-error">{r.error}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="admin-card">
        <h2>Danh sách học sinh</h2>
        {classes.length > 0 && (
          <label className="admin-mini-field" style={{ maxWidth: 220 }}>
            <span>Lọc theo lớp</span>
            <select className="admin-input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="">Tất cả lớp</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
        {students === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
        {students && visibleStudents.length === 0 && <p className="admin-muted-text">Chưa có học sinh nào.</p>}
        {students && visibleStudents.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr><th>Tên</th><th>Lớp</th><th>Tên đăng nhập</th><th>Đổi mật khẩu lần đầu</th></tr>
            </thead>
            <tbody>
              {visibleStudents.map(s => (
                <tr key={s.uid}>
                  <td>{s.displayName}</td>
                  <td>{s.className}</td>
                  <td>{s.username}</td>
                  <td>{s.mustChangePassword ? "⏳ Chưa" : "✓ Rồi"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
