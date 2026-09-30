import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchReview } from "../lib/testSubmit.js";
import { formatDateTime, kindLabel, levelLabel } from "../lib/assignmentUtils.js";
import { formatDuration } from "./SpeakingReportView.jsx";
import { formatScore } from "./TestScoreReport.jsx";
import ResultItems from "./ResultItems.jsx";

// Học sinh xem lại bài đã nộp SAU HẠN CHÓT (trang "Bài của con", chốt 2026-09-30): điểm + từng câu (con trả lời gì,
// đáp án đúng). Dữ liệu từ Worker /test/review — Worker tự chặn nếu chưa tới hạn chót. Nhiều lượt → chọn lượt.
export default function ResultReviewModal({ opening, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pick, setPick] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchReview(opening.id)
      .then(d => {
        if (cancelled) return;
        setData(d);
        setPick(Math.max(0, (d.results?.length ?? 0) - 1));
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message === "not-yet" ? "Chưa tới hạn chót — con quay lại sau nhé." : "Chưa tải được bài (mạng yếu?) — con thử lại nhé.");
      });
    return () => {
      cancelled = true;
    };
  }, [opening.id]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = data?.results ?? [];
  const r = pick != null ? results[pick] : null;

  return createPortal(
    <div className="result-review-backdrop" onClick={onClose}>
      <div className="result-review" role="dialog" aria-modal="true" aria-label="Xem lại bài" onClick={e => e.stopPropagation()}>
        <div className="result-review-head">
          <div>
            <h2>{opening.testTitle || opening.testId}</h2>
            <p>{levelLabel(opening)} · {kindLabel(opening)}</p>
          </div>
          <button type="button" className="result-review-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="result-review-body">
          {error ? (
            <p className="work-empty">{error}</p>
          ) : !data ? (
            <p className="work-empty">Đang tải bài...</p>
          ) : !results.length ? (
            <p className="work-empty">Không còn bài chi tiết — kết quả chỉ giữ 48 giờ sau hạn chót.</p>
          ) : (
            <>
              {results.length > 1 && (
                <div className="work-tabs result-review-tabs">
                  {results.map((x, i) => (
                    <button key={i} type="button" className={`work-tab${pick === i ? " is-active" : ""}`} onClick={() => setPick(i)}>
                      Lượt {i + 1}
                    </button>
                  ))}
                </div>
              )}
              <div className="result-review-stats">
                <div>
                  <strong>{formatScore(r.correct)}/{formatScore(r.total)}</strong>
                  <span>Số câu đúng</span>
                </div>
                {r.elapsedMs != null && (
                  <div>
                    <strong>{formatDuration(r.elapsedMs)}</strong>
                    <span>Thời gian làm bài</span>
                  </div>
                )}
                {r.submittedAt && (
                  <div>
                    <strong>{formatDateTime(new Date(r.submittedAt))}</strong>
                    <span>Nộp lúc</span>
                  </div>
                )}
              </div>
              <ResultItems mode={r.mode} items={r.items} elapsedMs={r.elapsedMs} answerLabel="Con trả lời" />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
