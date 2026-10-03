import { useEffect, useSyncExternalStore } from "react";
import { subscribeExamFocus, getExamFocusState, dismissExamAlert, dismissExamNotice } from "../lib/examFocus.js";

const NOTICE_MS = 10000;

// Cảnh báo rời tab khi làm bài (lib/examFocus.js) — gắn 1 lần ở main.jsx, hiện đè lên mọi màn làm bài.
// - Vào bài: dải nhắc ở đầu màn hình (không che bài, tự ẩn) báo trước là rời tab sẽ bị ghi lại.
// - Quay lại sau khi rời tab: hộp cảnh báo che bài, phải bấm xác nhận mới làm tiếp.
export default function ExamFocusOverlay() {
  const { active, count, alert, notice } = useSyncExternalStore(subscribeExamFocus, getExamFocusState);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismissExamNotice, NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  if (!active) return null;
  if (alert) {
    return (
      <div className="exam-focus-overlay" role="alertdialog" aria-modal="true">
        <div className="exam-focus-dialog">
          <span className="exam-focus-icon" aria-hidden="true">⚠️</span>
          <h2>Con vừa rời khỏi bài làm</h2>
          <p>Lần thứ <strong>{count}</strong> — đã ghi lại và báo cho giáo viên.</p>
          <p>Khi làm bài con không được chuyển sang tab hay ứng dụng khác.</p>
          <button type="button" className="btn btn-primary" onClick={dismissExamAlert}>Con hiểu rồi, làm tiếp</button>
        </div>
      </div>
    );
  }
  if (notice) {
    return (
      <div className="exam-focus-notice" role="status">
        <span>⚠️ Không chuyển tab hay mở ứng dụng khác khi làm bài — mỗi lần rời khỏi bài sẽ được ghi lại và báo cho giáo viên.</span>
        <button type="button" onClick={dismissExamNotice} aria-label="Đóng">✕</button>
      </div>
    );
  }
  return null;
}
