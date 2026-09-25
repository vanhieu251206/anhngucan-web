import { useEffect, useMemo, useState } from "react";
import PasswordInput from "../../components/PasswordInput.jsx";
import { YLE_SERIES, KET_PET_GRADES, KET_PET_UNITS_PER_GRADE, KIDS_GRADES } from "../../lib/yleData.js";
import { loadLevelContent } from "../../lib/lessons.js";
import { listListeningExamTests } from "../../lib/adminLessons.js";
import { listClassNames, listClassDocs, bookAllowsLevel } from "../../lib/classes.js";
import { OPENING_KINDS, listOpenings, createOpening, updateOpening, closeOpening, isExpired, openingNeedsPassword } from "../../lib/openings.js";
import { useAuth } from "../../lib/authContext.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { listResultsForOpening } from "../../lib/testResults.js";
import { downloadClassResultSheets, canDownloadSheets } from "../../lib/resultSheetPdf.js";

// Dạng bài mở được theo từng bộ đề.
function kindsFor(seriesId) {
  if (seriesId === "ket-pet") return ["ketpet-vocab", "ketpet-test"];
  if (seriesId === "ielts") return ["ielts-reading", "ielts-listening", "dictation"];
  return ["speaking", "reading", "dictation", "listening-exam"];
}

function toLocalInput(date) {
  if (!date) return "";
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString("vi-VN") : "Không hạn";
}

// Trang giáo viên: MỞ BÀI cho lớp (mặc định mọi bài khoá). Mỗi lần mở có mật khẩu vào bài, hạn chót, số lượt,
// số phút — sửa lại bất cứ lúc nào (vd cấp thêm lượt lần 2, 3 = tăng "Số lượt"). Xem lib/openings.js.
export default function OpeningsPage() {
  const { user, isTeacher, profile } = useAuth();
  // Giáo viên bị giới hạn (restricted, vd dạy ngắn hạn) chỉ mở/xem bài cho đúng lớp trong
  // allowedClasses — chặn thật ở firestore.rules `canManageClass()`, đây chỉ là lọc UI (2026-09-22).
  const isRestricted = isTeacher && !!profile?.restricted;
  const allowedClassSet = isRestricted ? new Set(profile?.allowedClasses ?? []) : null;
  const confirm = useConfirm();
  const [classes, setClasses] = useState([]);
  const [classBooks, setClassBooks] = useState({}); // tên lớp -> sách được gán (lib/classes.js)
  const [openings, setOpenings] = useState(null);
  const [error, setError] = useState("");

  const [className, setClassName] = useState("");
  const [seriesId, setSeriesId] = useState("starters");
  const [levelNo, setLevelNo] = useState(1);
  const [kind, setKind] = useState("speaking");
  const [unit, setUnit] = useState(1);
  const [testChoice, setTestChoice] = useState("");
  const [choices, setChoices] = useState([]); // [{ id, title }]
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // { id, ...fields }
  const [showForm, setShowForm] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const isKetPet = seriesId === "ket-pet";
  const series = YLE_SERIES.find(s => s.id === seriesId);
  // Chỉ cho mở bài thuộc SÁCH của lớp (2026-09-25) — mở bài ngoài sách thì học sinh thấy xám, không vào được.
  // Lớp chưa gán sách: vẫn chọn tự do nhưng hiện cảnh báo.
  const book = classBooks[className] ?? null;
  const seriesChoices = book ? YLE_SERIES.filter(s => s.id === book.seriesId) : YLE_SERIES;
  // Kids chia Grade 1-5 (KIDS_GRADES), khác 4 cấp mặc định của buildSeries.
  const baseLevels = isKetPet ? KET_PET_GRADES : seriesId === "kids" ? KIDS_GRADES : (series?.levels ?? []).map(l => l.number);
  const levelOptions = book?.seriesId === seriesId ? baseLevels.filter(n => bookAllowsLevel(book, seriesId, n)) : baseLevels;
  const levelKey = levelOptions.join(",");
  const kinds = kindsFor(seriesId);

  function reload() {
    listOpenings()
      .then(list => setOpenings(allowedClassSet ? list.filter(o => allowedClassSet.has(o.className)) : list))
      .catch(e => setError(e.message));
  }
  useEffect(() => {
    reload();
    listClassDocs()
      .then(docs => setClassBooks(Object.fromEntries(docs.map(c => [c.name, c.book ?? null]))))
      .catch(() => {});
    listClassNames().then(list => {
      let cls = list;
      if (allowedClassSet) cls = cls.filter(c => allowedClassSet.has(c));
      setClasses(cls);
      setClassName(c => c || cls[0] || "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đổi lớp → nhảy về đúng bộ đề của sách lớp đó.
  useEffect(() => {
    if (book && book.seriesId !== seriesId) setSeriesId(book.seriesId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, book?.seriesId]);

  // Đổi bộ đề → đưa dạng bài về giá trị hợp lệ.
  useEffect(() => {
    setKind(kindsFor(seriesId)[0]);
  }, [seriesId]);

  // Cấp đang chọn không còn hợp lệ (đổi bộ đề / đổi lớp có sách khác) → về cấp đầu tiên được phép.
  useEffect(() => {
    if (!levelOptions.includes(levelNo)) setLevelNo(levelOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, levelKey]);

  // Nạp danh sách bài chọn được theo bộ đề/cấp/dạng.
  useEffect(() => {
    let cancelled = false;
    setTestChoice("");
    if (isKetPet) {
      const list =
        kind === "ketpet-vocab"
          ? [{ id: `unit${unit}`, title: `Grade ${levelNo} – Unit ${unit} – Vocabulary` }]
          : [1, 2, 3, 4].map(n => ({ id: `unit${unit}-test${n}`, title: `Grade ${levelNo} – Unit ${unit} – Practice Test ${n}` }));
      setChoices(list);
      setTestChoice(list[0].id);
      return;
    }
    (async () => {
      let list = [];
      try {
        if (kind === "listening-exam") {
          list = (await listListeningExamTests(seriesId, levelNo)).map(t => ({ id: t.id, title: t.title ?? t.id }));
        } else {
          const levelObj = series.levels.find(l => l.number === levelNo);
          // Kids Grade 5 chưa có cấp tương ứng trong dữ liệu bài học → chưa có bài để mở.
          const content = levelObj ? await loadLevelContent(series, levelObj) : {};
          const src = { speaking: content.tests, reading: content.readingTests, dictation: content.dictationTests, "ielts-reading": content.practiceTests, "ielts-listening": content.ieltsListeningTests }[kind] ?? [];
          list = src.map(t => ({ id: t.id, title: t.title ?? t.id }));
        }
      } catch (e) {
        setError(e.message);
      }
      if (!cancelled) {
        setChoices(list);
        setTestChoice(list[0]?.id ?? "");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, levelNo, kind, unit]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    const test = choices.find(c => c.id === testChoice);
    if (!className || !test) return setError("Chọn lớp và bài cần mở.");
    // Bắt buộc có hạn chót: kết quả bài làm chỉ giữ tới 48h sau hạn chót rồi bị xoá (lib/testResults.js).
    if (!expiresAt) return setError("Chọn hạn chót cho bài.");
    setSaving(true);
    try {
      await createOpening(
        {
          className, seriesId, level: levelNo, kind, testId: test.id, testTitle: test.title,
          password: password.trim(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          maxAttempts: maxAttempts ? Number(maxAttempts) : null,
          timeLimitMinutes: minutes ? Number(minutes) : null,
        },
        user.uid
      );
      setPassword("");
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    setError("");
    if (!editing.expiresAt) return setError("Chọn hạn chót cho bài.");
    setSaving(true);
    try {
      await updateOpening(editing.id, {
        expiresAt: editing.expiresAt ? new Date(editing.expiresAt) : null,
        maxAttempts: editing.maxAttempts ? Number(editing.maxAttempts) : null,
        timeLimitMinutes: editing.minutes ? Number(editing.minutes) : null,
        password: editing.password?.trim() || "",
      });
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  // Phiếu chấm bài cả lớp (1 PDF: bảng điểm + mỗi lượt nộp 1 phiếu) — chỉ sau hạn chót, trong 48h trước khi kết quả bị xoá.
  async function handleSheets(o) {
    setError("");
    setDownloadingId(o.id);
    try {
      const results = await listResultsForOpening(o.id);
      await downloadClassResultSheets({ results, className: o.className, title: o.testTitle, deadline: o.expiresAt?.toDate?.() });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleClose(o) {
    if (!(await confirm(`Đóng "${o.testTitle}" của lớp ${o.className}? Học sinh sẽ không vào được nữa.`, { danger: true }))) return;
    await closeOpening(o.id);
    reload();
  }

  const sorted = useMemo(() => [...(openings ?? [])].sort((a, b) => (a.className || "").localeCompare(b.className || "")), [openings]);

  return (
    <div>
      {showForm && (
        <div className="confirm-overlay" role="presentation" onClick={() => setShowForm(false)}>
          <div className="opening-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2>Mở bài cho lớp</h2>
            <p className="admin-muted-text">Mặc định mọi bài đều khoá. Mở bài nào thì học sinh của lớp đó mới vào làm được.</p>
            {classes.length === 0 && <p className="admin-hint">Chưa có lớp nào — tạo lớp ở mục "Quản lý học sinh" trước.</p>}
            {className && !book && <p className="admin-hint">Lớp {className} chưa gán sách — học sinh chưa vào được bài nào.</p>}
        <form className="admin-form opening-form-grid" onSubmit={handleCreate}>
          <label className="admin-mini-field">
            <span>Lớp</span>
            <select className="admin-input" value={className} onChange={e => setClassName(e.target.value)}>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="admin-mini-field">
            <span>Bộ đề</span>
            <select className="admin-input" value={seriesId} onChange={e => setSeriesId(e.target.value)}>
              {seriesChoices.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <label className="admin-mini-field">
            <span>{isKetPet ? "Grade" : "Cấp"}</span>
            <select className="admin-input" value={levelNo} onChange={e => setLevelNo(Number(e.target.value))}>
              {levelOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="admin-mini-field">
            <span>Dạng bài</span>
            <select className="admin-input" value={kind} onChange={e => setKind(e.target.value)}>
              {kinds.map(k => <option key={k} value={k}>{OPENING_KINDS[k]}</option>)}
            </select>
          </label>
          {isKetPet && (
            <label className="admin-mini-field opening-span-2">
              <span>Unit</span>
              <select className="admin-input" value={unit} onChange={e => setUnit(Number(e.target.value))}>
                {Array.from({ length: KET_PET_UNITS_PER_GRADE }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <label className="admin-mini-field opening-span-2">
            <span>Bài</span>
            <select className="admin-input" value={testChoice} onChange={e => setTestChoice(e.target.value)}>
              {choices.length === 0 && <option value="">(chưa có bài)</option>}
              {choices.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="admin-mini-field">
            <span>Mật khẩu vào bài (để trống = không cần)</span>
            <PasswordInput className="admin-input" value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          <label className="admin-mini-field">
            <span>Hạn chót</span>
            <input className="admin-input" type="datetime-local" required value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </label>
          <label className="admin-mini-field">
            <span>Số lượt làm tối đa (để trống = không giới hạn)</span>
            <input className="admin-input" type="number" min="1" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} />
          </label>
          <label className="admin-mini-field">
            <span>Thời gian làm bài (phút, để trống = theo bài / không giới hạn)</span>
            <input className="admin-input" type="number" min="1" value={minutes} onChange={e => setMinutes(e.target.value)} />
          </label>
          <div className="opening-form-actions">
            {error && <p className="admin-error">{error}</p>}
            <button type="button" className="admin-pill-btn" onClick={() => setShowForm(false)}>Huỷ</button>
            <button className="admin-btn-primary" type="submit" disabled={saving || !testChoice}>{saving ? "Đang mở..." : "Mở bài"}</button>
          </div>
        </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="confirm-overlay" role="presentation" onClick={() => setEditing(null)}>
          <div className="opening-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2>Sửa bài đang mở</h2>
            <p className="admin-muted-text">Lớp {editing.className} · {editing.testTitle} · {OPENING_KINDS[editing.kind] ?? editing.kind}</p>
            <form className="admin-form opening-form-grid" onSubmit={e => { e.preventDefault(); handleSaveEdit(); }}>
              <label className="admin-mini-field">
                <span>Hạn chót</span>
                <input className="admin-input" type="datetime-local" required value={editing.expiresAt} onChange={e => setEditing({ ...editing, expiresAt: e.target.value })} />
              </label>
              <label className="admin-mini-field">
                <span>Số lượt làm tối đa (để trống = không giới hạn)</span>
                <input className="admin-input" type="number" min="1" value={editing.maxAttempts} onChange={e => setEditing({ ...editing, maxAttempts: e.target.value })} />
              </label>
              <label className="admin-mini-field">
                <span>Thời gian làm bài (phút)</span>
                <input className="admin-input" type="number" min="1" value={editing.minutes} onChange={e => setEditing({ ...editing, minutes: e.target.value })} />
              </label>
              <label className="admin-mini-field">
                <span>{editing.hasPassword ? "Đổi mật khẩu (để trống = giữ nguyên)" : "Đặt mật khẩu vào bài (để trống = không cần)"}</span>
                <PasswordInput className="admin-input" value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} />
              </label>
              <div className="opening-form-actions">
                {error && <p className="admin-error">{error}</p>}
                <button type="button" className="admin-pill-btn" onClick={() => setEditing(null)}>Huỷ</button>
                <button className="admin-btn-primary" type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-card">
        <div className="opening-list-head">
          <h2>Các bài đang mở</h2>
          <button className="admin-btn-primary" type="button" onClick={() => { setError(""); setShowForm(true); }}>+ Mở bài</button>
        </div>
        {error && !showForm && !editing && <p className="admin-error">{error}</p>}
        {openings === null && <p className="admin-muted-text">Đang tải...</p>}
        {openings && sorted.length === 0 && <p className="admin-muted-text">Chưa mở bài nào.</p>}
        {openings && sorted.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table opening-table">
              <thead>
                <tr><th>Lớp</th><th>Bài</th><th>Hạn chót</th><th>Lượt</th><th>Phút</th><th>Mật khẩu</th><th>Trạng thái</th><th></th></tr>
              </thead>
              <tbody>
                {sorted.map(o => (
                  <tr key={o.id}>
                    <td><span className="opening-chip opening-chip-class">{o.className}</span></td>
                    <td>
                      <div className="opening-test-title">{o.testTitle}</div>
                      <div className="opening-test-kind">{OPENING_KINDS[o.kind] ?? o.kind}</div>
                    </td>
                    <td>{o.expiresAt?.toDate ? o.expiresAt.toDate().toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Không hạn"}</td>
                    <td>{o.maxAttempts ?? "∞"}</td>
                    <td>{o.timeLimitMinutes ?? "—"}</td>
                    <td>{openingNeedsPassword(o) ? "🔒 Có" : "—"}</td>
                    <td>{isExpired(o) ? <span className="opening-chip opening-chip-off">Hết hạn</span> : <span className="opening-chip opening-chip-on">Đang mở</span>}</td>
                    <td>
                      <div className="opening-actions">
                        {canDownloadSheets(o.expiresAt?.toMillis?.()) && (
                          <button className="opening-btn" disabled={!!downloadingId} onClick={() => handleSheets(o)}>
                            {downloadingId === o.id ? "Đang tạo PDF..." : "⬇ Phiếu chấm"}
                          </button>
                        )}
                        <button className="opening-btn" onClick={() => setEditing({ id: o.id, className: o.className, testTitle: o.testTitle, kind: o.kind, hasPassword: openingNeedsPassword(o), expiresAt: toLocalInput(o.expiresAt?.toDate?.()), maxAttempts: o.maxAttempts ?? "", minutes: o.timeLimitMinutes ?? "", password: "" })}>✏️ Sửa</button>
                        <button className="opening-btn opening-btn-danger" onClick={() => handleClose(o)}>🗑 Đóng bài</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
