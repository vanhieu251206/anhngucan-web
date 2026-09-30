import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { BEE } from "./sceneVisuals.jsx";
import { formatDateTime } from "../lib/assignmentUtils.js";
import { navigateApp } from "../lib/urlState.js";

// Màn sau khi HỌC SINH nộp bài (chốt 2026-09-30): chỉ báo đã nộp thành công, KHÔNG hiện điểm/đáp án. Điểm + bài chi
// tiết xem ở trang "Bài của con" SAU hạn chót (Worker /test/review), trong 48h trước khi kết quả chi tiết bị xoá.
// Admin/giáo viên/tài khoản đặc biệt làm thử (không có openingId) vẫn thấy điểm như cũ (TestScoreReport.jsx).
export default function SubmittedNotice({ openingId, onDone, compact = false }) {
  const [deadline, setDeadline] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "openings", openingId))
      .then(snap => {
        if (!cancelled) setDeadline(snap.data()?.expiresAt?.toDate?.() ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [openingId]);

  return (
    <div className={`submitted-notice${compact ? " is-compact" : ""}`}>
      <img className="review-hero-bee" src={BEE} alt="" aria-hidden="true" />
      <h2>Nộp bài thành công! 🎉</h2>
      <p>
        {deadline
          ? <>Con xem được điểm và đáp án sau hạn chót <strong>{formatDateTime(deadline)}</strong> (trong vòng 48 giờ).</>
          : <>Con xem được điểm và đáp án sau hạn chót của bài (trong vòng 48 giờ).</>}
      </p>
      <div className="submitted-notice-actions">
        <button type="button" className="btn btn-secondary" onClick={() => navigateApp({ page: "my-work" })}>Bài của con</button>
        {onDone && <button type="button" className="btn btn-primary" onClick={onDone}>Xong</button>}
      </div>
    </div>
  );
}
