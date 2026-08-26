import { useState } from "react";
import { BEE } from "./sceneVisuals.jsx";

// Phần HIỂN THỊ THUẦN TUÝ của "kết quả 1 lượt làm bài Speaking" — dùng chung giữa:
//  1) SceneRunner.jsx (ReviewScreen) — học sinh xem NGAY sau khi nộp bài, CÓ audio nghe lại (đọc
//     từ IndexedDB trên chính máy học sinh, xem lib/audioReviewCache.js).
//  2) StudentResultsPage.jsx (Dashboard "Kết quả học sinh") — giáo viên/admin xem lại SAU đó qua
//     dữ liệu Firestore (speakingSessions/{id}/events), KHÔNG có audio (audio chỉ nằm trên máy học
//     sinh, xem CLAUDE.md — không có phần "giáo viên xem từ xa"), nên `showAudio=false`.
// Đồng bộ layout/màu sắc đúng 1 chỗ, sửa 1 lần áp dụng cho cả 2 nơi (chốt 2026-08-25).

export const SCENE_TYPE_META = {
  mic: { label: "Nói", icon: "🎤" },
  "scene-click": { label: "Chạm vào ảnh", icon: "👆" },
  "card-select": { label: "Chọn thẻ", icon: "🃏" },
  "drag-drop": { label: "Kéo-thả", icon: "✋" },
};

const ATTEMPT_ICON = { correct: "✅", revealed: "💡", wrong: "❌" };

// 3 mốc phản hồi cảm xúc theo % đúng — cùng tinh thần "ong giám khảo phản ứng theo kết quả" như
// Duolingo (mascot đổi trạng thái theo điểm), nhưng chỉ đổi text+class vì dự án chỉ có 1 ảnh ong
// (public/assets/img/mascot/bee.png), không có bộ ảnh biểu cảm riêng.
export function reviewTier(pct) {
  if (pct >= 80) return { className: "review-tier-great", title: "Xuất sắc!", note: "Bé làm rất tốt bài này." };
  if (pct >= 50) return { className: "review-tier-ok", title: "Làm tốt lắm!", note: "Chỉ còn vài câu cần luyện thêm." };
  return { className: "review-tier-retry", title: "Cố lên nào!", note: "Cùng xem lại các câu bên dưới rồi luyện thêm nhé." };
}

export function formatDuration(ms) {
  if (ms == null) return "—";
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m} phút ${String(s).padStart(2, "0")} giây`;
}

// Gom danh sách event PHẲNG theo thời gian (đúng thứ tự ghi, dùng cho dữ liệu đọc từ Firestore ở
// StudentResultsPage) thành từng câu kèm `history` đầy đủ các lần thử — CÙNG HÌNH DẠNG dữ liệu với
// state `results` mà SceneRunner tự gom lúc học sinh đang làm bài (xem recordAttempt() ở đó).
export function groupIntoReportItems(events) {
  const map = new Map();
  for (const e of events) {
    const key = e.sceneIndex;
    if (key == null) continue;
    const prev = map.get(key);
    const history = prev ? [...prev.history, { attemptNumber: e.attemptNumber, result: e.result, recognizedText: e.recognizedText }] : [{ attemptNumber: e.attemptNumber, result: e.result, recognizedText: e.recognizedText }];
    map.set(key, {
      sceneIndex: key,
      sceneType: e.sceneType,
      examinerLine: e.examinerLine,
      attemptNumber: e.attemptNumber,
      result: e.result,
      recognizedText: e.recognizedText,
      history,
    });
  }
  return [...map.values()].sort((a, b) => a.sceneIndex - b.sceneIndex);
}

// items: mảng { sceneIndex, sceneType, examinerLine, result, recognizedText, history } — xem
// groupIntoReportItems()/recordAttempt() ở SceneRunner.jsx.
// showAudio + recordings: CHỈ truyền khi có audio thật để phát (màn học sinh) — bỏ trống ở màn
// giáo viên/admin vì không có quyền truy cập audio trên máy học sinh.
export function SpeakingReportView({ items, elapsedMs, showAudio = false, recordings = null }) {
  const [filter, setFilter] = useState("all"); // all | wrong
  const [expanded, setExpanded] = useState(() => new Set());

  function toggleExpanded(sceneIndex) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(sceneIndex)) next.delete(sceneIndex);
      else next.add(sceneIndex);
      return next;
    });
  }

  const correctCount = items.filter(r => r.result === "correct").length;
  const reviewCount = items.length - correctCount;
  const pct = items.length ? Math.round((correctCount / items.length) * 100) : 0;
  const tier = reviewTier(pct);
  const visibleItems = filter === "wrong" ? items.filter(r => r.result !== "correct") : items;

  return (
    <div className={`review-report ${tier.className}`}>
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
            <span className="review-stat-num">{items.length}</span>
            <span className="review-stat-label">Tổng số câu</span>
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
              <span><i className="review-legend-dot review-legend-hint" />Đã hiện đáp án</span>
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
              const recording = showAudio ? recordings?.find(rec => rec.sceneIndex === item.sceneIndex) : null;
              const meta = SCENE_TYPE_META[item.sceneType] ?? { label: item.sceneType, icon: "❓" };
              const isCorrect = item.result === "correct";
              const triedMultiple = item.history.length > 1;
              const isExpanded = expanded.has(item.sceneIndex);
              return (
                <div className={`review-item${isCorrect ? " is-correct" : " is-hint"}`} key={item.sceneIndex}>
                  <div className="review-item-status" aria-hidden="true">{isCorrect ? "✓" : "!"}</div>
                  <div className="review-item-body">
                    <div className="review-item-head">
                      <span className="review-item-type">{meta.icon} Câu {item.sceneIndex + 1} · {meta.label}</span>
                      <span className={isCorrect ? "review-badge-ok" : "review-badge-hint"}>
                        {isCorrect ? "Đúng" : "Đã hiện đáp án"}
                      </span>
                    </div>
                    <div className="review-item-question">{item.examinerLine}</div>
                    {item.recognizedText && (
                      <div className="review-item-said">Bé nói: "{item.recognizedText}"</div>
                    )}
                    {recording && <audio className="review-item-audio" controls src={URL.createObjectURL(recording.blob)} />}

                    {triedMultiple && (
                      <button className="review-history-toggle" onClick={() => toggleExpanded(item.sceneIndex)}>
                        🔁 Đã thử {item.history.length} lần — {isExpanded ? "ẩn quá trình làm bài ▲" : "xem quá trình làm bài ▼"}
                      </button>
                    )}
                    {triedMultiple && isExpanded && (
                      <ol className="review-history-list">
                        {item.history.map((h, i) => (
                          <li key={i} className={`review-history-row is-${h.result}`}>
                            <span className="review-history-icon">{ATTEMPT_ICON[h.result] ?? "•"}</span>
                            <span className="review-history-label">Lần {h.attemptNumber}</span>
                            {h.recognizedText && <span className="review-history-said">"{h.recognizedText}"</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
