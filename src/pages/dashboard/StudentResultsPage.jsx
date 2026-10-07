import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { useAuth } from "../../lib/authContext.jsx";
import { listStudents } from "../../lib/adminUsers.js";
import { purgeExpiredResults, isResultVisible, loadOpeningDeadlines, RESULT_MODE_LABEL } from "../../lib/testResults.js";
import { downloadResultSheet, canDownloadSheets } from "../../lib/resultSheetPdf.js";
import { SpeakingReportView, groupIntoReportItems } from "../../components/SpeakingReportView.jsx";
import ResultItems from "../../components/ResultItems.jsx";
import ResultAnalysisPage, { fmtScore, fmtDuration, fmtWhen } from "./ResultAnalysisPage.jsx";
import { readParams, setParams } from "../../lib/urlState.js";
import { regradeAllResults } from "../../lib/regradeAll.js";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { listOpenings, isExpired, attemptKey } from "../../lib/openings.js";
import { listSubmittedUids } from "../../lib/attempts.js";
import { deadlineInfo, kindLabel } from "../../lib/assignmentUtils.js";

const PAGE_SIZE = 500;

const MODE_LABEL = RESULT_MODE_LABEL;

// Bài thử của admin/giáo viên (SceneRunner/LessonsPage gắn nhãn "[Test - ...]") — mặc định ẩn khỏi báo cáo.
const isStaffTest = name => (name ?? "").startsWith("[Test");

// Chuẩn hoá 2 nguồn về cùng 1 dạng hàng:
//  - testResults: mọi dạng bài (kể cả Speaking từ nay) — có điểm + chi tiết từng câu.
//  - speakingSessions cũ (trước khi Speaking có điểm): chỉ hiện nếu chưa có testResults trùng sessionId.
// currentClassByUid: lớp HIỆN TẠI của học sinh (2026-09-25) — kết quả nhóm/lọc theo lớp hiện tại để học sinh chuyển
// lớp vẫn hiện đủ cho giáo viên lớp mới; `classAtSubmit` giữ lớp lúc nộp để đối chiếu.
function toRows(results, sessions, currentClassByUid = {}) {
  const seenSession = new Set(results.map(r => r.sessionId).filter(Boolean));
  const fromResults = results.map(r => ({
    key: `r-${r.id}`,
    kind: "result",
    studentName: r.studentName,
    studentClass: (r.uid && currentClassByUid[r.uid]) || r.studentClass,
    classAtSubmit: r.studentClass,
    lessonLabel: r.lessonLabel,
    mode: r.mode,
    when: r.submittedAt?.toDate ? r.submittedAt.toDate() : null,
    elapsedMs: r.elapsedMs,
    correct: r.correct,
    total: r.total,
    tabLeaves: Array.isArray(r.tabLeaves) ? r.tabLeaves : [],
    mastery: r.mastery ?? null,
    raw: r,
  }));
  const legacy = sessions
    .filter(s => !seenSession.has(s.id))
    .map(s => ({
      key: `s-${s.id}`,
      kind: "session",
      studentName: s.studentName,
      studentClass: (s.uid && currentClassByUid[s.uid]) || s.studentClass,
      classAtSubmit: s.studentClass,
      lessonLabel: s.lessonLabel,
      mode: "speaking",
      when: s.startedAt?.toDate ? s.startedAt.toDate() : null,
      elapsedMs: s.finishedAt?.toDate && s.startedAt?.toDate ? s.finishedAt.toDate() - s.startedAt.toDate() : null,
      correct: null,
      total: null,
      unfinished: !s.finishedAt,
      raw: s,
    }));
  return [...fromResults, ...legacy].sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0));
}

function scorePct(row) {
  return row.total > 0 ? Math.round((row.correct / row.total) * 100) : null;
}

// Trang Kết quả học sinh: 1 bảng chung cho MỌI dạng bài. Học sinh chỉ thấy số câu đúng/tổng, chi tiết từng
// câu (bé trả lời gì, đáp án đúng) chỉ xem ở đây. Xem lib/testResults.js.
export default function StudentResultsPage() {
  const { isTeacher, isAdmin, profile } = useAuth();
  const confirm = useConfirm();
  // Giáo viên bị giới hạn (restricted, vd dạy ngắn hạn) chỉ xem kết quả của lớp trong
  // allowedClasses — chỉ lọc UI (đọc testResults vẫn isStaff() ở firestore.rules, xem đề xuất
  // 2026-09-22: phần xem báo cáo không chặn thật ở rules vì rủi ro thấp).
  const isRestricted = isTeacher && !!profile?.restricted;
  const allowedClassSet = new Set(profile?.allowedClasses ?? []);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [classFilter, setClassFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [lessonFilter, setLessonFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showStaff, setShowStaff] = useState(false);
  const [openRow, setOpenRow] = useState(null);
  const [deadlines, setDeadlines] = useState(new Map()); // openingId -> hạn chót (ms)
  const [downloadingKey, setDownloadingKey] = useState(null);
  // Chỉ admin: chấm lại mọi kết quả còn lưu theo đáp án hiện tại, sau khi giáo viên sửa đáp án (lib/regradeAll.js).
  const [regrade, setRegrade] = useState(null); // null | { running, stats, error }
  const [reloadKey, setReloadKey] = useState(0);
  const [showMissing, setShowMissing] = useState(false);
  const missingScope = useMemo(
    () => (isRestricted ? new Set(profile?.allowedClasses ?? []) : null),
    [isRestricted, profile]
  );

  async function handleRegrade() {
    if (!(await confirm("Chấm lại toàn bộ bài đã nộp theo đáp án hiện tại? Điểm của học sinh có thể thay đổi."))) return;
    setRegrade({ running: true });
    try {
      const stats = await regradeAllResults(st => setRegrade({ running: true, stats: st }));
      setRegrade({ running: false, stats });
      setReloadKey(k => k + 1);
    } catch {
      setRegrade({ running: false, error: true });
    }
  }

  useEffect(() => {
    // Dọn kết quả đã quá 48h sau hạn chót trước khi tải (lib/testResults.js) — kết quả hết hạn không hiện nữa.
    purgeExpiredResults()
      .then(() =>
        Promise.all([
          getDocs(query(collection(db, "testResults"), orderBy("submittedAt", "desc"), limit(PAGE_SIZE))),
          getDocs(query(collection(db, "speakingSessions"), orderBy("updatedAt", "desc"), limit(PAGE_SIZE))),
          listStudents().catch(() => []),
          loadOpeningDeadlines().catch(() => new Map()),
        ])
      )
      .then(([rs, ss, students, deadlines]) => {
        setDeadlines(deadlines);
        const currentClassByUid = Object.fromEntries(students.map(st => [st.uid, st.className || ""]));
        const results = rs.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => isResultVisible(r, deadlines));
        // Phiên Speaking cũ không có kết quả: chỉ hiện trong 48h kể từ lần cập nhật cuối (như lúc bị dọn).
        const sessions = ss.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => (s.updatedAt?.toMillis?.() ?? Date.now()) + 48 * 3600 * 1000 > Date.now());
        setRows(toRows(results, sessions, currentClassByUid));
      })
      .catch(err => setError(err.message));
  }, [reloadKey]);

  const base = useMemo(
    () =>
      (rows ?? [])
        .filter(r => showStaff || !isStaffTest(r.studentName))
        .filter(r => !isRestricted || allowedClassSet.has(r.studentClass) || allowedClassSet.has(r.classAtSubmit)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, showStaff, isRestricted, profile]
  );
  // Màn phân tích 1 lượt nộp (ResultAnalysisPage.jsx) mở theo ?result=<key> — F5 / nút Back của trình duyệt vẫn đúng.
  useEffect(() => {
    if (!rows) return;
    const sync = () => {
      const key = readParams().get("result");
      const row = key ? rows.find(r => r.key === key) : null;
      const allowed = row && (!isRestricted || allowedClassSet.has(row.studentClass) || allowedClassSet.has(row.classAtSubmit));
      setOpenRow(allowed ? row : null);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isRestricted, profile]);

  function openDetail(r) {
    setOpenRow(r);
    setParams({ result: r.key });
  }
  function closeDetail() {
    setOpenRow(null);
    setParams({ result: null }, { replace: true });
  }

  const classes = useMemo(() => [...new Set(base.map(r => r.studentClass).filter(Boolean))].sort(), [base]);
  const lessons = useMemo(() => [...new Set(base.map(r => r.lessonLabel).filter(Boolean))].sort(), [base]);

  const filtered = base.filter(r => {
    if (classFilter && r.studentClass !== classFilter) return false;
    if (modeFilter && r.mode !== modeFilter) return false;
    if (lessonFilter && r.lessonLabel !== lessonFilter) return false;
    if (nameFilter && !(r.studentName ?? "").toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (dateFrom && r.when && r.when < new Date(dateFrom)) return false;
    if (dateTo && r.when && r.when > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const scored = filtered.filter(r => scorePct(r) != null);
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + scorePct(r), 0) / scored.length) : null;
  const studentCount = new Set(filtered.map(r => `${r.studentName}|${r.studentClass}`)).size;

  async function handleSheet(r) {
    setDownloadingKey(r.key);
    try {
      await downloadResultSheet(r.raw, { className: r.studentClass });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setDownloadingKey(null);
    }
  }

  function exportCsv() {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Học sinh", "Lớp", "Bài", "Dạng", "Nộp lúc", "Thời gian", "Đúng", "Tổng", "%", "Rời tab"].map(esc).join(",")];
    for (const r of filtered) {
      lines.push([r.studentName, r.studentClass, r.lessonLabel, MODE_LABEL[r.mode] ?? r.mode, fmtWhen(r.when), fmtDuration(r.elapsedMs), r.correct ?? "", r.total ?? "", scorePct(r) ?? "", r.tabLeaves?.length ?? 0].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ket-qua-hoc-sinh.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (openRow) {
    return (
      <>
        {error && <p className="admin-error">{error}</p>}
        <ResultAnalysisPage
          row={openRow}
          onBack={closeDetail}
          actions={
            openRow.kind === "result" && canDownloadSheets(deadlines.get(openRow.raw.openingId)) && (
              <button className="opening-btn" disabled={!!downloadingKey} onClick={() => handleSheet(openRow)}>
                {downloadingKey === openRow.key ? "..." : "⬇ Phiếu chấm"}
              </button>
            )
          }
        >
          <Detail row={openRow} />
        </ResultAnalysisPage>
      </>
    );
  }

  return (
    <div>
      <div className="results-stats">
        <div className="results-stat"><span>{filtered.length}</span><small>Lượt nộp bài</small></div>
        <div className="results-stat"><span>{studentCount}</span><small>Học sinh</small></div>
        <div className="results-stat"><span>{avg == null ? "—" : `${avg}%`}</span><small>Điểm trung bình</small></div>
      </div>

      <div className="admin-card">
        <div className="opening-list-head">
          <h2>{showMissing ? "Học sinh chưa nộp" : "Kết quả học sinh"}</h2>
          <div className="results-head-actions">
            <button className="opening-btn" type="button" onClick={() => setShowMissing(v => !v)}>
              {showMissing ? "← Kết quả" : "Xem chưa nộp"}
            </button>
            {!showMissing && isAdmin && (
              <button className="opening-btn" type="button" onClick={handleRegrade} disabled={regrade?.running}>
                {regrade?.running ? `Đang chấm lại${regrade.stats ? ` ${regrade.stats.done}/${regrade.stats.tests} bài` : ""}...` : "↻ Chấm lại"}
              </button>
            )}
            {!showMissing && <button className="opening-btn" type="button" onClick={exportCsv} disabled={!filtered.length}>⬇ Xuất Excel (CSV)</button>}
          </div>
        </div>
        {showMissing && <MissingPanel allowedClasses={missingScope} />}
        {!showMissing && regrade?.error && <p className="admin-error">Chưa chấm lại được (mất mạng?) — bấm lại nhé.</p>}
        {!showMissing && regrade?.stats && !regrade.running && (
          <p className="admin-muted-text">
            Đã chấm lại {regrade.stats.checked} lượt nộp · Đổi điểm {regrade.stats.changed}
            {regrade.stats.skipped ? ` · Giữ nguyên ${regrade.stats.skipped} (không chấm lại được)` : ""}
            {regrade.stats.failed ? ` · Lỗi ${regrade.stats.failed} bài` : ""}
          </p>
        )}
        {!showMissing && error && <p className="admin-error">Lỗi tải dữ liệu: {error}</p>}
        {!showMissing && rows === null && !error && <LoadingRow />}
        {!showMissing && rows && (
          <>
            <div className="admin-filter-bar results-filter-bar">
              <label>
                Lớp
                <select className="admin-input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                  <option value="">Tất cả lớp</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>
                Học sinh
                <input className="admin-input" placeholder="Tìm theo tên" value={nameFilter} onChange={e => setNameFilter(e.target.value)} />
              </label>
              <label>
                Dạng bài
                <select className="admin-input" value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
                  <option value="">Tất cả</option>
                  {Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>
                Bài
                <select className="admin-input" value={lessonFilter} onChange={e => setLessonFilter(e.target.value)}>
                  <option value="">Tất cả</option>
                  {lessons.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label>
                Từ ngày
                <input className="admin-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </label>
              <label>
                Đến ngày
                <input className="admin-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </label>
            </div>
            <label className="results-toggle">
              <input type="checkbox" checked={showStaff} onChange={e => setShowStaff(e.target.checked)} /> Hiện cả bài thử của admin/giáo viên
            </label>

            <div style={{ overflowX: "auto" }}>
              <table className="admin-table opening-table">
                <thead>
                  <tr><th>Học sinh</th><th>Bài</th><th>Nộp lúc</th><th>Thời gian</th><th>Kết quả</th><th>Rời tab</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const pct = scorePct(r);
                    return (
                      <tr key={r.key}>
                        <td>
                          <div className="opening-test-title">{r.studentName || "—"}</div>
                          {r.studentClass && <span className="opening-chip opening-chip-class">{r.studentClass}</span>}
                          {r.classAtSubmit && r.classAtSubmit !== r.studentClass && <div className="opening-test-kind">lúc nộp: lớp {r.classAtSubmit}</div>}
                        </td>
                        <td>
                          <div className="opening-test-title">{r.lessonLabel || "—"}</div>
                          <div className="opening-test-kind">{MODE_LABEL[r.mode] ?? r.mode}</div>
                        </td>
                        <td>{fmtWhen(r.when)}</td>
                        <td>{fmtDuration(r.elapsedMs)}</td>
                        <td>
                          {r.correct == null ? (
                            <span className="opening-test-kind">{r.unfinished ? "Làm dở" : "Chưa có điểm"}</span>
                          ) : (
                            <span className={`results-score ${pct >= 80 ? "is-high" : pct >= 50 ? "is-mid" : "is-low"}`}>
                              {fmtScore(r.correct)}/{fmtScore(r.total)} · {pct ?? 0}%
                            </span>
                          )}
                          {r.mastery && (
                            <div className="opening-test-kind">
                              Lần đầu {fmtScore(r.mastery.firstCorrect)} · {r.mastery.rounds} vòng{r.mastery.passed ? "" : " · chưa đạt"}
                            </div>
                          )}
                        </td>
                        <td>{r.tabLeaves?.length ? <span className="opening-chip opening-chip-off">{r.tabLeaves.length} lần</span> : "—"}</td>
                        <td>
                          <div className="opening-actions">
                            {/* Phiếu chấm bài (PDF in trắng đen): chỉ từ lúc hết hạn nộp tới khi kết quả bị xoá (lib/resultSheetPdf.js). */}
                            {r.kind === "result" && canDownloadSheets(deadlines.get(r.raw.openingId)) && (
                              <button className="opening-btn" disabled={!!downloadingKey} onClick={() => handleSheet(r)}>
                                {downloadingKey === r.key ? "..." : "⬇ Phiếu"}
                              </button>
                            )}
                            <button className="opening-btn" onClick={() => openDetail(r)}>Chi tiết</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="admin-muted-text">Chưa có kết quả nào khớp bộ lọc.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Detail({ row }) {
  if (row.kind === "session") return <SessionDetail session={row.raw} />;
  return <ResultItems mode={row.mode} items={row.raw.items ?? []} elapsedMs={row.elapsedMs} />;
}

// Lượt Speaking cũ (trước khi có điểm): đọc từng sự kiện từ speakingSessions/{id}/events.
function SessionDetail({ session }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDocs(query(collection(db, "speakingSessions", session.id, "events"), orderBy("createdAt", "asc")))
      .then(snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => setError(err.message));
  }, [session.id]);

  if (error) return <p className="admin-error">Lỗi tải chi tiết: {error}</p>;
  if (events === null) return <LoadingRow />;
  if (events.length === 0) return <p className="admin-muted-text">Chưa có lượt nào được ghi.</p>;

  const elapsedMs =
    session.finishedAt?.toDate && session.startedAt?.toDate ? session.finishedAt.toDate() - session.startedAt.toDate() : null;
  return (
    <div className="admin-report-panel">
      <SpeakingReportView items={groupIntoReportItems(events)} elapsedMs={elapsedMs} />
    </div>
  );
}

// Danh sách em CHƯA NỘP của từng lần mở bài chưa đóng (còn hạn lẫn đã hết hạn) — đối chiếu sĩ số lớp với
// `attempts` (không bị xoá theo luật 48h). Bài hết hạn lên đầu. Giáo viên phụ chỉ thấy lớp được giao.
function MissingPanel({ allowedClasses }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [classFilter, setClassFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [students, openings] = await Promise.all([listStudents(), listOpenings()]);
        const submitted = await listSubmittedUids(openings.map(o => attemptKey(o.testId, o.id)));
        if (!cancelled) setData({ students, openings, submitted, now: Date.now() });
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const list = useMemo(() => {
    if (!data) return [];
    const { students, openings, submitted, now } = data;
    const deadline = o => o.expiresAt?.toMillis?.() ?? Infinity;
    return openings
      .filter(o => !allowedClasses || allowedClasses.has(o.className))
      .map(o => {
        // Em bị khoá tài khoản không vào làm được nên không tính vào sĩ số cần nộp.
        const roster = students.filter(s => s.className === o.className && !s.disabled);
        const done = submitted.get(attemptKey(o.testId, o.id)) ?? new Set();
        const missing = roster
          .filter(s => !done.has(s.uid))
          .map(s => s.displayName || s.username || "—")
          .sort((a, b) => a.localeCompare(b, "vi"));
        return { o, total: roster.length, missing, expired: isExpired(o), info: deadlineInfo(o, now) };
      })
      .filter(r => r.missing.length > 0)
      .sort((a, b) => (a.expired !== b.expired ? (a.expired ? -1 : 1) : a.expired ? deadline(b.o) - deadline(a.o) : deadline(a.o) - deadline(b.o)));
  }, [data, allowedClasses]);

  if (error) return <p className="admin-error">Lỗi tải dữ liệu: {error}</p>;
  if (!data) return <LoadingRow />;

  const classes = [...new Set(list.map(r => r.o.className))].sort();
  const shown = list.filter(r => !classFilter || r.o.className === classFilter);

  return (
    <>
      <div className="admin-filter-bar">
        <label>
          Lớp
          <select className="admin-input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="">Tất cả lớp</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table opening-table">
          <thead>
            <tr><th>Lớp</th><th>Bài</th><th>Hạn chót</th><th>Chưa nộp</th></tr>
          </thead>
          <tbody>
            {shown.map(({ o, total, missing, expired, info }) => (
              <tr key={o.id}>
                <td><span className="opening-chip opening-chip-class">{o.className}</span></td>
                <td>
                  <div className="opening-test-title">{o.testTitle}</div>
                  <div className="opening-test-kind">{kindLabel(o)}</div>
                </td>
                <td>
                  <div>{info.text}</div>
                  {expired
                    ? <span className="opening-chip opening-chip-off">Hết hạn</span>
                    : info.left && <span className={`opening-chip ${info.urgent ? "opening-chip-wait" : "opening-chip-on"}`}>{info.left}</span>}
                </td>
                <td>
                  <div className="opening-test-title">{missing.length}/{total} em</div>
                  <div className="opening-test-kind">{missing.join(", ")}</div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={4} className="admin-muted-text">Không có em nào chưa nộp.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LoadingRow() {
  return (
    <div className="admin-loading-row">
      <span className="admin-spinner" />
      <span>Đang tải...</span>
    </div>
  );
}
