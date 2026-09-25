import { useEffect, useMemo, useState } from "react";
import PasswordInput from "../../components/PasswordInput.jsx";
import { listStudents, bulkCreateStudents, setStudentDisabled, deleteStudent, setStudentClass } from "../../lib/adminUsers.js";
import { listClassDocs, createClass, deleteClass, setClassSchedule, setClassBook, parseClassLine, formatSchedule, formatBook, BOOK_OPTIONS, DAY_OPTIONS, dayLabel } from "../../lib/classes.js";
import { useAuth } from "../../lib/authContext.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { downloadStudentCardPdf, downloadAllStudentCardPdfs } from "../../lib/studentCardPdf.js";

// Học sinh chưa gắn lớp (tài khoản cũ) gom vào 1 ô riêng.
const NO_CLASS = "\u0000none";
const sortNames = (a, b) => a.localeCompare(b, "vi", { numeric: true });

// Chọn thứ (T2..CN) + giờ học của lớp.
function ScheduleFields({ days, time, onChange }) {
  function toggle(d) {
    onChange({ days: days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b), time });
  }
  return (
    <>
      <div className="admin-mini-field">
        <span>Thứ học</span>
        <div className="class-day-picker">
          {DAY_OPTIONS.map(d => (
            <button key={d} type="button" className={`class-day-chip${days.includes(d) ? " is-on" : ""}`} onClick={() => toggle(d)}>{dayLabel(d)}</button>
          ))}
        </div>
      </div>
      <label className="admin-mini-field">
        <span>Giờ học</span>
        <input className="admin-input class-time-input" type="time" value={time} onChange={e => onChange({ days, time: e.target.value })} />
      </label>
    </>
  );
}

// Chọn sách của lớp: đúng 1 bộ đề, cả bộ hoặc 1 vài cấp (levels rỗng = cả bộ). book null = chưa gán.
function BookFields({ book, onChange }) {
  const opt = BOOK_OPTIONS.find(o => o.id === book?.seriesId);
  const levels = book?.levels ?? [];
  function toggle(n) {
    const next = levels.includes(n) ? levels.filter(x => x !== n) : [...levels, n].sort((a, b) => a - b);
    onChange({ seriesId: book.seriesId, levels: next.length === opt.levels.length ? [] : next });
  }
  return (
    <>
      <label className="admin-mini-field">
        <span>Sách học</span>
        <select className="admin-input" value={book?.seriesId ?? ""} onChange={e => onChange(e.target.value ? { seriesId: e.target.value, levels: [] } : null)}>
          <option value="">— Chưa gán —</option>
          {BOOK_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </label>
      {opt && opt.levels.length > 1 && (
        <div className="admin-mini-field">
          <span>Cấp được học</span>
          <div className="class-day-picker">
            <button type="button" className={`class-day-chip${levels.length === 0 ? " is-on" : ""}`} onClick={() => onChange({ seriesId: book.seriesId, levels: [] })}>Cả bộ</button>
            {opt.levels.map(n => (
              <button key={n} type="button" className={`class-day-chip${levels.includes(n) ? " is-on" : ""}`} onClick={() => toggle(n)}>{opt.levelLabel(n)}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Dán danh sách lớp thô (vd "CAN-ANH2-246-16H30") → tên + lịch. Tên trùng nhau trong cùng đợt thêm (A), (B)...
function buildBulkPreview(text, existing) {
  const rows = text.split("\n").map(l => l.trim()).filter(Boolean).map(parseClassLine).filter(r => r.name);
  const count = {};
  for (const r of rows) count[r.name] = (count[r.name] ?? 0) + 1;
  const seen = {};
  return rows.map(r => {
    let name = r.name;
    if (count[name] > 1) {
      seen[name] = (seen[name] ?? 0) + 1;
      name = `${name} (${String.fromCharCode(64 + seen[r.name])})`;
    }
    return { ...r, name, error: existing.has(name) ? "Đã có lớp này" : "" };
  });
}

// Quản lý tài khoản học sinh theo LỚP (chốt 2026-09-25): tạo lớp trước → vào lớp → thêm học sinh (dán mỗi dòng
// 1 tên). Tên đăng nhập tự sinh từ họ tên (bỏ dấu, viết liền; trùng thì thêm số). Tất cả dùng CHUNG 1 mật khẩu
// ban đầu do giáo viên nhập lúc tạo — mỗi em BẮT BUỘC đổi mật khẩu ngay lần đăng nhập đầu
// (components/ForceChangePassword.jsx). Mật khẩu ban đầu không lưu ở đâu; học sinh quên mật khẩu đã đổi thì cần
// tạo lại tài khoản (không có Admin SDK). Lớp lưu ở collection `classes` (lib/classes.js).
export default function StudentAccountsPage() {
  const { user, isTeacher, profile } = useAuth();
  // Giáo viên phụ (restricted) chỉ XEM học sinh của lớp trong allowedClasses — không tạo/xoá lớp, không
  // thêm/chuyển lớp/khoá/xoá học sinh (chốt 2026-09-25, chặn thật ở firestore.rules `isFullStaff()`).
  const isRestricted = isTeacher && !!profile?.restricted;
  const allowedClassSet = isRestricted ? new Set(profile?.allowedClasses ?? []) : null;
  const confirm = useConfirm();
  const [busyUid, setBusyUid] = useState(null);
  const [students, setStudents] = useState(null);
  const [classDocs, setClassDocs] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);
  const [search, setSearch] = useState("");

  // Form tạo lớp: 1 lớp (tên + chọn thứ/giờ) hoặc nhiều lớp (dán danh sách thô).
  const [classForm, setClassForm] = useState(null); // { mode: "single"|"bulk", name, days, time, bulk }
  const [bulkClassResults, setBulkClassResults] = useState(null);
  const [classError, setClassError] = useState("");
  const [savingClass, setSavingClass] = useState(false);
  const [scheduleEdit, setScheduleEdit] = useState(null); // sửa lớp: { name, days, time, book }
  const [bookEdit, setBookEdit] = useState(null); // gán nhanh sách: { name, book }

  const [moving, setMoving] = useState(null); // { student, target }
  const [showForm, setShowForm] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [usedPassword, setUsedPassword] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(null); // "all" | username đang tạo PDF

  function reload() {
    setLoadError("");
    listStudents()
      .then(list => setStudents(list.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""))))
      .catch(err => setLoadError(err.message || String(err)));
    listClassDocs().then(setClassDocs).catch(() => setClassDocs([]));
  }
  useEffect(reload, []);

  // Lớp = lớp đã tạo + lớp đang có học sinh (tài khoản tạo trước khi có mục "Tạo lớp").
  const classes = useMemo(() => {
    const byName = new Map();
    for (const c of classDocs) byName.set(c.name, { name: c.name, days: c.days ?? [], time: c.time ?? "", book: c.book ?? null, students: [] });
    for (const s of students ?? []) {
      const key = s.className || NO_CLASS;
      if (!byName.has(key)) byName.set(key, { name: key, days: [], time: "", book: null, students: [] });
      byName.get(key).students.push(s);
    }
    return [...byName.values()]
      .filter(c => !allowedClassSet || allowedClassSet.has(c.name))
      .sort((a, b) => (a.name === NO_CLASS) - (b.name === NO_CLASS) || sortNames(a.name, b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classDocs, students, profile]);

  const current = selectedClass != null ? classes.find(c => c.name === selectedClass) ?? { name: selectedClass, students: [] } : null;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (current?.students ?? []).filter(s => !q || (s.displayName ?? "").toLowerCase().includes(q) || (s.username ?? "").toLowerCase().includes(q));
  }, [current, search]);

  const visibleStudents = classes.flatMap(c => c.students);
  const pendingCount = visibleStudents.filter(s => s.mustChangePassword).length;
  const okCount = bulkResults?.filter(r => r.ok).length ?? 0;
  const classLabel = name => (name === NO_CLASS ? "Chưa xếp lớp" : name);

  function openClass(name) {
    setSearch("");
    setSelectedClass(name);
  }

  const existingNames = useMemo(() => new Set(classes.map(c => c.name)), [classes]);
  const bulkPreview = useMemo(
    () => (classForm?.mode === "bulk" ? buildBulkPreview(classForm.bulk, existingNames) : []),
    [classForm, existingNames]
  );

  function openClassForm() {
    setClassError("");
    setBulkClassResults(null);
    setClassForm({ mode: "single", name: "", days: [], time: "", book: null, bulk: "" });
  }

  async function handleCreateClass(e) {
    e.preventDefault();
    setClassError("");
    setSavingClass(true);
    try {
      if (classForm.mode === "single") {
        const name = await createClass(classForm.name, user?.uid, { days: classForm.days, time: classForm.time, book: classForm.book });
        setClassForm(null);
        reload();
        openClass(name);
        return;
      }
      if (!bulkPreview.length) throw new Error("Chưa dán tên lớp nào.");
      const results = [];
      for (const r of bulkPreview) {
        if (r.error) {
          results.push({ ...r, ok: false });
          continue;
        }
        try {
          await createClass(r.name, user?.uid, { days: r.days, time: r.time });
          results.push({ ...r, ok: true });
        } catch (err) {
          results.push({ ...r, ok: false, error: err.message || String(err) });
        }
      }
      setBulkClassResults(results);
      reload();
    } catch (err) {
      setClassError(err.message || String(err));
    } finally {
      setSavingClass(false);
    }
  }

  async function handleSaveSchedule(e) {
    e.preventDefault();
    setSavingClass(true);
    try {
      await setClassSchedule(scheduleEdit.name, { days: scheduleEdit.days, time: scheduleEdit.time });
      await setClassBook(scheduleEdit.name, scheduleEdit.book);
      setScheduleEdit(null);
      reload();
    } catch (err) {
      setClassError(err.message || String(err));
    } finally {
      setSavingClass(false);
    }
  }

  // Gán nhanh sách (bấm ô "Sách" trong bảng hoặc nút "📘 Gán sách" trong lớp).
  function openBookEdit(c) {
    setClassError("");
    setBookEdit({ name: c.name, book: c.book ?? null });
  }

  async function handleSaveBook(e) {
    e.preventDefault();
    setSavingClass(true);
    try {
      await setClassBook(bookEdit.name, bookEdit.book);
      setBookEdit(null);
      reload();
    } catch (err) {
      setClassError(err.message || String(err));
    } finally {
      setSavingClass(false);
    }
  }

  function openScheduleEdit(c) {
    setClassError("");
    setScheduleEdit({ name: c.name, days: c.days ?? [], time: c.time ?? "", book: c.book ?? null });
  }

  // Xoá lớp: học sinh của lớp KHÔNG bị xoá, chỉ chuyển sang "Chưa xếp lớp".
  async function handleDeleteClass(c) {
    const n = c.students.length;
    const msg = n ? `Xoá lớp ${c.name}? ${n} học sinh của lớp sẽ chuyển sang "Chưa xếp lớp" (không bị xoá tài khoản).` : `Xoá lớp ${c.name}?`;
    if (!(await confirm(msg, { danger: true }))) return;
    try {
      for (const s of c.students) await setStudentClass(s.uid, "");
      await deleteClass(c.name);
      setSelectedClass(null);
      reload();
    } catch (err) {
      setLoadError(err.message || String(err));
    }
  }

  async function handleMove(e) {
    e.preventDefault();
    const { student, target } = moving;
    if (target === (student.className || "")) return setMoving(null);
    setBusyUid(student.uid);
    try {
      await setStudentClass(student.uid, target);
      setMoving(null);
      reload();
    } catch (err) {
      setLoadError(err.message || String(err));
    } finally {
      setBusyUid(null);
    }
  }

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
      .map(name => ({ displayName: name, className: selectedClass }));
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

  // Phiếu đăng nhập PDF — mỗi em 1 file (lib/studentCardPdf.js).
  async function handleDownloadCards(list, key = "all") {
    setBulkError("");
    setDownloading(key);
    const info = { className: current.name, schedule: formatSchedule(current), password: usedPassword };
    try {
      if (list.length === 1) await downloadStudentCardPdf(list[0], info);
      else await downloadAllStudentCardPdfs(list, info);
    } catch (err) {
      setBulkError(err.message || String(err));
    } finally {
      setDownloading(null);
    }
  }

  function copyResults() {
    const lines = bulkResults.filter(r => r.ok).map(r => `${r.displayName}\t${r.className}\t${r.username}\t${usedPassword}`);
    navigator.clipboard?.writeText(lines.join("\n"));
    setCopied(true);
  }

  return (
    <div>
      {!current ? (
        <>
          <div className="results-stats">
            <div className="results-stat"><span>{students ? classes.filter(c => c.name !== NO_CLASS).length : "—"}</span><small>Lớp</small></div>
            <div className="results-stat"><span>{students ? visibleStudents.length : "—"}</span><small>Học sinh</small></div>
            <div className="results-stat"><span>{students ? pendingCount : "—"}</span><small>Chưa đổi mật khẩu lần đầu</small></div>
          </div>

          <div className="admin-card">
            <div className="opening-list-head">
              <h2>Lớp học</h2>
              {!isRestricted && (
                <button className="admin-btn-primary" type="button" onClick={openClassForm}>+ Tạo lớp</button>
              )}
            </div>
            {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
            {students === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
            {students && classes.length === 0 && <p className="admin-muted-text">Chưa có lớp nào.</p>}
            {students && classes.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table opening-table class-table">
                  <thead>
                    <tr><th>Lớp</th><th>Lịch học</th><th>Sách</th><th>Học sinh</th>{!isRestricted && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {classes.map(c => (
                      <tr key={c.name} className="class-row" onClick={() => openClass(c.name)}>
                        <td>{c.name === NO_CLASS ? <span className="admin-muted-text">Chưa xếp lớp</span> : <span className="opening-chip opening-chip-class">{c.name}</span>}</td>
                        <td>{formatSchedule(c) || <span className="admin-muted-text">—</span>}</td>
                        <td>
                          {c.name === NO_CLASS ? "" : isRestricted ? (
                            formatBook(c.book) || <span className="admin-muted-text">Chưa gán</span>
                          ) : (
                            <button type="button" className={`class-book-cell${c.book ? "" : " is-empty"}`} onClick={e => { e.stopPropagation(); openBookEdit(c); }}>
                              {formatBook(c.book) || "Chưa gán"} <span className="class-book-cell-icon" aria-hidden="true">✏️</span>
                            </button>
                          )}
                        </td>
                        <td>{c.students.length}</td>
                        {!isRestricted && (
                          <td>
                            <div className="opening-actions">
                              {c.name !== NO_CLASS && (
                                <button className="opening-btn" type="button" onClick={e => { e.stopPropagation(); openScheduleEdit(c); }}>✏️ Sửa lớp</button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="admin-card">
          <button type="button" className="admin-pill-btn" onClick={() => setSelectedClass(null)}>← Tất cả lớp</button>
          <div className="opening-list-head" style={{ marginTop: 16 }}>
            <div>
              <h2>Lớp {classLabel(current.name)} <span className="admin-muted-text class-head-count">· {current.students.length} học sinh</span></h2>
              {current.name !== NO_CLASS && (
                <p className="admin-muted-text class-head-schedule">
                  🗓 {formatSchedule(current) || "Chưa có lịch học"} · 📘 {formatBook(current.book) || "Chưa gán sách"}
                </p>
              )}
            </div>
            <div className="opening-actions">
              {!isRestricted && current.name !== NO_CLASS && (
                <>
                  <button className="opening-btn" type="button" onClick={() => openBookEdit(current)}>📘 Gán sách</button>
                  <button className="opening-btn" type="button" onClick={() => openScheduleEdit(current)}>✏️ Sửa lớp</button>
                </>
              )}
              {!isRestricted && current.name !== NO_CLASS && (
                <button className="opening-btn opening-btn-danger" type="button" onClick={() => handleDeleteClass(current)}>🗑 Xoá lớp</button>
              )}
              {!isRestricted && current.name !== NO_CLASS && <button className="admin-btn-primary" type="button" onClick={openForm}>+ Thêm học sinh</button>}
            </div>
          </div>

          {current.students.length > 0 && (
            <div className="admin-filter-bar">
              <label>
                Tìm học sinh
                <input className="admin-input" placeholder="Tên hoặc tên đăng nhập" value={search} onChange={e => setSearch(e.target.value)} />
              </label>
            </div>
          )}

          {loadError && <p className="admin-error">{loadError}</p>}
          {current.students.length === 0 && <p className="admin-muted-text">Lớp chưa có học sinh.</p>}
          {current.students.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table opening-table">
                <thead>
                  <tr><th>Học sinh</th><th>Tên đăng nhập</th><th>Trạng thái</th>{!isRestricted && <th></th>}</tr>
                </thead>
                <tbody>
                  {visible.map(s => (
                    <tr key={s.uid}>
                      <td className="opening-test-title">{s.displayName}</td>
                      <td><code className="student-username">{s.username}</code></td>
                      <td>
                        {s.disabled
                          ? <span className="opening-chip opening-chip-off">Đã khoá</span>
                          : s.mustChangePassword
                            ? <span className="opening-chip opening-chip-wait">Chưa đổi mật khẩu</span>
                            : <span className="opening-chip opening-chip-on">Hoạt động</span>}
                      </td>
                      {!isRestricted && <td>
                        <div className="opening-actions">
                          <button className="opening-btn" disabled={busyUid === s.uid} onClick={() => setMoving({ student: s, target: s.className || "" })}>↔ Chuyển lớp</button>
                          <button className="opening-btn" disabled={busyUid === s.uid} onClick={() => handleToggleLock(s)}>{s.disabled ? "🔓 Mở khoá" : "🔒 Khoá"}</button>
                          <button className="opening-btn opening-btn-danger" disabled={busyUid === s.uid} onClick={() => handleDelete(s)}>🗑 Xoá</button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                  {visible.length === 0 && <tr><td colSpan={isRestricted ? 3 : 4} className="admin-muted-text">Không có học sinh nào khớp.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {moving && (
        <div className="confirm-overlay" role="presentation" onClick={() => setMoving(null)}>
          <div className="opening-modal class-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2>Chuyển lớp</h2>
            <p className="admin-muted-text">{moving.student.displayName}</p>
            <form className="admin-form student-create-form" onSubmit={handleMove}>
              <label className="admin-mini-field">
                <span>Lớp mới</span>
                <select className="admin-input" value={moving.target} onChange={e => setMoving({ ...moving, target: e.target.value })} autoFocus>
                  {classes.filter(c => c.name !== NO_CLASS).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  <option value="">Chưa xếp lớp</option>
                </select>
              </label>
              <div className="opening-form-actions">
                <button type="button" className="admin-pill-btn" onClick={() => setMoving(null)}>Huỷ</button>
                <button className="admin-btn-primary" type="submit" disabled={busyUid === moving.student.uid}>Chuyển</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bookEdit && (
        <div className="confirm-overlay" role="presentation" onClick={() => !savingClass && setBookEdit(null)}>
          <div className="opening-modal class-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2>Gán sách — lớp {bookEdit.name}</h2>
            <form className="admin-form student-create-form" onSubmit={handleSaveBook}>
              <BookFields book={bookEdit.book} onChange={book => setBookEdit({ ...bookEdit, book })} />
              <div className="opening-form-actions">
                {classError && <p className="admin-error">{classError}</p>}
                <button type="button" className="admin-pill-btn" onClick={() => setBookEdit(null)} disabled={savingClass}>Huỷ</button>
                <button className="admin-btn-primary" type="submit" disabled={savingClass}>{savingClass ? "Đang lưu..." : "Lưu"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scheduleEdit && (
        <div className="confirm-overlay" role="presentation" onClick={() => !savingClass && setScheduleEdit(null)}>
          <div className="opening-modal class-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2>Lớp {scheduleEdit.name}</h2>
            <form className="admin-form student-create-form" onSubmit={handleSaveSchedule}>
              <ScheduleFields days={scheduleEdit.days} time={scheduleEdit.time} onChange={v => setScheduleEdit({ ...scheduleEdit, ...v })} />
              <BookFields book={scheduleEdit.book} onChange={book => setScheduleEdit({ ...scheduleEdit, book })} />
              <div className="opening-form-actions">
                {classError && <p className="admin-error">{classError}</p>}
                <button type="button" className="admin-pill-btn" onClick={() => setScheduleEdit(null)} disabled={savingClass}>Huỷ</button>
                <button className="admin-btn-primary" type="submit" disabled={savingClass}>{savingClass ? "Đang lưu..." : "Lưu"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {classForm && (
        <div className="confirm-overlay" role="presentation" onClick={() => !savingClass && setClassForm(null)}>
          <div className={`opening-modal ${classForm.mode === "bulk" ? "results-modal" : "class-modal"}`} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            {bulkClassResults ? (
              <>
                <h2>Kết quả tạo lớp</h2>
                <p className="admin-muted-text">Đã tạo {bulkClassResults.filter(r => r.ok).length}/{bulkClassResults.length} lớp.</p>
                <div style={{ overflowX: "auto", margin: "12px 0" }}>
                  <table className="admin-table">
                    <thead><tr><th>Lớp</th><th>Lịch học</th><th>Kết quả</th></tr></thead>
                    <tbody>
                      {bulkClassResults.map((r, i) => (
                        <tr key={i}>
                          <td>{r.name}</td>
                          <td>{formatSchedule(r) || "—"}</td>
                          <td>{r.ok ? <span className="opening-chip opening-chip-on">Đã tạo</span> : <span className="admin-error">{r.error}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="opening-form-actions">
                  <button type="button" className="admin-btn-primary" onClick={() => setClassForm(null)}>Xong</button>
                </div>
              </>
            ) : (
              <>
                <h2>Tạo lớp</h2>
                <div className="class-mode-tabs">
                  <button type="button" className={`class-mode-tab${classForm.mode === "single" ? " is-active" : ""}`} onClick={() => setClassForm({ ...classForm, mode: "single" })}>1 lớp</button>
                  <button type="button" className={`class-mode-tab${classForm.mode === "bulk" ? " is-active" : ""}`} onClick={() => setClassForm({ ...classForm, mode: "bulk" })}>Nhiều lớp</button>
                </div>
                <form className="admin-form student-create-form" onSubmit={handleCreateClass}>
                  {classForm.mode === "single" ? (
                    <>
                      <label className="admin-mini-field">
                        <span>Tên lớp</span>
                        <input className="admin-input" placeholder="Vd: ANH1" value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} autoFocus />
                      </label>
                      <ScheduleFields days={classForm.days} time={classForm.time} onChange={v => setClassForm({ ...classForm, ...v })} />
                      <BookFields book={classForm.book} onChange={book => setClassForm({ ...classForm, book })} />
                    </>
                  ) : (
                    <>
                      <label className="admin-mini-field">
                        <span>Dán mỗi dòng 1 lớp</span>
                        <textarea
                          className="admin-input admin-textarea"
                          rows={6}
                          value={classForm.bulk}
                          onChange={e => setClassForm({ ...classForm, bulk: e.target.value })}
                          placeholder={"ANH1-357-18H\nANH2-246-16H30"}
                          autoFocus
                        />
                      </label>
                      {bulkPreview.length > 0 && (
                        <div style={{ overflowX: "auto" }}>
                          <table className="admin-table">
                            <thead><tr><th>Lớp</th><th>Lịch học</th><th></th></tr></thead>
                            <tbody>
                              {bulkPreview.map((r, i) => (
                                <tr key={i}>
                                  <td>{r.name}</td>
                                  <td>{formatSchedule(r) || <span className="admin-muted-text">—</span>}</td>
                                  <td>{r.error && <span className="admin-error">{r.error}</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                  <div className="opening-form-actions">
                    {classError && <p className="admin-error">{classError}</p>}
                    <button type="button" className="admin-pill-btn" onClick={() => setClassForm(null)} disabled={savingClass}>Huỷ</button>
                    <button className="admin-btn-primary" type="submit" disabled={savingClass}>
                      {savingClass ? "Đang tạo..." : classForm.mode === "bulk" ? `Tạo ${bulkPreview.filter(r => !r.error).length} lớp` : "Tạo lớp"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {showForm && current && (
        <div className="confirm-overlay" role="presentation" onClick={() => !creating && setShowForm(false)}>
          <div className="opening-modal results-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            {!bulkResults ? (
              <>
                <h2>Thêm học sinh vào lớp {current.name}</h2>
                <p className="admin-muted-text">Tên đăng nhập tự sinh từ họ tên. Mỗi em phải đổi mật khẩu ngay lần đăng nhập đầu tiên.</p>
                <form className="admin-form student-create-form" onSubmit={handleBulkCreate}>
                  <label className="admin-mini-field">
                    <span>Dán mỗi dòng 1 em</span>
                    <textarea
                      className="admin-input admin-textarea"
                      rows={8}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder={"Nguyễn Văn An\nTrần Thị Bình\nLê Minh Châu"}
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
                  Đã tạo {okCount}/{bulkResults.length} tài khoản. Tải phiếu đăng nhập (PDF) ngay bây giờ — mật khẩu ban đầu chỉ hiện ở đây một lần.
                </p>
                <div style={{ overflowX: "auto", margin: "12px 0" }}>
                  <table className="admin-table">
                    <thead>
                      <tr><th>Tên</th><th>Tên đăng nhập</th><th>Kết quả</th><th></th></tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((r, i) => (
                        <tr key={i}>
                          <td>{r.displayName}</td>
                          <td><code className="student-username">{r.username}</code></td>
                          <td>{r.ok ? <span className="opening-chip opening-chip-on">Đã tạo</span> : <span className="admin-error">{r.error}</span>}</td>
                          <td>
                            {r.ok && (
                              <button type="button" className="opening-btn" disabled={!!downloading} onClick={() => handleDownloadCards([r], r.username)}>
                                {downloading === r.username ? "..." : "⬇ PDF"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="opening-form-actions">
                  {bulkError && <p className="admin-error">{bulkError}</p>}
                  <button type="button" className="opening-btn" disabled={!okCount || !!downloading} onClick={() => handleDownloadCards(bulkResults.filter(r => r.ok))}>
                    {downloading === "all" ? "Đang tạo PDF..." : "⬇ Tải phiếu cả lớp (1 file PDF)"}
                  </button>
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
