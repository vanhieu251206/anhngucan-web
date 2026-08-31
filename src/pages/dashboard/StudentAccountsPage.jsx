import { useEffect, useState } from "react";
import PasswordInput from "../../components/PasswordInput.jsx";
import {
  listStudents,
  bulkCreateStudents,
  getCurrentStudentPassword,
  updateSharedStudentPassword,
} from "../../lib/adminUsers.js";

// Quản lý tài khoản học sinh — tương tự TeacherAccountsPage.jsx nhưng tạo HÀNG LOẠT (dán nhanh
// tên+lớp, tự sinh username) và dùng CHUNG 1 mật khẩu cho toàn trung tâm (không phải theo lớp,
// không phải theo em) — xem lib/adminUsers.js. Chốt 2026-08-27 sau khi đóng lối vào bằng mật khẩu
// chung cũ (guest), thay bằng bắt buộc đăng nhập.
export default function StudentAccountsPage() {
  const [students, setStudents] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const [bulkText, setBulkText] = useState("");
  const [bulkPassword, setBulkPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkError, setBulkError] = useState("");

  const [currentPassword, setCurrentPassword] = useState(null); // null = chưa đặt lần nào
  const [oldPasswordInput, setOldPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeProgress, setChangeProgress] = useState(null); // { done, total }
  const [changeResult, setChangeResult] = useState(null); // { total, failed }
  const [changeError, setChangeError] = useState("");

  function reload() {
    setLoadError("");
    listStudents()
      .then(list => setStudents(list.sort((a, b) => (a.className || "").localeCompare(b.className || "") || (a.displayName || "").localeCompare(b.displayName || ""))))
      .catch(err => setLoadError(err.message || String(err)));
    getCurrentStudentPassword().then(setCurrentPassword).catch(() => {});
  }
  useEffect(reload, []);

  // Dán mỗi dòng "Tên, Lớp" — tách theo dấu phẩy, bỏ dòng trống. Mật khẩu dùng đúng mật khẩu chung
  // ĐANG DÙNG (currentPassword) — nếu chưa từng đặt, bắt đặt trước ở khối bên dưới.
  async function handleBulkCreate(e) {
    e.preventDefault();
    setBulkError("");
    setBulkResults(null);
    if (!currentPassword) {
      setBulkError("Chưa đặt mật khẩu chung cho học sinh — đặt ở khối bên dưới trước.");
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
      const results = await bulkCreateStudents(rows, currentPassword);
      setBulkResults(results);
      setBulkText("");
      reload();
    } catch (err) {
      setBulkError(err.message || String(err));
    } finally {
      setCreating(false);
    }
  }

  // Lần đầu chưa có mật khẩu chung: chỉ cần đặt 1 giá trị mới, không cần mật khẩu cũ (chưa có tài
  // khoản nào để phải đăng nhập lại). Từ lần 2 trở đi (đã có học sinh) bắt buộc nhập đúng mật khẩu
  // CŨ vì phải tự đăng nhập lại từng tài khoản mới đổi được (không có Admin SDK, xem adminUsers.js).
  async function handleChangePassword(e) {
    e.preventDefault();
    setChangeError("");
    setChangeResult(null);
    if (newPasswordInput.length < 6) {
      setChangeError("Mật khẩu mới cần ít nhất 6 ký tự.");
      return;
    }
    const hasStudents = (students?.length ?? 0) > 0;
    if (hasStudents && !oldPasswordInput) {
      setChangeError("Nhập đúng mật khẩu chung CŨ để đổi cho toàn bộ tài khoản đã tạo.");
      return;
    }
    setChangingPassword(true);
    setChangeProgress({ done: 0, total: students?.length ?? 0 });
    try {
      const result = await updateSharedStudentPassword(oldPasswordInput || newPasswordInput, newPasswordInput, (done, total) =>
        setChangeProgress({ done, total })
      );
      setChangeResult(result);
      setOldPasswordInput("");
      setNewPasswordInput("");
      reload();
    } catch (err) {
      setChangeError(err.message || String(err));
    } finally {
      setChangingPassword(false);
      setChangeProgress(null);
    }
  }

  const classes = [...new Set((students ?? []).map(s => s.className).filter(Boolean))].sort();
  const visibleStudents = classFilter ? (students ?? []).filter(s => s.className === classFilter) : students;

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2>Mật khẩu chung cho học sinh</h2>
        <p className="admin-muted-text">
          {currentPassword
            ? "Đã đặt mật khẩu chung — dùng đúng mật khẩu này khi tạo tài khoản mới. Học sinh đăng nhập bằng tên đăng nhập riêng + mật khẩu chung này."
            : "Chưa đặt mật khẩu chung nào — đặt 1 lần trước khi tạo tài khoản học sinh đầu tiên."}
        </p>
        <form className="admin-form" onSubmit={handleChangePassword}>
          {(students?.length ?? 0) > 0 && (
            <PasswordInput
              className="admin-input"
              placeholder="Mật khẩu chung CŨ (bắt buộc để đổi cho toàn bộ tài khoản đã tạo)"
              value={oldPasswordInput}
              onChange={e => setOldPasswordInput(e.target.value)}
            />
          )}
          <PasswordInput
            className="admin-input"
            placeholder="Mật khẩu chung MỚI (ít nhất 6 ký tự)"
            value={newPasswordInput}
            onChange={e => setNewPasswordInput(e.target.value)}
          />
          <button className="admin-btn-primary" type="submit" disabled={changingPassword}>
            {changingPassword
              ? changeProgress
                ? `Đang đổi... (${changeProgress.done}/${changeProgress.total})`
                : "Đang đổi..."
              : currentPassword
                ? "Đổi mật khẩu chung"
                : "Đặt mật khẩu chung"}
          </button>
          {changeError && <p className="admin-error">{changeError}</p>}
          {changeResult && (
            <p className={changeResult.failed.length ? "admin-error" : "admin-success"}>
              {changeResult.failed.length
                ? `Đổi xong ${changeResult.total - changeResult.failed.length}/${changeResult.total} tài khoản — ${changeResult.failed.length} tài khoản lỗi (xem lại từng em: ${changeResult.failed.map(f => f.username).join(", ")}).`
                : `✓ Đã đổi mật khẩu cho toàn bộ ${changeResult.total} tài khoản học sinh.`}
            </p>
          )}
        </form>
      </div>

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
          <button className="admin-btn-primary" type="submit" disabled={creating || !currentPassword}>
            {creating ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
          {!currentPassword && <p className="admin-hint">Đặt mật khẩu chung ở khối phía trên trước khi tạo tài khoản.</p>}
          {bulkError && <p className="admin-error">{bulkError}</p>}
        </form>
        {bulkResults && (
          <table className="admin-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Lớp</th>
                <th>Tên đăng nhập</th>
                <th>Kết quả</th>
              </tr>
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
        )}
      </div>

      <div className="admin-card">
        <h2>Danh sách học sinh</h2>
        {classes.length > 0 && (
          <label className="admin-mini-field" style={{ maxWidth: 220 }}>
            <span>Lọc theo lớp</span>
            <select className="admin-input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="">Tất cả lớp</option>
              {classes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
        {students === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
        {students && visibleStudents.length === 0 && <p className="admin-muted-text">Chưa có học sinh nào.</p>}
        {students && visibleStudents.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Lớp</th>
                <th>Tên đăng nhập</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map(s => (
                <tr key={s.uid}>
                  <td>{s.displayName}</td>
                  <td>{s.className}</td>
                  <td>{s.username}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
