import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { SpeakingReportView, groupIntoReportItems } from "../../components/SpeakingReportView.jsx";

const PAGE_SIZE = 300;

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString("vi-VN") : "—";
}

// Báo cáo QUÁ TRÌNH làm bài Speaking. Mỗi dòng = 1 lần 1 học sinh (đã nhập họ tên) vào làm 1 bài;
// bấm "Xem chi tiết" mở ra ĐÚNG format màn tổng kết mà học sinh thấy (điểm %, thống kê, từng câu
// kèm quá trình thử nhiều lần nếu có) qua SpeakingReportView.jsx dùng chung với SceneRunner.jsx —
// CHỈ khác là KHÔNG có audio (audio chỉ lưu trên máy học sinh, xem CLAUDE.md — không có cơ chế
// giáo viên nghe từ xa, chốt 2026-08-25).
export default function StudentResultsPage() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [nameFilter, setNameFilter] = useState("");
  const [lessonFilter, setLessonFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openSessionId, setOpenSessionId] = useState(null);

  useEffect(() => {
    getDocs(query(collection(db, "speakingSessions"), orderBy("updatedAt", "desc"), limit(PAGE_SIZE)))
      .then(snap => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => setError(err.message));
  }, []);

  const lessonLabels = [...new Set((sessions ?? []).map(s => s.lessonLabel).filter(Boolean))].sort();

  const filtered = (sessions ?? []).filter(s => {
    if (nameFilter && !(s.studentName ?? "").toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (lessonFilter && s.lessonLabel !== lessonFilter) return false;
    const started = s.startedAt?.toDate ? s.startedAt.toDate() : null;
    if (dateFrom && started && started < new Date(dateFrom)) return false;
    if (dateTo && started && started > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  return (
    <div className="admin-card">
      <h2>Kết quả học sinh</h2>
      <p className="admin-muted-text">
        Báo cáo quá trình làm bài Speaking — mỗi dòng là 1 lần 1 học sinh vào làm 1 bài. Bấm "Xem kết
        quả" để mở màn tổng kết đúng như học sinh đã thấy (điểm %, từng câu, quá trình thử nhiều lần
        nếu có) — không có audio. Hiện {PAGE_SIZE} lần làm bài gần nhất, mới nhất trên cùng.
      </p>
      {error && <p className="admin-error">Lỗi tải dữ liệu: {error}</p>}
      {sessions === null && !error && <LoadingRow />}
      {sessions && (
        <>
          <div className="admin-filter-bar">
            <label>
              Tìm theo tên học sinh
              <input
                className="admin-input"
                placeholder="vd: Hiếu"
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
              />
            </label>
            <label>
              Lọc theo bài
              <select className="admin-input" value={lessonFilter} onChange={e => setLessonFilter(e.target.value)}>
                <option value="">Tất cả</option>
                {lessonLabels.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
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
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Lớp</th>
                  <th>Bài</th>
                  <th>Bắt đầu</th>
                  <th>Trạng thái</th>
                  <th>Số scene</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    open={openSessionId === s.id}
                    onToggle={() => setOpenSessionId(id => (id === s.id ? null : s.id))}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="admin-muted-text">Chưa có kết quả nào khớp bộ lọc.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SessionRow({ session, open, onToggle }) {
  return (
    <>
      <tr>
        <td>{session.studentName || "—"}</td>
        <td>{session.studentClass || "—"}</td>
        <td>{session.lessonLabel || "—"}</td>
        <td>{formatDate(session.startedAt)}</td>
        <td>{session.finishedAt ? "✅ Hoàn thành" : "⏳ Đang làm dở"}</td>
        <td>{session.sceneCount ?? "—"}</td>
        <td>
          <button className="admin-link-btn" onClick={onToggle}>
            {open ? "Đóng" : "Xem kết quả"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <SessionDetail session={session} />
          </td>
        </tr>
      )}
    </>
  );
}

function SessionDetail({ session }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDocs(query(collection(db, "speakingSessions", session.id, "events"), orderBy("createdAt", "asc")))
      .then(snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => setError(err.message));
  }, [session.id]);

  if (error) return <p className="admin-error" style={{ padding: 14 }}>Lỗi tải chi tiết: {error}</p>;
  if (events === null) return <LoadingRow />;
  if (events.length === 0) return <p className="admin-muted-text" style={{ padding: 14 }}>Chưa có lượt nào được ghi.</p>;

  const items = groupIntoReportItems(events);
  const elapsedMs =
    session.finishedAt?.toDate && session.startedAt?.toDate
      ? session.finishedAt.toDate() - session.startedAt.toDate()
      : null;

  return (
    <div className="admin-report-panel">
      <SpeakingReportView items={items} elapsedMs={elapsedMs} />
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
