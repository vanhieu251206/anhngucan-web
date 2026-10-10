import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/authContext.jsx";
import { migrateAnswerKeys } from "../../lib/answerMigration.js";
import { exportAudio, importAudio, canRecompressAudio } from "../../lib/audioRecompress.js";
import { listClassDocs, bookKeys, formatBook } from "../../lib/classes.js";
import { listStudents } from "../../lib/adminUsers.js";
import { listOpenings, isExpired, attemptKey } from "../../lib/openings.js";
import { listSubmittedUids } from "../../lib/attempts.js";
import { listResultsForOpening, RESULT_KEEP_MS } from "../../lib/testResults.js";
import { downloadClassResultSheets, canDownloadSheets } from "../../lib/resultSheetPdf.js";
import { listBillsForMonth } from "../../lib/tuitionStore.js";
import { hasBill, totalFor, fmtMoney, currentMonth, monthLabel } from "../../lib/tuition.js";
import { deadlineInfo, kindLabel, timeLeft } from "../../lib/assignmentUtils.js";

// Chỉ admin: tải mọi audio đã lên Cloudinary về máy theo số 0001..N, nén ngoài web, rồi tải bản nén lên + thay link
// trong bài (lib/audioRecompress.js).
function AudioRecompressCard() {
  const [state, setState] = useState(null); // null | { running, stage, message, error }

  async function run(fn, describe) {
    setState({ running: true, stage: "Chọn thư mục..." });
    try {
      const stats = await fn(p => setState({ running: true, stage: p.stage }));
      setState({ running: false, message: describe(stats) });
    } catch (error) {
      // Bấm Huỷ ở hộp chọn thư mục thì không báo lỗi.
      setState(error?.name === "AbortError" ? null : { running: false, error: error.message });
    }
  }

  if (!canRecompressAudio()) return null;
  return (
    <div className="admin-card">
      <h2>Nén lại audio cũ</h2>
      <div className="kids-book-actions">
        <button
          type="button"
          className="admin-btn-primary"
          disabled={state?.running}
          onClick={() => run(exportAudio, s => `Có ${s.total} audio · Vừa tải về ${s.downloaded}${s.failed ? ` · Lỗi ${s.failed}` : ""}`)}
        >
          1. Tải tất cả về máy
        </button>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={state?.running}
          onClick={() => run(importAudio, s => `Đã thay ${s.replaced} audio trong ${s.docs} bài · Bỏ qua ${s.skipped}${s.failed ? ` · Lỗi ${s.failed}` : ""}`)}
        >
          2. Tải bản nén lên
        </button>
      </div>
      {state?.running && <p className="admin-muted-text">{state.stage}</p>}
      {state?.message && <p className="admin-muted-text">{state.message}</p>}
      {state?.error && <p className="admin-error">{state.error}</p>}
    </div>
  );
}

// Chỉ admin: chuyển 1 lần các đề soạn trước 2026-09-25 sang dạng tách đáp án (lib/answerMigration.js).
function AnswerMigrationCard() {
  const [state, setState] = useState(null); // null | { running, stats, error }

  async function run() {
    setState({ running: true, stats: { migrated: 0, skipped: 0, failed: 0 } });
    try {
      const stats = await migrateAnswerKeys(s => setState({ running: true, stats: s }));
      setState({ running: false, stats });
    } catch (error) {
      setState(prev => ({ running: false, stats: prev?.stats, error }));
    }
  }

  const s = state?.stats;
  return (
    <div className="admin-card">
      <h2>Tách đáp án bài cũ</h2>
      <button type="button" className="admin-btn-primary" onClick={run} disabled={state?.running}>
        {state?.running ? "Đang chuyển..." : "Chạy"}
      </button>
      {s && (
        <p className="admin-muted-text">
          Đã chuyển {s.migrated} · Đã có sẵn {s.skipped}{s.failed ? ` · Lỗi ${s.failed}` : ""}
          {state.error ? " · Dừng giữa chừng (mất mạng?) — bấm Chạy lại" : ""}
        </p>
      )}
    </div>
  );
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const pad = n => String(n).padStart(2, "0");
const studentName = s => s.displayName || s.username || "";

// Ngày dạy gần nhất có lớp học (hôm nay trước, không có thì ngày kế tiếp) theo lịch `days` của lớp (2..7, 8 = CN).
function nextTeachingDay(classDocs, now) {
  for (let k = 0; k < 7; k++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    const day = date.getDay() === 0 ? 8 : date.getDay() + 1;
    const list = classDocs.filter(c => (c.days ?? []).includes(day)).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    if (list.length) return { date, offset: k, list };
  }
  return null;
}

// Tổng quan (2026-10-03, chỉ admin + giáo viên chính — DashboardPage.jsx chặn): các con số chính, việc cần xử lý,
// bài đang mở + tiến độ nộp, lịch dạy, học phí tháng này. Chỉ đọc; mỗi lần vào mục này nạp lại 1 lượt.
export default function OverviewPage({ onGo }) {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const month = currentMonth();
  // Admin quản học sinh trong "Quản lý tài khoản", giáo viên chính ở "Quản lý học sinh".
  const go = key => onGo(key === "students" && isAdmin ? "accounts" : key);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [classDocs, students, openings, bills] = await Promise.all([
          listClassDocs(), listStudents(), listOpenings(), listBillsForMonth(month).catch(() => ({})),
        ]);
        const live = openings.filter(o => !isExpired(o));
        const submitted = await listSubmittedUids(live.map(o => attemptKey(o.testId, o.id))).catch(() => new Map());
        if (!cancelled) setData({ classDocs, students, openings, bills, submitted, now: Date.now() });
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [month]);

  const view = useMemo(() => {
    if (!data) return null;
    const { classDocs, students, openings, bills, submitted, now } = data;
    const docs = Object.fromEntries(classDocs.map(c => [c.name, c]));
    const roster = name => students.filter(s => s.className === name);
    const classNames = [...new Set([...classDocs.map(c => c.name), ...students.map(s => s.className).filter(Boolean)])].sort((a, b) => a.localeCompare(b));

    const liveRows = openings
      .filter(o => !isExpired(o))
      .sort((a, b) => (a.expiresAt?.toMillis?.() ?? Infinity) - (b.expiresAt?.toMillis?.() ?? Infinity))
      .map(o => {
        // Em bị khoá tài khoản không vào làm được nên không tính vào sĩ số cần nộp.
        const list = roster(o.className).filter(s => !s.disabled);
        const done = submitted.get(attemptKey(o.testId, o.id)) ?? new Set();
        const missing = list.filter(s => !done.has(s.uid)).map(studentName).sort((a, b) => a.localeCompare(b, "vi"));
        return { o, total: list.length, done: list.length - missing.length, missing, info: deadlineInfo(o, now) };
      });

    const tuitionRows = classNames.filter(name => roster(name).length > 0).map(name => {
      const bill = bills[name];
      const billed = (bill?.students ?? []).filter(s => hasBill(bill.items, s.uid));
      return { name, bill, billCount: billed.length, total: billed.reduce((sum, s) => sum + totalFor(bill.items, s.uid), 0) };
    });

    return {
      now,
      docs,
      roster,
      classCount: classNames.length,
      studentCount: students.length,
      lockedCount: students.filter(s => s.disabled).length,
      liveRows,
      noBook: classNames.filter(name => !bookKeys(docs[name]?.book).length),
      late: liveRows.filter(r => r.info.urgent && r.missing.length > 0),
      sheets: openings
        .filter(o => canDownloadSheets(o.expiresAt?.toMillis?.(), now))
        .sort((a, b) => a.expiresAt.toMillis() - b.expiresAt.toMillis()),
      schedule: nextTeachingDay(classDocs, new Date(now)),
      tuitionRows,
    };
  }, [data]);

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

  if (!view) {
    return (
      <>
        <div className="admin-card">
          {error ? <p className="admin-error">{error}</p> : <div className="admin-loading-row"><span className="admin-spinner" />Đang tải...</div>}
        </div>
        {isAdmin && <AnswerMigrationCard />}
        {isAdmin && <AudioRecompressCard />}
      </>
    );
  }

  const { now, docs, roster, liveRows, noBook, late, sheets, schedule, tuitionRows } = view;
  const hasAlerts = noBook.length > 0 || late.length > 0 || sheets.length > 0;
  const scheduleTitle = !schedule || schedule.offset === 0
    ? "Lịch dạy hôm nay"
    : schedule.offset === 1
      ? "Lịch dạy ngày mai"
      : `Buổi dạy sắp tới · ${WEEKDAYS[schedule.date.getDay()]} ${pad(schedule.date.getDate())}/${pad(schedule.date.getMonth() + 1)}`;
  const billedCount = tuitionRows.filter(r => r.bill).length;

  return (
    <div className="overview">
      <div className="overview-stats">
        <button type="button" className="overview-stat" onClick={() => go("students")}><span>{view.classCount}</span><small>Lớp</small></button>
        <button type="button" className="overview-stat" onClick={() => go("students")}><span>{view.studentCount}</span><small>Học sinh</small></button>
        <button type="button" className="overview-stat" onClick={() => go("openings")}><span>{liveRows.length}</span><small>Bài đang mở</small></button>
        <button type="button" className={`overview-stat${view.lockedCount ? " is-warn" : ""}`} onClick={() => go("students")}><span>{view.lockedCount}</span><small>Tài khoản bị khoá</small></button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {hasAlerts && (
        <div className="admin-card">
          <h2>Cần xử lý</h2>
          <ul className="overview-alerts">
            {late.map(r => (
              <li key={`late-${r.o.id}`} className="is-urgent">
                <div>
                  <strong>{r.missing.length} em chưa nộp · {r.info.left}</strong>
                  <p>Lớp {r.o.className} · {r.o.testTitle}</p>
                  <p className="admin-muted-text">{r.missing.join(", ")}</p>
                </div>
              </li>
            ))}
            {sheets.map(o => (
              <li key={`sheet-${o.id}`}>
                <div>
                  <strong>Phiếu chấm sắp bị xoá · {timeLeft(o.expiresAt.toMillis() + RESULT_KEEP_MS - now)}</strong>
                  <p>Lớp {o.className} · {o.testTitle}</p>
                </div>
                <button type="button" className="opening-btn" disabled={!!downloadingId} onClick={() => handleSheets(o)}>
                  {downloadingId === o.id ? "Đang tạo PDF..." : "⬇ Phiếu chấm"}
                </button>
              </li>
            ))}
            {noBook.length > 0 && (
              <li>
                <div>
                  <strong>{noBook.length} lớp chưa gán sách</strong>
                  <p className="admin-muted-text">{noBook.join(", ")}</p>
                </div>
                <button type="button" className="opening-btn" onClick={() => go("students")}>Gán sách</button>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="admin-card">
        <div className="opening-list-head">
          <h2>Bài đang mở</h2>
          <button type="button" className="admin-link-btn" onClick={() => go("openings")}>Mở bài →</button>
        </div>
        {liveRows.length === 0 ? <p className="admin-muted-text">Chưa mở bài nào.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table opening-table">
              <thead>
                <tr><th>Lớp</th><th>Bài</th><th>Hạn chót</th><th>Đã nộp</th></tr>
              </thead>
              <tbody>
                {liveRows.map(({ o, total, done, info }) => (
                  <tr key={o.id}>
                    <td><span className="opening-chip opening-chip-class">{o.className}</span></td>
                    <td>
                      <div className="opening-test-title">{o.testTitle}</div>
                      <div className="opening-test-kind">{kindLabel(o)}</div>
                    </td>
                    <td>
                      <div>{info.text}</div>
                      {info.left && <span className={`opening-chip ${info.urgent ? "opening-chip-wait" : "opening-chip-on"}`}>{info.left}</span>}
                    </td>
                    <td>
                      <div className="overview-progress-label">{done}/{total}</div>
                      <div className="overview-progress"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overview-grid">
        <div className="admin-card">
          <h2>{scheduleTitle}</h2>
          {!schedule ?<p className="admin-muted-text">Chưa lớp nào có lịch học.</p> : (
            <ul className="overview-schedule">
              {schedule.list.map(c => (
                <li key={c.name}>
                  <span className="overview-schedule-time">{c.time || "—"}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <p className="admin-muted-text">{roster(c.name).length} học sinh{formatBook(c.book) ? ` · ${formatBook(c.book)}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-card">
          <div className="opening-list-head">
            <h2>Học phí tháng {monthLabel(month)}</h2>
            <button type="button" className="admin-link-btn" onClick={() => go("tuition")}>Học phí →</button>
          </div>
          {tuitionRows.length === 0 ? <p className="admin-muted-text">Chưa có lớp nào.</p> : (
            <>
              <p className="overview-tuition-summary">
                <strong>{billedCount}/{tuitionRows.length}</strong> lớp đã lập phiếu · <strong>{fmtMoney(tuitionRows.reduce((sum, r) => sum + r.total, 0)) || "0"} đ</strong>
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr><th>Lớp</th><th>Phiếu</th><th style={{ textAlign: "right" }}>Tổng tiền</th></tr>
                  </thead>
                  <tbody>
                    {tuitionRows.map(r => (
                      <tr key={r.name}>
                        <td><span className="opening-chip opening-chip-class">{r.name}</span></td>
                        <td>{r.bill ? `${r.billCount}/${roster(r.name).length}` : <span className="opening-chip opening-chip-wait">Chưa lập</span>}</td>
                        <td style={{ textAlign: "right" }}>{r.bill ? `${fmtMoney(r.total) || "0"} đ` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {isAdmin && <AnswerMigrationCard />}
      {isAdmin && <AudioRecompressCard />}
    </div>
  );
}
