import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase.js";

const PAGE_SIZE = 300;

const RESULT_LABEL = { correct: "✅ Đúng", wrong: "❌ Sai", revealed: "⚠️ Hết lượt (tự qua)" };
const SCENE_TYPE_LABEL = {
  mic: "🎤 Mic",
  "scene-click": "👆 Chạm ảnh",
  "card-select": "🃏 Chọn thẻ",
  "drag-drop": "✋ Kéo-thả",
};

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString("vi-VN") : "—";
}

// Báo cáo QUÁ TRÌNH làm bài Speaking — CHƯA có điểm số tổng (xem CLAUDE.md mục 6, Phase 3 phần
// điểm số vẫn chưa làm). Mỗi dòng = 1 lần 1 học sinh (đã nhập họ tên) vào làm 1 bài; bấm "Xem chi
// tiết" để xem từng scene/từng lượt trong lần làm bài đó (dữ liệu ghi bởi SceneRunner.jsx).
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
        Báo cáo quá trình làm bài Speaking — mỗi dòng là 1 lần 1 học sinh vào làm 1 bài. Bấm "Xem chi
        tiết" để xem từng câu, mỗi câu qua sau bao nhiêu lượt. Chưa có điểm số tổng kết (sẽ bổ sung
        sau). Hiện {PAGE_SIZE} lần làm bài gần nhất, mới nhất trên cùng.
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
                    <td colSpan={6} className="admin-muted-text">Chưa có kết quả nào khớp bộ lọc.</td>
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
        <td>{session.lessonLabel || "—"}</td>
        <td>{formatDate(session.startedAt)}</td>
        <td>{session.finishedAt ? "✅ Hoàn thành" : "⏳ Đang làm dở"}</td>
        <td>{session.sceneCount ?? "—"}</td>
        <td>
          <button className="admin-link-btn" onClick={onToggle}>
            {open ? "Đóng" : "Xem chi tiết"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ padding: 0 }}>
            <SessionDetail sessionId={session.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function SessionDetail({ sessionId }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDocs(query(collection(db, "speakingSessions", sessionId, "events"), orderBy("createdAt", "asc")))
      .then(snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => setError(err.message));
  }, [sessionId]);

  if (error) return <p className="admin-error" style={{ padding: 14 }}>Lỗi tải chi tiết: {error}</p>;
  if (events === null) return <LoadingRow />;
  if (events.length === 0) return <p className="admin-muted-text" style={{ padding: 14 }}>Chưa có lượt nào được ghi.</p>;

  return (
    <div style={{ background: "#fafbfd", padding: "10px 14px", overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Scene</th>
            <th>Loại</th>
            <th>Câu hỏi</th>
            <th>Lượt</th>
            <th>Kết quả</th>
            <th>Máy nghe được</th>
            <th>Lúc</th>
          </tr>
        </thead>
        <tbody>
          {events.map(e => (
            <tr key={e.id}>
              <td>{e.sceneIndex != null ? e.sceneIndex + 1 : "—"}</td>
              <td>{SCENE_TYPE_LABEL[e.sceneType] ?? e.sceneType ?? "—"}</td>
              <td>{e.examinerLine}</td>
              <td>{e.attemptNumber ?? "—"}</td>
              <td>{RESULT_LABEL[e.result] ?? e.result ?? "—"}</td>
              <td>{e.recognizedText || (e.sceneType === "mic" ? <em>(im lặng)</em> : "—")}</td>
              <td>{formatDate(e.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
