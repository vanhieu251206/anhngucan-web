import { useEffect, useMemo, useState } from "react";
import { listAllAccounts, setAccountDisabled, deleteStudent, deleteTeacher, deleteTester, resetAccountPassword } from "../../lib/adminUsers.js";
import PasswordInput from "../../components/PasswordInput.jsx";
import { useAuth } from "../../lib/authContext.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { readParams, setParams } from "../../lib/urlState.js";
import { loadPasswordVault } from "../../lib/passwordVault.js";
import StudentAccountsPage from "./StudentAccountsPage.jsx";
import TeacherAccountsPage from "./TeacherAccountsPage.jsx";
import TesterAccountsPage from "./TesterAccountsPage.jsx";

// Tab "Quản lý tài khoản" của ADMIN (2026-09-27) — gộp 3 mục cũ (Quản lý học sinh / Cấu hình tài khoản giáo viên /
// Tài khoản đặc biệt) thành 1: tab con "Tất cả" xem/lọc/khoá/xoá/xuất CSV mọi loại tài khoản; các tab con còn lại
// dùng lại nguyên trang cũ (tạo tài khoản, xếp lớp, phân quyền...). Giáo viên vẫn thấy các mục cũ như trước.
const SUB_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "students", label: "Học sinh" },
  { key: "teachers", label: "Giáo viên" },
  { key: "testers", label: "Tài khoản đặc biệt" },
];

const TYPE_LABEL = {
  admin: "Admin",
  teacher: "Giáo viên chính",
  "sub-teacher": "Giáo viên phụ",
  student: "Học sinh",
  tester: "Đặc biệt",
};
const TYPE_ORDER = ["admin", "teacher", "sub-teacher", "tester", "student"];

const accountType = a => (a.role === "teacher" && a.restricted ? "sub-teacher" : a.role);
const loginName = a => a.username ?? a.email ?? a.uid;
const createdDate = a => (a.createdAt?.toDate ? a.createdAt.toDate() : null);
const fmtDate = d => (d ? d.toLocaleDateString("vi-VN") : "");

function fold(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

// Đặt lại mật khẩu không cần mật khẩu hiện tại (chỉ admin, 2026-09-28) — worker/src/admin.js resetPassword.
function ResetPasswordModal({ account, onDone, onClose }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) return setError("Mật khẩu cần ít nhất 6 ký tự.");
    setError("");
    setBusy(true);
    try {
      await resetAccountPassword(account.uid, password);
      onDone();
    } catch (err) {
      console.error(err);
      setError(err?.message || String(err));
      setBusy(false);
    }
  }

  return (
    <div className="confirm-overlay" role="presentation" onClick={() => !busy && onClose()}>
      <div className="opening-modal class-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h2>Đổi mật khẩu — {loginName(account)}</h2>
        <form className="admin-form student-create-form" onSubmit={handleSubmit}>
          <label className="admin-mini-field">
            <span>Mật khẩu mới</span>
            <PasswordInput className="admin-input" autoComplete="new-password" placeholder="Ít nhất 6 ký tự" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
          </label>
          <div className="opening-form-actions">
            {error && <p className="admin-error">{error}</p>}
            <button type="button" className="admin-pill-btn" onClick={onClose} disabled={busy}>Huỷ</button>
            <button className="admin-btn-primary" type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllAccounts() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [accounts, setAccounts] = useState(null); // null = đang tải
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyUid, setBusyUid] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [vault, setVault] = useState({}); // { uid: { password } } — bản sao mật khẩu, chỉ admin đọc
  const [shownUid, setShownUid] = useState(null);
  const [resetting, setResetting] = useState(null); // tài khoản đang đổi mật khẩu

  function reload() {
    setLoadError("");
    listAllAccounts()
      .then(setAccounts)
      .catch(err => setLoadError(err.message || String(err)));
    loadPasswordVault()
      .then(setVault)
      .catch(err => console.warn("Không tải được mật khẩu:", err));
  }

  useEffect(reload, []);

  const classes = useMemo(
    () => [...new Set((accounts ?? []).filter(a => a.role === "student" && a.className).map(a => a.className))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })),
    [accounts]
  );

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return (accounts ?? [])
      .filter(a => {
        if (typeFilter && accountType(a) !== typeFilter) return false;
        if (classFilter && a.className !== classFilter) return false;
        if (statusFilter === "locked" && !a.disabled) return false;
        if (statusFilter === "active" && a.disabled) return false;
        if (q && !fold(`${loginName(a)} ${a.displayName ?? ""}`).includes(q)) return false;
        return true;
      })
      .sort((a, b) => TYPE_ORDER.indexOf(accountType(a)) - TYPE_ORDER.indexOf(accountType(b)) || loginName(a).localeCompare(loginName(b), "vi", { numeric: true }));
  }, [accounts, typeFilter, classFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const c = {};
    for (const a of accounts ?? []) c[accountType(a)] = (c[accountType(a)] ?? 0) + 1;
    return c;
  }, [accounts]);

  // Không khoá/xoá admin và chính mình.
  const canManage = a => a.uid !== user?.uid && a.role !== "admin";

  async function runAction(a, fn) {
    setActionError("");
    setBusyUid(a.uid);
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

  async function handleToggleLock(a) {
    if (!a.disabled && !(await confirm(`Khoá tài khoản ${loginName(a)}? Người dùng sẽ bị đăng xuất và không đăng nhập được.`))) return;
    runAction(a, () => setAccountDisabled(a.uid, !a.disabled));
  }

  async function handleDelete(a) {
    if (!(await confirm(`Xoá hẳn tài khoản ${loginName(a)}? Không khôi phục được.`, { danger: true }))) return;
    const del = a.role === "student" ? deleteStudent : a.role === "teacher" ? deleteTeacher : deleteTester;
    runAction(a, () => del(a.uid));
  }

  function exportCsv() {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Tên đăng nhập", "Họ tên", "Loại", "Lớp", "Ngày tạo", "Trạng thái"].map(esc).join(",")];
    for (const a of filtered) {
      lines.push([loginName(a), a.displayName ?? "", TYPE_LABEL[accountType(a)] ?? a.role, a.className ?? "", fmtDate(createdDate(a)), a.disabled ? "Đã khoá" : "Hoạt động"].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tai-khoan.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="admin-card">
      <div className="opening-list-head">
        <h2>Tất cả tài khoản{accounts ? ` (${filtered.length})` : ""}</h2>
        <button className="opening-btn" type="button" onClick={exportCsv} disabled={!filtered.length}>⬇ Xuất Excel (CSV)</button>
      </div>
      {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
      {actionError && <p className="admin-error">{actionError}</p>}
      {accounts === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
      {accounts && (
        <>
          <div className="admin-filter-bar">
            <label>
              Loại
              <select className="admin-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">Tất cả ({accounts.length})</option>
                {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABEL[t]} ({counts[t] ?? 0})</option>)}
              </select>
            </label>
            <label>
              Lớp
              <select className="admin-input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                <option value="">Tất cả lớp</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Trạng thái
              <select className="admin-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="active">Hoạt động</option>
                <option value="locked">Đã khoá</option>
              </select>
            </label>
            <label>
              Tìm kiếm
              <input className="admin-input" type="text" placeholder="Tên đăng nhập / họ tên" value={search} onChange={e => setSearch(e.target.value)} />
            </label>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ tên</th>
                <th>Loại</th>
                <th>Mật khẩu</th>
                <th>Lớp</th>
                <th>Ngày tạo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="admin-muted-text">Không có tài khoản nào khớp bộ lọc.</td></tr>
              )}
              {filtered.map(a => (
                <tr key={a.uid} className={a.disabled ? "teacher-row-disabled" : ""}>
                  <td>
                    {loginName(a)}
                    {a.uid === user?.uid && <span className="admin-muted-text"> (bạn)</span>}
                    {a.disabled && <span className="teacher-locked-chip">Đã khoá</span>}
                  </td>
                  <td>{a.displayName ?? ""}</td>
                  <td>{TYPE_LABEL[accountType(a)] ?? a.role ?? "(không rõ)"}</td>
                  <td>
                    {a.role !== "admin" && (vault[a.uid]?.password ? (
                      <button type="button" className="admin-pill-btn" onClick={() => setShownUid(shownUid === a.uid ? null : a.uid)}>
                        {shownUid === a.uid ? vault[a.uid].password : "••••••  Hiện"}
                      </button>
                    ) : (
                      <span className="admin-muted-text">Chưa có</span>
                    ))}
                  </td>
                  <td>{a.className ?? ""}</td>
                  <td>{fmtDate(createdDate(a))}</td>
                  <td>
                    {canManage(a) && (
                      <div className="teacher-row-actions">
                        <button className="admin-pill-btn" onClick={() => setResetting(a)} disabled={busyUid === a.uid}>Đổi MK</button>
                        <button className="admin-pill-btn" onClick={() => handleToggleLock(a)} disabled={busyUid === a.uid}>
                          {a.disabled ? "Mở khoá" : "Khoá"}
                        </button>
                        <button className="admin-pill-btn admin-pill-btn-danger" onClick={() => handleDelete(a)} disabled={busyUid === a.uid}>Xoá</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {resetting && (
        <ResetPasswordModal
          account={resetting}
          onDone={() => { setResetting(null); reload(); }}
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  );
}

export default function AccountsPage() {
  const [tab, setTabState] = useState(() => {
    const t = readParams().get("tab");
    return SUB_TABS.some(s => s.key === t) ? t : "all";
  });
  function setTab(key) {
    setTabState(key);
    setParams({ tab: key === "all" ? null : key }, { replace: true });
  }

  return (
    <div>
      <div className="ielts-testpicker-tabs admin-testpicker-tabs">
        {SUB_TABS.map(s => (
          <button key={s.key} type="button" className={`ielts-testpicker-tab${tab === s.key ? " is-active" : ""}`} onClick={() => setTab(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      {tab === "all" && <AllAccounts />}
      {tab === "students" && <StudentAccountsPage />}
      {tab === "teachers" && <TeacherAccountsPage />}
      {tab === "testers" && <TesterAccountsPage />}
    </div>
  );
}
