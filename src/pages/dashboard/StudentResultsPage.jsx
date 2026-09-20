import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { SpeakingReportView, groupIntoReportItems } from "../../components/SpeakingReportView.jsx";

const PAGE_SIZE = 500;

const MODE_LABEL = {
  speaking: "Speaking",
  reading: "Reading & Writing",
  dictation: "Dictation",
  "listening-exam": "Listening",
  "ielts-reading": "IELTS Reading",
  "ielts-listening": "IELTS Listening",
  "ketpet-vocab": "KET/PET Vocabulary",
  "ketpet-test": "KET/PET Practice Test",
};

function fmtScore(n) {
  return Number(n).toFixed(2).replace(/\.?0+$/, "");
}

function fmtDuration(ms) {
  if (ms == null) return "—";
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}p ${String(sec % 60).padStart(2, "0")}s`;
}

function fmtWhen(d) {
  return d ? d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";
}

// Bài thử của admin/giáo viên (SceneRunner/LessonsPage gắn nhãn "[Test - ...]") — mặc định ẩn khỏi báo cáo.
const isStaffTest = name => (name ?? "").startsWith("[Test");

// Chuẩn hoá 2 nguồn về cùng 1 dạng hàng:
//  - testResults: mọi dạng bài (kể cả Speaking từ nay) — có điểm + chi tiết từng câu.
//  - speakingSessions cũ (trước khi Speaking có điểm): chỉ hiện nếu chưa có testResults trùng sessionId.
function toRows(results, sessions) {
  const seenSession = new Set(results.map(r => r.sessionId).filter(Boolean));
  const fromResults = results.map(r => ({
    key: `r-${r.id}`,
    kind: "result",
    studentName: r.studentName,
    studentClass: r.studentClass,
    lessonLabel: r.lessonLabel,
    mode: r.mode,
    when: r.submittedAt?.toDate ? r.submittedAt.toDate() : null,
    elapsedMs: r.elapsedMs,
    correct: r.correct,
    total: r.total,
    raw: r,
  }));
  const legacy = sessions
    .filter(s => !seenSession.has(s.id))
    .map(s => ({
      key: `s-${s.id}`,
      kind: "session",
      studentName: s.studentName,
      studentClass: s.studentClass,
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

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, "testResults"), orderBy("submittedAt", "desc"), limit(PAGE_SIZE))),
      getDocs(query(collection(db, "speakingSessions"), orderBy("updatedAt", "desc"), limit(PAGE_SIZE))),
    ])
      .then(([rs, ss]) =>
        setRows(toRows(rs.docs.map(d => ({ id: d.id, ...d.data() })), ss.docs.map(d => ({ id: d.id, ...d.data() }))))
      )
      .catch(err => setError(err.message));
  }, []);

  const base = useMemo(() => (rows ?? []).filter(r => showStaff || !isStaffTest(r.studentName)), [rows, showStaff]);
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

  function exportCsv() {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Học sinh", "Lớp", "Bài", "Dạng", "Nộp lúc", "Thời gian", "Đúng", "Tổng", "%"].map(esc).join(",")];
    for (const r of filtered) {
      lines.push([r.studentName, r.studentClass, r.lessonLabel, MODE_LABEL[r.mode] ?? r.mode, fmtWhen(r.when), fmtDuration(r.elapsedMs), r.correct ?? "", r.total ?? "", scorePct(r) ?? ""].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ket-qua-hoc-sinh.csv";
    a.click();
    URL.revokeObjectURL(a.href);
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
          <h2>Kết quả học sinh</h2>
          <button className="opening-btn" type="button" onClick={exportCsv} disabled={!filtered.length}>⬇ Xuất Excel (CSV)</button>
        </div>
        {error && <p className="admin-error">Lỗi tải dữ liệu: {error}</p>}
        {rows === null && !error && <LoadingRow />}
        {rows && (
          <>
            <div className="admin-filter-bar">
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
                  <tr><th>Học sinh</th><th>Bài</th><th>Nộp lúc</th><th>Thời gian</th><th>Kết quả</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const pct = scorePct(r);
                    return (
                      <tr key={r.key}>
                        <td>
                          <div className="opening-test-title">{r.studentName || "—"}</div>
                          {r.studentClass && <span className="opening-chip opening-chip-class">{r.studentClass}</span>}
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
                        </td>
                        <td><button className="opening-btn" onClick={() => setOpenRow(r)}>Chi tiết</button></td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="admin-muted-text">Chưa có kết quả nào khớp bộ lọc.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {openRow && (
        <div className="confirm-overlay" role="presentation" onClick={() => setOpenRow(null)}>
          <div className="opening-modal results-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="opening-list-head">
              <div>
                <h2 style={{ margin: 0 }}>{openRow.studentName} {openRow.studentClass && `· ${openRow.studentClass}`}</h2>
                <p className="admin-muted-text" style={{ margin: "4px 0 0" }}>
                  {openRow.lessonLabel} · {MODE_LABEL[openRow.mode] ?? openRow.mode} · {fmtWhen(openRow.when)} · {fmtDuration(openRow.elapsedMs)}
                </p>
              </div>
              <button className="opening-btn" onClick={() => setOpenRow(null)}>Đóng</button>
            </div>
            <Detail row={openRow} />
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ row }) {
  if (row.kind === "session") return <SessionDetail session={row.raw} />;
  const items = row.raw.items ?? [];
  if (!items.length) return <p className="admin-muted-text">Không có chi tiết từng câu.</p>;

  // Speaking (từ nay): dùng lại đúng màn tổng kết cũ, nhưng dữ liệu đã có sẵn trong kết quả.
  if (row.mode === "speaking") {
    return (
      <div className="admin-report-panel">
        <SpeakingReportView items={items} elapsedMs={row.elapsedMs} />
      </div>
    );
  }

  // Listening Luyện đề chỉ lưu điểm từng Part.
  if (items[0]?.part) {
    return (
      <ul className="results-parts">
        {items.map((it, i) => (
          <li key={i}><strong>{it.part}</strong><span>{it.correct}/{it.total}</span></li>
        ))}
      </ul>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr><th>Câu</th><th></th><th>Bé trả lời</th><th>Đáp án đúng</th></tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const blanks = Array.isArray(it.blanks) ? it.blanks : null;
            return (
              <tr key={i}>
                <td>
                  <div>{it.group ? `${it.group}.${it.qNumber}` : it.qNumber ?? i + 1}</div>
                  {it.prompt && <div className="opening-test-kind">{it.prompt}</div>}
                </td>
                <td>{it.isCorrect ? <span className="opening-chip opening-chip-on">✓</span> : <span className="opening-chip opening-chip-off">✗</span>}</td>
                <td>{blanks ? blanks.map(b => b.studentAnswer).join(" · ") : it.studentAnswer || <em>(bỏ trống)</em>}</td>
                <td>{blanks ? blanks.map(b => b.correctAnswer).join(" · ") : it.correctAnswer ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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

function LoadingRow() {
  return (
    <div className="admin-loading-row">
      <span className="admin-spinner" />
      <span>Đang tải...</span>
    </div>
  );
}
