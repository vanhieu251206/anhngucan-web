import { useEffect, useMemo, useState } from "react";
import PasswordInput from "../../components/PasswordInput.jsx";
import { YLE_SERIES, KET_PET_GRADES, KET_PET_UNITS_PER_GRADE } from "../../lib/yleData.js";
import { loadLevelContent } from "../../lib/lessons.js";
import { listListeningExamTests } from "../../lib/adminLessons.js";
import { listStudents } from "../../lib/adminUsers.js";
import { OPENING_KINDS, listOpenings, createOpening, updateOpening, closeOpening, isExpired } from "../../lib/openings.js";
import { useAuth } from "../../lib/authContext.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";

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
  const { user } = useAuth();
  const confirm = useConfirm();
  const [classes, setClasses] = useState([]);
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

  const isKetPet = seriesId === "ket-pet";
  const series = YLE_SERIES.find(s => s.id === seriesId);
  const levelOptions = isKetPet ? KET_PET_GRADES : (series?.levels ?? []).map(l => l.number);
  const kinds = kindsFor(seriesId);

  function reload() {
    listOpenings().then(setOpenings).catch(e => setError(e.message));
  }
  useEffect(() => {
    reload();
    listStudents().then(list => {
      const cls = [...new Set(list.map(s => s.className).filter(Boolean))].sort();
      setClasses(cls);
      setClassName(c => c || cls[0] || "");
    });
  }, []);

  // Đổi bộ đề → đưa cấp/dạng bài về giá trị hợp lệ.
  useEffect(() => {
    setLevelNo(levelOptions[0]);
    setKind(kindsFor(seriesId)[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

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
          const content = await loadLevelContent(series, series.levels.find(l => l.number === levelNo));
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
            {classes.length === 0 && <p className="admin-hint">Chưa có lớp nào — tạo tài khoản học sinh (kèm lớp) trước.</p>}
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
              {YLE_SERIES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
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
            <label className="admin-mini-field">
              <span>Unit</span>
              <select className="admin-input" value={unit} onChange={e => setUnit(Number(e.target.value))}>
                {Array.from({ length: KET_PET_UNITS_PER_GRADE }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <label className="admin-mini-field">
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
            <span>Hạn chót (để trống = không hạn)</span>
            <input className="admin-input" type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
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

      <div className="admin-card">
        <div className="opening-list-head">
          <h2>Các bài đang mở</h2>
          <button className="admin-btn-primary" type="button" onClick={() => { setError(""); setShowForm(true); }}>+ Mở bài</button>
        </div>
        {openings === null && <p className="admin-muted-text">Đang tải...</p>}
        {openings && sorted.length === 0 && <p className="admin-muted-text">Chưa mở bài nào.</p>}
        {openings && sorted.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th>Lớp</th><th>Bài</th><th>Dạng</th><th>Hạn chót</th><th>Lượt</th><th>Phút</th><th>Mật khẩu</th><th></th></tr>
              </thead>
              <tbody>
                {sorted.map(o => (
                  editing?.id === o.id ? (
                    <tr key={o.id}>
                      <td>{o.className}</td>
                      <td>{o.testTitle}</td>
                      <td>{OPENING_KINDS[o.kind] ?? o.kind}</td>
                      <td><input className="admin-input" type="datetime-local" value={editing.expiresAt} onChange={e => setEditing({ ...editing, expiresAt: e.target.value })} /></td>
                      <td><input className="admin-input" type="number" min="1" value={editing.maxAttempts} onChange={e => setEditing({ ...editing, maxAttempts: e.target.value })} /></td>
                      <td><input className="admin-input" type="number" min="1" value={editing.minutes} onChange={e => setEditing({ ...editing, minutes: e.target.value })} /></td>
                      <td><input className="admin-input" placeholder="đổi mật khẩu (bỏ trống = giữ)" value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} /></td>
                      <td>
                        <button className="admin-link-btn" onClick={handleSaveEdit} disabled={saving}>Lưu</button>{" "}
                        <button className="admin-link-btn" onClick={() => setEditing(null)}>Huỷ</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={o.id}>
                      <td>{o.className}</td>
                      <td>{o.testTitle}</td>
                      <td>{OPENING_KINDS[o.kind] ?? o.kind}</td>
                      <td>{formatDate(o.expiresAt)}{isExpired(o) ? " ⛔ hết hạn" : ""}</td>
                      <td>{o.maxAttempts ?? "∞"}</td>
                      <td>{o.timeLimitMinutes ?? "—"}</td>
                      <td>{o.passwordHash ? "🔒 Có" : "Không"}</td>
                      <td>
                        <button className="admin-link-btn" onClick={() => setEditing({ id: o.id, expiresAt: toLocalInput(o.expiresAt?.toDate?.()), maxAttempts: o.maxAttempts ?? "", minutes: o.timeLimitMinutes ?? "", password: "" })}>Sửa</button>{" "}
                        <button className="admin-link-btn" onClick={() => handleClose(o)}>Đóng</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
