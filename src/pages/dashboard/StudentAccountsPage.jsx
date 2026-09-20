import { useEffect, useMemo, useState } from "react";
import PasswordInput from "../../components/PasswordInput.jsx";
import { listStudents, bulkCreateStudents, setStudentDisabled, deleteStudent } from "../../lib/adminUsers.js";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";

// Quản lý tài khoản học sinh: danh sách + tạo HÀNG LOẠT trong cửa sổ riêng. Dán "Tên, Lớp" mỗi dòng, tên đăng
// nhập tự sinh từ họ tên (bỏ dấu, viết liền; trùng thì thêm số). Tất cả dùng CHUNG 1 mật khẩu ban đầu do giáo
// viên nhập lúc tạo — mỗi em BẮT BUỘC đổi mật khẩu ngay lần đăng nhập đầu (components/ForceChangePassword.jsx).
// Mật khẩu ban đầu không lưu ở đâu; học sinh quên mật khẩu đã đổi thì cần tạo lại tài khoản (không có Admin SDK).
export default function StudentAccountsPage() {
  const confirm = useConfirm();
  const [busyUid, setBusyUid] = useState(null);
  const [students, setStudents] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [usedPassword, setUsedPassword] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [copied, setCopied] = useState(false);

  function reload() {
    setLoadError("");
    listStudents()
      .then(list => setStudents(list.sort((a, b) => (a.className || "").localeCompare(b.className || "") || (a.displayName || "").localeCompare(b.displayName || ""))))
      .catch(err => setLoadError(err.message || String(err)));
  }
  useEffect(reload, []);

  function openForm() {
    setBulkError("");
    setBulkResults(null);
    setCopied(false);
    setShowForm(true);
  }

  async function handleBulkCreate(e) {
    e.preventDefault();
    setBulkError("");
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
      setUsedPassword(initialPassword);
      setBulkText("");
      reload();
    } catch (err) {
      setBulkError(err.message || String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleLock(s) {
    const locking = !s.disabled;
    if (locking && !(await confirm(`Khoá tài khoản của ${s.displayName}? Em sẽ bị đăng xuất và không đăng nhập lại được cho tới khi mở khoá.`, { danger: true }))) return;
    setBusyUid(s.uid);
    try {
      await setStudentDisabled(s.uid, locking);
      reload();
    } catch (err) {
      setLoadError(err.message || String(err));
    } finally {
      setBusyUid(null);
    }
  }

  async function handleDelete(s) {
    if (!(await confirm(`Xoá tài khoản của ${s.displayName} (${s.username})? Em sẽ không đăng nhập được nữa. Không hoàn tác được.`, { danger: true }))) return;
    setBusyUid(s.uid);
    try {
      await deleteStudent(s.uid);
      reload();
    } catch (err) {
      setLoadError(err.message || String(err));
    } finally {
      setBusyUid(null);
    }
  }

  function copyResults() {
    const lines = bulkResults.filter(r => r.ok).map(r => `${r.displayName}\t${r.className}\t${r.username}\t${usedPassword}`);
    navigator.clipboard?.writeText(lines.join("\n"));
    setCopied(true);
  }

  const classes = useMemo(() => [...new Set((students ?? []).map(s => s.className).filter(Boolean))].sort(), [students]);
  const visible = useMemo(
    () =>
      (students ?? []).filter(s => {
        if (classFilter && s.className !== classFilter) return false;
        const q = search.trim().toLowerCase();
        return !q || (s.displayName ?? "").toLowerCase().includes(q) || (s.username ?? "").toLowerCase().includes(q);
      }),
    [students, classFilter, search]
  );
  const pendingCount = (students ?? []).filter(s => s.mustChangePassword).length;
  const okCount = bulkResults?.filter(r => r.ok).length ?? 0;

  return (
    <div>
      <div className="results-stats">
        <div className="results-stat"><span>{students?.length ?? "—"}</span><small>Học sinh</small></div>
        <div className="results-stat"><span>{students ? classes.length : "—"}</span><small>Lớp</small></div>
        <div className="results-stat"><span>{students ? pendingCount : "—"}</span><small>Chưa đổi mật khẩu lần đầu</small></div>
      </div>

      <div className="admin-card">
        <div className="opening-list-head">
          <h2>Danh sách học sinh</h2>
          <button className="admin-btn-primary" type="button" onClick={openForm}>+ Tạo tài khoản</button>
        </div>

        {students && students.length > 0 && (
          <div className="admin-filter-bar">
            <label>
              Tìm học sinh
              <input className="admin-input" placeholder="Tên hoặc tên đăng nhập" value={search} onChange={e => setSearch(e.target.value)} />
            </label>
            <label>
              Lớp
              <select className="admin-input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                <option value="">Tất cả lớp</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        )}

        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
        {students === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
        {students && students.length === 0 && <p className="admin-muted-text">Chưa có học sinh nào. Bấm "+ Tạo tài khoản" để thêm.</p>}
        {students && students.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table opening-table">
              <thead>
                <tr><th>Học sinh</th><th>Lớp</th><th>Tên đăng nhập</th><th>Trạng thái</th><th></th></tr>
              </thead>
              <tbody>
                {visible.map(s => (
                  <tr key={s.uid}>
                    <td className="opening-test-title">{s.displayName}</td>
                    <td>{s.className ? <span className="opening-chip opening-chip-class">{s.className}</span> : "—"}</td>
                    <td><code className="student-username">{s.username}</code></td>
                    <td>
                      {s.disabled
                        ? <span className="opening-chip opening-chip-off">Đã khoá</span>
                        : s.mustChangePassword
                          ? <span className="opening-chip opening-chip-wait">Chưa đổi mật khẩu</span>
                          : <span className="opening-chip opening-chip-on">Hoạt động</span>}
                    </td>
                    <td>
                      <div className="opening-actions">
                        <button className="opening-btn" disabled={busyUid === s.uid} onClick={() => handleToggleLock(s)}>{s.disabled ? "🔓 Mở khoá" : "🔒 Khoá"}</button>
                        <button className="opening-btn opening-btn-danger" disabled={busyUid === s.uid} onClick={() => handleDelete(s)}>🗑 Xoá</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={5} className="admin-muted-text">Không có học sinh nào khớp.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="confirm-overlay" role="presentation" onClick={() => !creating && setShowForm(false)}>
          <div className="opening-modal results-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            {!bulkResults ? (
              <>
                <h2>Tạo tài khoản học sinh</h2>
                <p className="admin-muted-text">Tên đăng nhập tự sinh từ họ tên. Mỗi em phải đổi mật khẩu ngay lần đăng nhập đầu tiên.</p>
                <form className="admin-form student-create-form" onSubmit={handleBulkCreate}>
                  <label className="admin-mini-field">
                    <span>Dán mỗi dòng 1 em, dạng "Tên, Lớp"</span>
                    <textarea
                      className="admin-input admin-textarea"
                      rows={8}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder={"Nguyễn Văn An, 3A\nTrần Thị Bình, 3A\nLê Minh Châu, 4B"}
                      autoFocus
                    />
                  </label>
                  <label className="admin-mini-field">
                    <span>Mật khẩu ban đầu (chung cho các em vừa tạo)</span>
                    <PasswordInput className="admin-input" placeholder="Ít nhất 6 ký tự" value={initialPassword} onChange={e => setInitialPassword(e.target.value)} />
                  </label>
                  <div className="opening-form-actions">
                    {bulkError && <p className="admin-error">{bulkError}</p>}
                    <button type="button" className="admin-pill-btn" onClick={() => setShowForm(false)} disabled={creating}>Huỷ</button>
                    <button className="admin-btn-primary" type="submit" disabled={creating}>{creating ? "Đang tạo..." : "Tạo tài khoản"}</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2>Kết quả tạo tài khoản</h2>
                <p className="admin-muted-text">
                  Đã tạo {okCount}/{bulkResults.length} tài khoản. Sao chép danh sách để gửi cho học sinh — mật khẩu ban đầu chỉ hiện ở đây một lần.
                </p>
                <div style={{ overflowX: "auto", margin: "12px 0" }}>
                  <table className="admin-table">
                    <thead>
                      <tr><th>Tên</th><th>Lớp</th><th>Tên đăng nhập</th><th>Kết quả</th></tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((r, i) => (
                        <tr key={i}>
                          <td>{r.displayName}</td>
                          <td>{r.className || "—"}</td>
                          <td><code className="student-username">{r.username}</code></td>
                          <td>{r.ok ? <span className="opening-chip opening-chip-on">Đã tạo</span> : <span className="admin-error">{r.error}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="opening-form-actions">
                  <button type="button" className="opening-btn" onClick={copyResults} disabled={!okCount}>{copied ? "✓ Đã sao chép" : "📋 Sao chép danh sách"}</button>
                  <button type="button" className="admin-btn-primary" onClick={() => setShowForm(false)}>Xong</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
