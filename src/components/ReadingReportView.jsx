import { useState } from "react";
import { BEE } from "./sceneVisuals.jsx";
import { reviewTier, formatDuration } from "./SpeakingReportView.jsx";

// Màn tổng kết cuối bài Reading & Writing — CÙNG NGÔN NGỮ THIẾT KẾ với màn tổng kết Speaking
// (SpeakingReportView.jsx: vòng điểm %, thẻ thống kê, danh sách từng câu kèm huy hiệu Đúng/Sai),
// tái dùng lại các class CSS .review-* và 2 hàm reviewTier()/formatDuration() cho đồng bộ giao
// diện toàn site — chỉ khác nội dung từng câu (đáp án học sinh chọn/gõ vs đáp án đúng) vì bản chất
// dữ liệu câu hỏi Reading khác hẳn scene Speaking, không dùng chung được cấu trúc `items`.
// Chốt 2026-08-26 theo yêu cầu người dùng: "Tất cả bài đều cần có màn hình tổng kết giống speaking".

export const READING_TYPE_META = {
  yesno: { label: "Đúng/Sai", icon: "✅" },
  gapfill: { label: "Điền từ", icon: "📝" },
  "short-answer": { label: "Trả lời ngắn", icon: "✏️" },
  "word-scramble": { label: "Xáo chữ cái", icon: "🔤" },
  "multiple-choice": { label: "Chọn đáp án", icon: "🔘" },
  "word-bank": { label: "Chọn từ", icon: "🗂️" },
  "free-writing": { label: "Viết tự do", icon: "✍️" },
};

// items: mảng do buildReadingResults() ở ReadingRunner.jsx tạo ra — mỗi phần tử đã tính sẵn
// isCorrect/earned/total + nội dung hiển thị (studentAnswer/correctAnswer hoặc blanks[] riêng cho
// gapfill), tránh phải biết chi tiết luật chấm điểm ở component hiển thị thuần tuý này.
export default function ReadingReportView({ items, earnedPoints, totalPoints, elapsedMs, onDone }) {
  const [filter, setFilter] = useState("all"); // all | wrong

  // Câu "viết tự do" (ungraded, xem FreeWritingQuestion trong ReadingRunner.jsx) không có đúng/sai
  // — loại khỏi thống kê Đúng/Cần luyện thêm, vẫn hiện trong danh sách "Tất cả" để giáo viên đọc.
  const gradedItems = items.filter(it => !it.ungraded);
  const correctCount = gradedItems.filter(it => it.isCorrect).length;
  const reviewCount = gradedItems.length - correctCount;
  const pct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const tier = reviewTier(pct);
  const visibleItems = filter === "wrong" ? items.filter(it => !it.ungraded && !it.isCorrect) : items;

  return (
    <div className={`sentence-box review-screen ${tier.className}`}>
      <div className="review-report">
        <div className="review-hero">
          <img className="review-hero-bee" src={BEE} alt="" aria-hidden="true" />
          <h2 className="review-hero-title">🎉 Đã nộp bài! {tier.title}</h2>
          <p className="review-hero-note">{tier.note}</p>
        </div>

        <div className="review-score-card">
          <div className="review-score-ring" style={{ "--pct": pct }}>
            <span className="review-score-num">{pct}<small>%</small></span>
          </div>
          <div className="review-score-stats">
            <div className="review-stat">
              <span className="review-stat-num">{earnedPoints}/{totalPoints}</span>
              <span className="review-stat-label">Điểm đạt được</span>
            </div>
            <div className="review-stat">
              <span className="review-stat-num review-stat-good">{correctCount}</span>
              <span className="review-stat-label">Câu đúng</span>
            </div>
            <div className="review-stat">
              <span className="review-stat-num review-stat-hint">{reviewCount}</span>
              <span className="review-stat-label">Cần luyện thêm</span>
            </div>
            <div className="review-stat">
              <span className="review-stat-num">{formatDuration(elapsedMs)}</span>
              <span className="review-stat-label">Thời gian làm bài</span>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="review-empty">Bài này chưa có câu nào được chấm.</p>
        ) : (
          <>
            <div className="review-list-head">
              <h3 className="review-list-title">Kết quả chi tiết từng câu</h3>
              <div className="review-legend">
                <span><i className="review-legend-dot review-legend-ok" />Đúng</span>
                <span><i className="review-legend-dot review-legend-hint" />Cần xem lại</span>
              </div>
            </div>

            <div className="review-filter-row">
              <button
                className={`review-filter-btn${filter === "all" ? " is-active" : ""}`}
                onClick={() => setFilter("all")}
              >
                Tất cả ({items.length})
              </button>
              <button
                className={`review-filter-btn${filter === "wrong" ? " is-active" : ""}`}
                onClick={() => setFilter("wrong")}
                disabled={reviewCount === 0}
              >
                Cần xem lại ({reviewCount})
              </button>
            </div>

            <div className="review-list">
              {visibleItems.length === 0 && (
                <p className="review-empty">Không có câu nào trong mục này. 🎉</p>
              )}
              {visibleItems.map(item => {
                const meta = READING_TYPE_META[item.question.type] ?? { label: item.question.type, icon: "❓" };
                const questionLabel = item.question.text || item.question.prompt?.replace("___", "____") || "";
                if (item.ungraded) {
                  return (
                    <div className="review-item is-ungraded" key={item.qNumber}>
                      <div className="review-item-status" aria-hidden="true">✍️</div>
                      <div className="review-item-body">
                        <div className="review-item-head">
                          <span className="review-item-type">{meta.icon} Câu {item.qNumber} · {meta.label}</span>
                          <span className="review-badge-neutral">Cần giáo viên chấm</span>
                        </div>
                        <div className="review-item-said">Bé viết: "{item.studentAnswer}"</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className={`review-item${item.isCorrect ? " is-correct" : " is-hint"}`} key={item.qNumber}>
                    <div className="review-item-status" aria-hidden="true">{item.isCorrect ? "✓" : "!"}</div>
                    <div className="review-item-body">
                      <div className="review-item-head">
                        <span className="review-item-type">{meta.icon} Câu {item.qNumber} · {meta.label}</span>
                        <span className={item.isCorrect ? "review-badge-ok" : "review-badge-hint"}>
                          {item.isCorrect ? "Đúng" : "Chưa đúng"} · {item.earned}/{item.total} điểm
                        </span>
                      </div>
                      {questionLabel && <div className="review-item-question">{questionLabel}</div>}

                      {item.blanks ? (
                        <ul className="review-gapfill-list">
                          {item.blanks.map((b, i) => (
                            <li key={i} className={b.correct ? "is-correct" : "is-wrong"}>
                              Chỗ trống {i + 1}: bé điền "<strong>{b.studentAnswer}</strong>"
                              {!b.correct && <> — đáp án đúng: <strong>{b.correctAnswer}</strong></>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <>
                          <div className="review-item-said">Bé trả lời: "{item.studentAnswer}"</div>
                          {!item.isCorrect && (
                            <div className="review-item-said">Đáp án đúng: <strong>{item.correctAnswer}</strong></div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="review-footer">
          <button className="btn btn-primary review-done-btn" onClick={onDone}>
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
