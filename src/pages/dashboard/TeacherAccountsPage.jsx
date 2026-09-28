import { useEffect, useState } from "react";
import { createTeacherAccount, deleteTeacher, listTeachers, setTeacherDisabled, updateTeacherScope } from "../../lib/adminUsers.js";
import { listClassNames, BOOK_OPTIONS } from "../../lib/classes.js";
import { levelKey, normalizedLevelAccess, summarizeLevelAccess } from "../../lib/teacherScope.js";
import { useAuth } from "../../lib/authContext.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";

// Chọn nhiều dạng chip.
function ChipGroup({ options, value, onChange, labelOf }) {
  function toggle(v) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  }
  return (
    <div className="class-day-picker">
      {options.map(o => (
        <button key={o} type="button" className={`class-day-chip${value.includes(o) ? " is-on" : ""}`} onClick={() => toggle(o)}>
          {labelOf ? labelOf(o) : o}
        </button>
      ))}
    </div>
  );
}

const ACCESS_OPTIONS = [
  { value: "", label: "Không" },
  { value: "view", label: "Xem" },
  { value: "edit", label: "Sửa" },
];

function AccessSegment({ value, onChange, mixed }) {
  return (
    <div className="scope-segment" role="radiogroup">
      {ACCESS_OPTIONS.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={!mixed && value === o.value}
          className={!mixed && value === o.value ? `is-on is-${o.value || "none"}` : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Quyền theo từng cấp (lib/teacherScope.js, 2026-09-27): bấm bộ đề để mở danh sách cấp bên trong, mỗi cấp chọn
// Không / Xem (xem + làm bài trên trang học sinh) / Sửa (thêm soạn bài trong CMS). Hàng "Cả bộ" đặt nhanh mọi cấp.
function LevelAccessEditor({ value, onChange }) {
  const [openId, setOpenId] = useState(null);
  function setLevels(seriesId, levels, access) {
    const next = { ...value };
    for (const l of levels) {
      if (access) next[levelKey(seriesId, l)] = access;
      else delete next[levelKey(seriesId, l)];
    }
    onChange(next);
  }
  return (
    <div className="scope-tree">
      {BOOK_OPTIONS.map(o => {
        const vals = o.levels.map(l => value[levelKey(o.id, l)] ?? "");
        const edit = vals.filter(v => v === "edit").length;
        const view = vals.filter(v => v === "view").length;
        const allSame = vals.every(v => v === vals[0]);
        const single = o.levels.length === 1;
        const open = openId === o.id && !single;
        return (
          <div key={o.id} className={`scope-series${open ? " is-open" : ""}`}>
            <div className="scope-series-head">
              {single ? (
                <span className="scope-series-title">{o.title}</span>
              ) : (
                <button type="button" className="scope-series-toggle" onClick={() => setOpenId(open ? null : o.id)} aria-expanded={open}>
                  <span className="scope-caret">{open ? "▾" : "▸"}</span>
                  <span className="scope-series-title">{o.title}</span>
                  {(edit > 0 || view > 0) && (
                    <span className="scope-series-count">
                      {[edit && `Sửa ${edit}`, view && `Xem ${view}`].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              )}
              <AccessSegment value={vals[0]} mixed={!allSame} onChange={a => setLevels(o.id, o.levels, a)} />
            </div>
            {open && (
              <div className="scope-levels">
                {o.levels.map(l => (
                  <div key={l} className="scope-level">
                    <span>{o.levelLabel(l)}</span>
                    <AccessSegment value={value[levelKey(o.id, l)] ?? ""} onChange={a => setLevels(o.id, [l], a)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Modal dùng chung cho Tạo (teacher = null) và Sửa phạm vi (teacher = hồ sơ đang có). Giáo viên chính chỉ tạo/sửa
// giáo viên PHỤ (luôn restricted) — firestore.rules chặn giáo viên chính tạo tài khoản không giới hạn.
function TeacherModal({ teacher, isAdmin, classes, onDone, onClose }) {
  const editing = !!teacher;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [restricted, setRestricted] = useState(editing ? !!teacher.restricted : !isAdmin);
  const [levelAccess, setLevelAccess] = useState(() => normalizedLevelAccess(teacher));
  const [allowedClasses, setAllowedClasses] = useState(teacher?.allowedClasses ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const isRestricted = !isAdmin || restricted;
    const scope = {
      restricted: isRestricted,
      levelAccess: isRestricted ? levelAccess : {},
      allowedClasses: isRestricted ? allowedClasses : [],
    };
    let u = "";
    if (!editing) {
      u = username.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,}$/.test(u)) return setError("Tên đăng nhập ít nhất 3 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -");
      if (password.length < 6) return setError("Mật khẩu cần ít nhất 6 ký tự.");
    }
    setBusy(true);
    try {
      if (editing) await updateTeacherScope(teacher.uid, scope);
      else await createTeacherAccount(u, password, isRestricted ? scope : undefined);
      onDone();
    } catch (err) {
      console.error(err);
      setError(
        err?.code === "auth/email-already-in-use" ? "Tên đăng nhập đã có người dùng."
        : err?.code === "permission-denied" ? "Không có quyền (firestore.rules chưa đúng bản mới)."
        : `${editing ? "Lưu" : "Tạo tài khoản"} thất bại (${err?.code || err?.message || err}).`
      );
      setBusy(false);
    }
  }

  return (
    <div className="confirm-overlay" role="presentation" onClick={() => !busy && onClose()}>
      <div className="opening-modal teacher-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h2>{editing ? `Sửa — ${teacher.username ?? teacher.email}` : isAdmin ? "Tạo tài khoản giáo viên" : "Thêm giáo viên phụ"}</h2>
        <form className="teacher-modal-form" onSubmit={handleSubmit}>
          {!editing && (
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
          )}
          {isAdmin && (
            <div className="teacher-modal-segment" role="radiogroup">
              <button type="button" className={!restricted ? "is-on" : ""} onClick={() => setRestricted(false)}>Giáo viên chính</button>
              <button type="button" className={restricted ? "is-on" : ""} onClick={() => setRestricted(true)}>Giáo viên phụ</button>
            </div>
          )}
          {(!isAdmin || restricted) && (
            <>
              <div className="teacher-modal-group">
                <span>Quyền theo bộ đề / cấp</span>
                <LevelAccessEditor value={levelAccess} onChange={setLevelAccess} />
              </div>
              <div className="teacher-modal-group">
                <span>Lớp được mở bài / xem kết quả</span>
                {classes.length === 0 ? (
                  <p className="admin-muted-text">Chưa có lớp nào.</p>
                ) : (
                  <ChipGroup options={classes} value={allowedClasses} onChange={setAllowedClasses} />
                )}
              </div>
            </>
          )}
          <div className="opening-form-actions">
            {error && <p className="admin-error">{error}</p>}
            <button type="button" className="admin-pill-btn" onClick={onClose} disabled={busy}>Huỷ</button>
            <button className="admin-btn-primary" type="submit" disabled={busy}>
              {busy ? "Đang lưu..." : editing ? "Lưu" : "Tạo tài khoản"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScopeSummary({ teacher }) {
  const { edit, view } = summarizeLevelAccess(teacher);
  if (!edit && !view) return <div>Bài: (chưa cấp)</div>;
  return (
    <>
      {edit && <div>Sửa: {edit}</div>}
      {view && <div>Xem: {view}</div>}
    </>
  );
}

export default function TeacherAccountsPage() {
  const { user, isAdmin, isTeacher, profile } = useAuth();
  const confirm = useConfirm();
  const isFullStaff = isAdmin || (isTeacher && !profile?.restricted);
  const [teachers, setTeachers] = useState(null); // null = đang tải
  const [classes, setClasses] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyUid, setBusyUid] = useState(null);
  // null = đóng, "new" = tạo mới, còn lại = hồ sơ giáo viên đang sửa.
  const [modal, setModal] = useState(null);

  function reload() {
    setLoadError("");
    // Bỏ chính tài khoản đang đăng nhập — không tự sửa/khoá/xoá chính mình (lỗi thực tế 2026-09-24).
    listTeachers()
      .then(list => setTeachers(list.filter(t => t.uid !== user?.uid)))
      .catch(err => setLoadError(err.message || String(err)));
    listClassNames().then(setClasses);
  }

  useEffect(reload, []);

  // Admin quản lý mọi giáo viên; giáo viên chính chỉ quản lý giáo viên phụ.
  const canManage = t => isAdmin || (isFullStaff && !!t.restricted);

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
    if (!t.disabled && !(await confirm(`Khoá tài khoản ${name}? Giáo viên này sẽ bị đăng xuất và không đăng nhập được.`))) return;
    runAction(t, () => setTeacherDisabled(t.uid, !t.disabled));
  }

  async function handleDelete(t) {
    const name = t.username ?? t.email;
    if (!(await confirm(`Xoá hẳn tài khoản ${name}? Không khôi phục được.`, { danger: true }))) return;
    runAction(t, () => deleteTeacher(t.uid));
  }

  return (
    <div>
      <div className="results-stats">
        <div className="results-stat"><span>{teachers ? teachers.length : "—"}</span><small>Giáo viên</small></div>
        <div className="results-stat"><span>{teachers ? teachers.filter(t => t.restricted).length : "—"}</span><small>Giáo viên phụ</small></div>
        <div className="results-stat"><span>{teachers ? teachers.filter(t => t.disabled).length : "—"}</span><small>Đã khoá</small></div>
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="opening-list-head">
          <h2>Danh sách giáo viên</h2>
          {isFullStaff && (
            <button type="button" className="admin-btn-primary" onClick={() => setModal("new")}>+ Tạo tài khoản</button>
          )}
        </div>
        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
        {actionError && <p className="admin-error">{actionError}</p>}
        {teachers === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
        {teachers && teachers.length === 0 && <p className="admin-muted-text">Chưa có giáo viên nào.</p>}
        {teachers && teachers.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Phạm vi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.uid} className={t.disabled ? "teacher-row-disabled" : ""}>
                  <td>
                    {t.username ?? t.email}
                    {t.disabled && <span className="teacher-locked-chip">Đã khoá</span>}
                  </td>
                  <td>
                    {!t.restricted ? (
                      <span className="admin-muted-text">Không giới hạn</span>
                    ) : (
                      <>
                        <ScopeSummary teacher={t} />
                        <div>Lớp: {(t.allowedClasses ?? []).length ? t.allowedClasses.join(", ") : "(chưa cấp)"}</div>
                      </>
                    )}
                  </td>
                  <td>
                    {canManage(t) && (
                      <div className="teacher-row-actions">
                        <button className="admin-pill-btn" onClick={() => setModal(t)} disabled={busyUid === t.uid}>Sửa</button>
                        <button className="admin-pill-btn" onClick={() => handleToggleLock(t)} disabled={busyUid === t.uid}>
                          {t.disabled ? "Mở khoá" : "Khoá"}
                        </button>
                        <button className="admin-pill-btn admin-pill-btn-danger" onClick={() => handleDelete(t)} disabled={busyUid === t.uid}>Xoá</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <TeacherModal
          key={modal === "new" ? "new" : modal.uid}
          teacher={modal === "new" ? null : modal}
          isAdmin={isAdmin}
          classes={classes}
          onDone={() => { setModal(null); reload(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
