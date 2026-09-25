import { useState } from "react";
import { useAuth } from "../../lib/authContext.jsx";
import { migrateAnswerKeys } from "../../lib/answerMigration.js";

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

export default function OverviewPage() {
  const { isAdmin } = useAuth();
  return (
    <>
      <div className="admin-card">
        <h2>Tổng quan</h2>
        <div className="admin-empty-state">
          <span className="admin-empty-state-icon" aria-hidden="true">📊</span>
          <p className="admin-empty-state-title">Chưa có số liệu tổng hợp</p>
          <p className="admin-muted-text">
            Số bài học, số học sinh đang hoạt động... sẽ hiện ở đây khi tính năng theo dõi tiến độ
            học sinh (Phase 3) được triển khai.
          </p>
        </div>
      </div>
      {isAdmin && <AnswerMigrationCard />}
    </>
  );
}
