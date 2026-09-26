import { useEffect, useState } from "react";
import { createTeacherAccount, listTeachers, updateTeacherScope } from "../../lib/adminUsers.js";
import { listClassNames } from "../../lib/classes.js";
import { YLE_SERIES } from "../../lib/yleData.js";
import { useAuth } from "../../lib/authContext.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";

function seriesTitle(id) {
  return YLE_SERIES.find(s => s.id === id)?.title ?? id;
}

function CheckboxGroup({ options, value, onChange, labelOf }) {
  function toggle(v) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  }
  return (
    <div className="admin-options-grid">
      {options.map(o => (
        <label key={o} className="admin-checkbox-row">
          <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
          {labelOf ? labelOf(o) : o}
        </label>
      ))}
    </div>
  );
}

// Chọn nhiều dạng chip (modal tạo tài khoản).
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

// Sửa phạm vi 1 giáo viên (bấm giữa các dòng trong bảng) — dùng chung cho admin lẫn giáo viên
// chính tự phân công cho người dạy ngắn hạn (chốt 2026-09-22, xem firestore.rules).
function ScopeEditor({ teacher, classes, onSaved, onCancel }) {
  const [restricted, setRestricted] = useState(!!teacher.restricted);
  const [allowedSeriesIds, setAllowedSeriesIds] = useState(teacher.allowedSeriesIds ?? []);
  const [allowedClasses, setAllowedClasses] = useState(teacher.allowedClasses ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      await updateTeacherScope(teacher.uid, { restricted, allowedSeriesIds, allowedClasses });
      onSaved();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card" style={{ marginTop: 12 }}>
      <label className="admin-checkbox-row" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} />
        Giới hạn tài khoản này (dạy ngắn hạn/vài lớp)
      </label>
      {restricted && (
        <>
          <p className="admin-muted-text" style={{ marginBottom: 6 }}>Được soạn bài cho bộ đề</p>
          <CheckboxGroup options={YLE_SERIES.map(s => s.id)} value={allowedSeriesIds} onChange={setAllowedSeriesIds} labelOf={seriesTitle} />
          <p className="admin-muted-text" style={{ margin: "12px 0 6px" }}>Được mở bài / xem kết quả cho lớp</p>
          {classes.length === 0 ? (
            <p className="admin-muted-text">Chưa có lớp nào (tạo lớp ở mục "Quản lý học sinh" trước).</p>
          ) : (
            <CheckboxGroup options={classes} value={allowedClasses} onChange={setAllowedClasses} />
          )}
        </>
      )}
      {error && <p className="admin-error">{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className="admin-pill-btn" onClick={onCancel} disabled={saving}>Huỷ</button>
        <button type="button" className="admin-btn-primary" onClick={save} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}

export default function TeacherAccountsPage() {
  const { user, isAdmin, isTeacher, profile } = useAuth();
  const isFullStaff = isAdmin || (isTeacher && !profile?.restricted);
  const [teachers, setTeachers] = useState(null); // null = đang tải
  const [classes, setClasses] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingUid, setEditingUid] = useState(null);
  const [newRestricted, setNewRestricted] = useState(false);
  const [newSeries, setNewSeries] = useState([]);
  const [newClasses, setNewClasses] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  function closeCreate() {
    if (creating) return;
    setShowCreate(false);
    setCreateError("");
  }

  function reload() {
    setLoadError("");
    // Bỏ chính tài khoản đang đăng nhập — giáo viên chính không tự sửa phạm vi của mình (tránh tự
    // khoá mình), chỉ phân quyền cho giáo viên khác (lỗi thực tế 2026-09-24).
    listTeachers()
      .then(list => setTeachers(list.filter(t => t.uid !== user?.uid)))
      .catch(err => setLoadError(err.message || String(err)));
    listClassNames().then(setClasses);
  }

  useEffect(reload, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,}$/.test(u)) {
      setCreateError("Tên đăng nhập ít nhất 3 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -");
      return;
    }
    if (password.length < 6) {
      setCreateError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    setCreating(true);
    try {
      // Giáo viên chính chỉ tạo được giáo viên phụ (bị giới hạn) — firestore.rules chặn tạo tài khoản không giới hạn.
      const restricted = !isAdmin || newRestricted;
      await createTeacherAccount(u, password, restricted ? { restricted, allowedSeriesIds: newSeries, allowedClasses: newClasses } : undefined);
      setUsername("");
      setPassword("");
      setNewSeries([]);
      setNewClasses([]);
      setShowCreate(false);
      reload();
    } catch (err) {
      console.error(err);
      setCreateError(
        err?.code === "auth/email-already-in-use" ? "Tên đăng nhập đã có người dùng."
        : err?.code === "permission-denied" ? "Không có quyền lưu hồ sơ (firestore.rules chưa đúng bản mới)."
        : `Tạo tài khoản thất bại (${err?.code || err?.message || err}).`
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div className="opening-list-head">
          <h2>Danh sách giáo viên</h2>
          {isFullStaff && (
            <button type="button" className="admin-btn-primary" onClick={() => setShowCreate(true)}>+ Tạo tài khoản</button>
          )}
        </div>
        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
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
                <tr key={t.uid}>
                  <td>{t.username ?? t.email}</td>
                  <td>
                    {!t.restricted ? (
                      <span className="admin-muted-text">Không giới hạn</span>
                    ) : (
                      <>
                        <div>Bộ đề: {(t.allowedSeriesIds ?? []).length ? t.allowedSeriesIds.map(seriesTitle).join(", ") : "(chưa cấp)"}</div>
                        <div>Lớp: {(t.allowedClasses ?? []).length ? t.allowedClasses.join(", ") : "(chưa cấp)"}</div>
                      </>
                    )}
                  </td>
                  <td>
                    <button className="admin-pill-btn" onClick={() => setEditingUid(editingUid === t.uid ? null : t.uid)}>
                      {editingUid === t.uid ? "Đóng" : "Sửa phạm vi"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {teachers && teachers.map(t =>
          editingUid === t.uid ? (
            <ScopeEditor
              key={t.uid}
              teacher={t}
              classes={classes}
              onSaved={() => { setEditingUid(null); reload(); }}
              onCancel={() => setEditingUid(null)}
            />
          ) : null
        )}
      </div>

      {showCreate && (
        <div className="confirm-overlay" role="presentation" onClick={closeCreate}>
          <div className="opening-modal teacher-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2>{isAdmin ? "Tạo tài khoản giáo viên" : "Thêm giáo viên phụ"}</h2>
            <form className="teacher-modal-form" onSubmit={handleCreate}>
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
              {isAdmin && (
                <div className="teacher-modal-segment" role="radiogroup">
                  <button type="button" className={!newRestricted ? "is-on" : ""} onClick={() => setNewRestricted(false)}>Giáo viên chính</button>
                  <button type="button" className={newRestricted ? "is-on" : ""} onClick={() => setNewRestricted(true)}>Giáo viên phụ</button>
                </div>
              )}
              {(!isAdmin || newRestricted) && (
                <>
                  <div className="teacher-modal-group">
                    <span>Bộ đề được soạn bài</span>
                    <ChipGroup options={YLE_SERIES.map(s => s.id)} value={newSeries} onChange={setNewSeries} labelOf={seriesTitle} />
                  </div>
                  <div className="teacher-modal-group">
                    <span>Lớp được mở bài / xem kết quả</span>
                    {classes.length === 0 ? (
                      <p className="admin-muted-text">Chưa có lớp nào.</p>
                    ) : (
                      <ChipGroup options={classes} value={newClasses} onChange={setNewClasses} />
                    )}
                  </div>
                </>
              )}
              <div className="opening-form-actions">
                {createError && <p className="admin-error">{createError}</p>}
                <button type="button" className="admin-pill-btn" onClick={closeCreate} disabled={creating}>Huỷ</button>
                <button className="admin-btn-primary" type="submit" disabled={creating}>
                  {creating ? "Đang tạo..." : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
