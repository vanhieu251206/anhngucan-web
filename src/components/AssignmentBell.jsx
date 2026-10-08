import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAssignments } from "../lib/useAssignments.js";
import { deadlineInfo, kindLabel, levelLabel, needsWork, openAssignment, reminderStage } from "../lib/assignmentUtils.js";
import { navigateApp } from "../lib/urlState.js";

// Chuông thông báo bài cần làm (học sinh, 2026-09-30): giáo viên mở bài cho lớp → chuông lắc + có số + thông báo nổi
// "Có bài mới"; bài CHƯA LÀM còn < 24 giờ → thông báo nổi "Sắp hết hạn", còn < 1 giờ → chuông lắc lại. Bấm chuông hiện
// danh sách bài còn hạn (hạn gần nhất lên đầu), bấm 1 bài là vào thẳng bài đó. Trang đầy đủ: MyWorkPage.jsx.
// Đã xem / đã nhắc lưu ở localStorage theo từng tài khoản (chỉ là tiện ích hiển thị, mất cũng không sao).
function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function statusOf(o, row) {
  if (!row) return null;
  if (o.maxAttempts && row.count >= o.maxAttempts) return { label: "Hết lượt", tone: "done", locked: true };
  if (row.count === 0) return { label: "Chưa làm", tone: "todo" };
  if (needsWork(o, row)) return { label: "Cô mở lại", tone: "todo" };
  return { label: o.maxAttempts ? `Đã làm ${row.count}/${o.maxAttempts}` : `Đã làm ${row.count} lần`, tone: "ok" };
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export default function AssignmentBell() {
  const { enabled, uid, active, info, now, refreshInfo } = useAssignments();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState([]);
  const [reminded, setReminded] = useState({});
  const [toastHidden, setToastHidden] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!uid) return;
    setSeen(readStore(`seenOpenings:${uid}`, []));
    setReminded(readStore(`remindedOpenings:${uid}`, {}));
  }, [uid]);

  const unseen = active.filter(o => !seen.includes(o.id));
  // Chỉ nhắc bài đã biết chắc là chưa làm (đã đọc xong số lượt).
  const reminders = active
    .filter(o => needsWork(o, info[o.id]))
    .map(o => ({ o, stage: reminderStage(o, now) }))
    .filter(({ o, stage }) => stage && reminded[o.id] !== stage && reminded[o.id] !== "1h");
  const alertKey = [...unseen.map(o => o.id), ...reminders.map(r => `${r.o.id}:${r.stage}`)].join(",");
  // Có bài mới / bài vừa bước sang mức nhắc mới → hiện lại thông báo nổi.
  useEffect(() => {
    setToastHidden(false);
  }, [alertKey]);

  function acknowledge() {
    if (!uid) return;
    const ids = active.map(o => o.id);
    const nextReminded = {};
    for (const o of active) {
      const stage = reminderStage(o, now);
      if (stage) nextReminded[o.id] = reminded[o.id] === "1h" ? "1h" : stage;
    }
    writeStore(`seenOpenings:${uid}`, ids);
    writeStore(`remindedOpenings:${uid}`, nextReminded);
    setSeen(ids);
    setReminded(nextReminded);
  }

  function openPanel() {
    setOpen(true);
    setToastHidden(true);
    acknowledge();
    refreshInfo();
  }

  // Bấm ra ngoài / Esc để đóng.
  useEffect(() => {
    if (!open) return;
    const onDown = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = e => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!enabled) return null;

  const todoCount = active.filter(o => needsWork(o, info[o.id] ?? { count: 0 })).length;
  const ringing = !open && (unseen.length > 0 || reminders.some(r => r.stage === "1h"));
  const showToast = !toastHidden && !open && (unseen.length > 0 || reminders.length > 0);

  let toast = null;
  if (showToast) {
    if (unseen.length) {
      toast = {
        title: unseen.length === 1 ? "Có bài mới cần làm" : `Có ${unseen.length} bài mới cần làm`,
        sub: `${unseen[0].testTitle || unseen[0].testId}${unseen.length > 1 ? "…" : ""}`,
        urgent: false,
      };
    } else {
      const first = reminders[0].o;
      toast = {
        title: reminders.length === 1 ? `Sắp hết hạn: ${first.testTitle || first.testId}` : `Có ${reminders.length} bài sắp hết hạn`,
        sub: `${deadlineInfo(first, now).left} · Hạn ${deadlineInfo(first, now).text}`,
        urgent: true,
      };
    }
  }

  return (
    <div className="assign-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`assign-bell${open ? " is-open" : ""}${ringing ? " is-ringing" : ""}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={todoCount ? `Bài cần làm (${todoCount})` : "Bài cần làm"}
        aria-expanded={open}
      >
        <BellIcon />
        {todoCount > 0 && <span className="assign-bell-badge">{todoCount > 9 ? "9+" : todoCount}</span>}
      </button>

      {open && (
        <div className="assign-panel" role="dialog" aria-label="Bài cần làm">
          <div className="assign-panel-head">Bài cần làm</div>
          {active.length === 0 ? (
            <p className="assign-empty">Hiện chưa có bài nào 🎉</p>
          ) : (
            <ul className="assign-list">
              {active.map(o => {
                const dl = deadlineInfo(o, now);
                const st = statusOf(o, info[o.id]);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`assign-item${st?.locked ? " is-locked" : ""}`}
                      disabled={st?.locked}
                      onClick={() => {
                        setOpen(false);
                        openAssignment(o);
                      }}
                    >
                      <span className="assign-item-top">
                        <span className="assign-item-title">{o.testTitle || o.testId}</span>
                        {st && <span className={`assign-chip is-${st.tone}`}>{st.label}</span>}
                      </span>
                      <span className="assign-item-meta">
                        {levelLabel(o)} · {kindLabel(o)}
                      </span>
                      <span className={`assign-item-deadline${dl.urgent ? " is-urgent" : ""}`}>
                        Hạn {dl.text}
                        {dl.left && <strong> · {dl.left}</strong>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            className="assign-panel-foot"
            onClick={() => {
              setOpen(false);
              navigateApp({ page: "my-work" });
            }}
          >
            Xem tất cả bài của con →
          </button>
        </div>
      )}

      {toast &&
        createPortal(
          <div className={`assign-toast${toast.urgent ? " is-urgent" : ""}`} role="status">
            <button type="button" className="assign-toast-body" onClick={openPanel}>
              <span className="assign-toast-icon"><BellIcon /></span>
              <span>
                <strong>{toast.title}</strong>
                <small>{toast.sub}</small>
              </span>
            </button>
            <button
              type="button"
              className="assign-toast-close"
              aria-label="Đóng thông báo"
              onClick={() => {
                setToastHidden(true);
                acknowledge();
              }}
            >
              ✕
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
