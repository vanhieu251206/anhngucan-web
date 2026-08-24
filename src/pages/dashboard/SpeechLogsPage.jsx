import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase.js";

const PAGE_SIZE = 300;

// Xem log THUẦN TEXT (không audio) từng lượt học sinh bấm mic trả lời — dùng để phân tích các
// lỗi phát âm/nhận diện thường gặp của trẻ Việt Nam, tinh chỉnh lại ngưỡng chấm (xem
// src/lib/speechLog.js). CHỈ dành cho admin (không hiện trong sidebar giáo viên, xem
// DashboardPage.jsx) — dữ liệu vẫn đọc được bằng quyền teacher qua Firestore rules (isStaff()),
// nhưng UI này cố tình giới hạn chỉ admin theo yêu cầu người dùng 2026-08-24.
export default function SpeechLogsPage() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState(null);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [lessonFilter, setLessonFilter] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "speechLogs"), orderBy("createdAt", "desc"), limit(PAGE_SIZE)))
      .then(snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => setError(err.message));
  }, []);

  const lessonIds = [...new Set((logs ?? []).map(l => l.lessonId).filter(Boolean))].sort();
  const filtered = (logs ?? []).filter(
    l => (!onlyWrong || !l.correct) && (!lessonFilter || l.lessonId === lessonFilter)
  );

  return (
    <div className="admin-card">
      <h2>Log phát âm (chỉ admin)</h2>
      <p className="admin-muted-text">
        Mỗi dòng là 1 lượt học sinh bấm mic trả lời — chỉ lưu text (không có file âm thanh), dùng để
        xem AssemblyAI nghe được gì so với câu đáp án đang chấm, phục vụ tinh chỉnh ngưỡng chấm
        gần đúng sau này. Hiện {PAGE_SIZE} log gần nhất.
      </p>
      {error && <p className="admin-error">Lỗi tải log: {error}</p>}
      {logs === null && !error && <LoadingRow />}
      {logs && (
        <>
          <div className="admin-filter-bar">
            <label>
              Lọc theo bài
              <select className="admin-input" value={lessonFilter} onChange={e => setLessonFilter(e.target.value)}>
                <option value="">Tất cả</option>
                {lessonIds.map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </label>
            <label className="admin-filter-checkbox">
              <input type="checkbox" checked={onlyWrong} onChange={e => setOnlyWrong(e.target.checked)} />
              Chỉ hiện lượt SAI
            </label>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Bài</th>
                  <th>Scene</th>
                  <th>Câu hỏi</th>
                  <th>Đáp án đang chấm</th>
                  <th>Máy nghe được</th>
                  <th>Lượt</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td>{l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString("vi-VN") : "—"}</td>
                    <td>{l.lessonId ?? "—"}</td>
                    <td>{l.sceneIndex != null ? l.sceneIndex + 1 : "—"}</td>
                    <td>{l.examinerLine}</td>
                    <td>{l.expectedSentence}</td>
                    <td>{l.saidText || <em>(im lặng)</em>}</td>
                    <td>{l.attemptNumber ?? "—"}</td>
                    <td>{l.correct ? "✅" : "❌"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="admin-muted-text">Chưa có log nào khớp bộ lọc.</td>
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

function LoadingRow() {
  return (
    <div className="admin-loading-row">
      <span className="admin-spinner" />
      <span>Đang tải...</span>
    </div>
  );
}
