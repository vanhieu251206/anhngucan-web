import { useEffect, useMemo, useState } from "react";
import { listStudents } from "../../lib/adminUsers.js";
import { OPENING_KINDS, cancelReopen, listAttemptsForOpening, reopenForStudents } from "../../lib/openings.js";
import { useAuth } from "../../lib/authContext.jsx";

function toLocalInput(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

const fmtShort = ts => ts?.toDate?.().toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) ?? "";

// MỞ LẠI 1 bài đã hết hạn cho CÁC EM ĐƯỢC CHỌN (2026-10-09, lib/openings.js → extensions): hạn của lớp giữ nguyên,
// chỉ các em được tick có hạn riêng + thêm lượt. Nút chọn nhanh: em chưa làm / em vào lớp sau hạn / em điểm thấp.
// Dùng ở trang Mở bài và ở "Kết quả học sinh → Xem chưa nộp" (preselect = các em chưa nộp).
export default function ReopenDialog({ opening, preselect, onClose, onSaved }) {
  const { user } = useAuth();
  const [students, setStudents] = useState(null);
  const [attempts, setAttempts] = useState(new Map());
  const [manual, setManual] = useState(() => Object.fromEntries((preselect ?? []).map(uid => [uid, true]))); // uid → tick tay (true/false)
  const [expiresAt, setExpiresAt] = useState("");
  const [extra, setExtra] = useState("1");
  const [lowPct, setLowPct] = useState("50");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  const classDeadline = opening.expiresAt?.toMillis?.() ?? 0;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listStudents({ className: opening.className }), listAttemptsForOpening(opening)])
      .then(([list, map]) => {
        if (cancelled) return;
        setStudents(list.filter(s => !s.disabled).sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? "", "vi")));
        setAttempts(map);
      })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [opening]);

  const rows = useMemo(() => (students ?? []).map(s => {
    const a = attempts.get(s.uid);
    const count = a?.count ?? 0;
    const pct = count > 0 && a.total > 0 && a.bestCorrect != null ? Math.round((a.bestCorrect / a.total) * 100) : null;
    const ext = opening.extensions?.[s.uid];
    return {
      uid: s.uid,
      name: s.displayName || s.username || "—",
      count,
      pct,
      score: pct == null ? null : `${a.bestCorrect}/${a.total}`,
      joinedLate: count === 0 && (s.createdAt?.toMillis?.() ?? 0) > classDeadline,
      reopenedUntil: (ext?.expiresAt?.toMillis?.() ?? 0) > now ? ext.expiresAt : null,
    };
  }), [students, attempts, opening, classDeadline, now]);

  // Chọn nhanh BẬT ĐƯỢC NHIỀU NÚT cùng lúc (gộp lại: em chưa làm + em điểm thấp...). Em được tick = thuộc 1 trong
  // các nút đang bật, rồi áp thêm các lần tick/bỏ tick tay (`manual`). Đổi ngưỡng % là danh sách đổi theo ngay.
  const [modes, setModes] = useState(() => new Set());
  const QUICK = {
    todo: r => r.count === 0,
    late: r => r.joinedLate,
    low: r => r.pct != null && r.pct < (Number(lowPct) || 0),
    all: () => true,
  };
  const picked = useMemo(() => {
    const set = new Set(rows.filter(r => [...modes].some(k => QUICK[k](r))).map(r => r.uid));
    Object.entries(manual).forEach(([uid, on]) => (on ? set.add(uid) : set.delete(uid)));
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, modes, manual, lowPct]);
  function quick(key, on) {
    setModes(prev => {
      const next = new Set(prev);
      if (on ?? !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });
    // Bấm 1 nút chọn nhanh thì bỏ các lần BỎ TICK tay (để nút có tác dụng với mọi em), giữ các em tick tay thêm.
    setManual(prev => Object.fromEntries(Object.entries(prev).filter(([, v]) => v)));
  }
  function clearAll() {
    setModes(new Set());
    setManual({});
  }
  const quickClass = key => `opening-btn${modes.has(key) ? " is-active" : ""}`;
  const toggle = uid => setManual(prev => ({ ...prev, [uid]: !picked.has(uid) }));
  const chosen = rows.filter(r => picked.has(r.uid));
  const revocable = chosen.filter(r => r.reopenedUntil);

  async function run(action) {
    setError("");
    setSaving(true);
    try {
      await action();
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
      setSaving(false);
    }
  }

  function handleSave(e) {
    e.preventDefault();
    if (!chosen.length) return setError("Chọn ít nhất 1 em.");
    const date = expiresAt ? new Date(expiresAt) : null;
    if (!date || date.getTime() <= Date.now()) return setError("Hạn mới phải sau thời điểm hiện tại.");
    run(() => reopenForStudents(opening, chosen.map(r => r.uid), { expiresAt: date, extraAttempts: opening.maxAttempts ? extra : 0 }, user?.uid));
  }

  return (
    <div className="confirm-overlay" role="presentation" onClick={onClose}>
      <div className="opening-modal reopen-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h2>Mở lại bài</h2>
        <p className="admin-muted-text">
          Lớp {opening.className} · {opening.testTitle} · {OPENING_KINDS[opening.kind] ?? opening.kind} · hạn của lớp {fmtShort(opening.expiresAt)}
        </p>

        {students === null && !error && <p className="admin-muted-text">Đang tải...</p>}
        {students && (
          <form className="admin-form" onSubmit={handleSave}>
            <div className="reopen-quick">
              <span className="reopen-quick-label">Chọn nhanh:</span>
              <button type="button" className={quickClass("todo")} onClick={() => quick("todo")}>Chưa làm</button>
              <button type="button" className={quickClass("late")} onClick={() => quick("late")}>Vào lớp sau hạn</button>
              <span className="reopen-low">
                <button type="button" className={quickClass("low")} onClick={() => quick("low")}>Điểm dưới</button>
                <input className="admin-input" type="number" min="0" max="100" value={lowPct} onFocus={() => quick("low", true)} onChange={e => setLowPct(e.target.value)} aria-label="Ngưỡng điểm (%)" />%
              </span>
              <button type="button" className={quickClass("all")} onClick={() => quick("all")}>Cả lớp</button>
              <button type="button" className="opening-btn" onClick={clearAll}>Bỏ chọn</button>
              <span className="reopen-picked">Đã chọn {chosen.length}/{rows.length} em</span>
            </div>

            <div className="reopen-list">
              {rows.map(r => (
                <label key={r.uid} className={`reopen-row${picked.has(r.uid) ? " is-picked" : ""}`}>
                  <input type="checkbox" checked={picked.has(r.uid)} onChange={() => toggle(r.uid)} />
                  <span className="reopen-name">{r.name}</span>
                  {r.count === 0
                    ? <span className="opening-chip opening-chip-off">{r.joinedLate ? "Vào lớp sau" : "Chưa làm"}</span>
                    : <span className={`opening-chip ${r.pct != null && r.pct < 50 ? "opening-chip-wait" : "opening-chip-on"}`}>{r.score ? `${r.score} · ${r.pct}%` : "Đã nộp"} · {r.count} lượt</span>}
                  {r.reopenedUntil && <span className="opening-chip opening-chip-class">Đang mở lại tới {fmtShort(r.reopenedUntil)}</span>}
                </label>
              ))}
              {rows.length === 0 && <p className="admin-muted-text">Lớp chưa có học sinh.</p>}
            </div>

            <div className="reopen-bottom">
              <label className="admin-mini-field">
                <span>Hạn mới cho các em được chọn</span>
                <input className="admin-input" type="datetime-local" required min={toLocalInput(new Date())} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </label>
              {opening.maxAttempts ? (
                <label className="admin-mini-field is-small">
                  <span>Thêm lượt (lớp: {opening.maxAttempts})</span>
                  <input className="admin-input" type="number" min="0" value={extra} onChange={e => setExtra(e.target.value)} />
                </label>
              ) : null}
              <p className="reopen-note">⚠ Các em đã nộp đang xem được đáp án.</p>
            </div>

            <div className="opening-form-actions">
              {error && <p className="admin-error">{error}</p>}
              {revocable.length > 0 && (
                <button type="button" className="opening-btn opening-btn-danger" disabled={saving} onClick={() => run(() => cancelReopen(opening, revocable.map(r => r.uid)))}>
                  Thu hồi mở lại ({revocable.length})
                </button>
              )}
              <button type="button" className="admin-pill-btn" onClick={onClose}>Huỷ</button>
              <button className="admin-btn-primary" type="submit" disabled={saving}>{saving ? "Đang lưu..." : `Mở lại cho ${chosen.length} em`}</button>
            </div>
          </form>
        )}
        {students === null && error && <p className="admin-error">{error}</p>}
      </div>
    </div>
  );
}
