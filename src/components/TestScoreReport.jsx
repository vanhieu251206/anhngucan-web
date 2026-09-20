import { BEE } from "./sceneVisuals.jsx";
import { formatDuration } from "./SpeakingReportView.jsx";

// Màn kết quả DÙNG CHUNG cho học sinh sau khi nộp bài (mọi dạng bài): CHỈ số câu đúng/tổng và thời gian.
// Không hiện đáp án, giải thích, từng câu đúng/sai, không có lời khen theo mức điểm — chi tiết dành cho
// giáo viên/admin (xem lib/testResults.js). `correct` có thể là số lẻ (KET/PET chấm theo điểm).
export function formatScore(n) {
  return Number(n).toFixed(2).replace(/\.?0+$/, "");
}

export default function TestScoreReport({ correct, total, elapsedMs, onDone, onRetry }) {
  return (
    <div className="sentence-box review-screen">
      <div className="review-report">
        <div className="review-hero">
          <img className="review-hero-bee" src={BEE} alt="" aria-hidden="true" />
          <h2 className="review-hero-title">Đã nộp bài</h2>
        </div>
        <div className="review-score-card">
          <div className="review-score-stats">
            <div className="review-stat">
              <span className="review-stat-num">{formatScore(correct)}/{formatScore(total)}</span>
              <span className="review-stat-label">Số câu đúng</span>
            </div>
            {elapsedMs != null && (
              <div className="review-stat">
                <span className="review-stat-num">{formatDuration(elapsedMs)}</span>
                <span className="review-stat-label">Thời gian làm bài</span>
              </div>
            )}
          </div>
        </div>
        <div className="review-footer">
          {onRetry && <button className="btn btn-secondary review-done-btn" onClick={onRetry}>Làm lại</button>}
          {onDone && <button className="btn btn-primary review-done-btn" onClick={onDone}>Xong</button>}
        </div>
      </div>
    </div>
  );
}
