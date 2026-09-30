import { useState } from "react";
import Header from "../components/Header.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { useAssignments } from "../lib/useAssignments.js";
import { useNextClass } from "../lib/useNextClass.js";
import { deadlineInfo, kindLabel, levelLabel, openAssignment, scoreText } from "../lib/assignmentUtils.js";
import ResultReviewModal from "../components/ResultReviewModal.jsx";

// Trang "Bài của con" (học sinh, 2026-09-30): toàn bộ bài giáo viên mở cho lớp, chia 3 tab.
//   Cần làm: còn hạn, chưa nộp lượt nào — hạn gần nhất lên đầu
//   Đã nộp:  còn hạn, đã nộp ≥ 1 lượt (làm lại được nếu còn lượt)
//   Quá hạn: mọi bài đã hết hạn (nộp hay chưa) — tới khi giáo viên Đóng bài
// Điểm/đáp án CHỈ hiện SAU hạn chót (chốt 2026-09-30): tab Đã nộp chỉ ghi "Xem kết quả sau hạn chót". Quá hạn: điểm
// tóm tắt (doc attempts, giữ lâu dài) + nút "Xem bài" chi tiết trong 48h sau hạn chót (ResultReviewModal.jsx).
const REVIEW_KEEP_MS = 48 * 3600 * 1000;
const TABS = [
  { key: "todo", label: "Cần làm" },
  { key: "done", label: "Đã nộp" },
  { key: "expired", label: "Quá hạn" },
];

function WorkRow({ o, row, now, tab, onReview }) {
  const dl = deadlineInfo(o, now);
  const count = row?.count ?? 0;
  const best = scoreText(row?.bestCorrect, row?.total);
  const canReview = tab === "expired" && count > 0 && now < (o.expiresAt?.toMillis?.() ?? 0) + REVIEW_KEEP_MS;
  const attemptsLeft = o.maxAttempts ? o.maxAttempts - count : null;
  const canRedo = tab === "done" && (attemptsLeft == null || attemptsLeft > 0);

  return (
    <li className="work-row">
      <div className="work-row-main">
        <span className="work-row-title">{o.testTitle || o.testId}</span>
        <span className="work-row-meta">{levelLabel(o)} · {kindLabel(o)}</span>
        <span className={`work-row-deadline${tab !== "expired" && dl.urgent ? " is-urgent" : ""}`}>
          {tab === "expired" ? "Đã hết hạn" : "Hạn"} {dl.text}
          {tab !== "expired" && dl.left && <strong> · {dl.left}</strong>}
        </span>
      </div>

      <div className="work-row-side">
        {tab === "todo" && (
          <>
            {o.maxAttempts && <span className="work-row-note">{o.maxAttempts} lượt</span>}
            <button type="button" className="btn btn-primary work-row-btn" onClick={() => openAssignment(o)}>Làm bài</button>
          </>
        )}
        {tab === "done" && (
          <>
            <span className="work-row-score">
              Đã nộp {count} lượt
              <small>Xem kết quả sau hạn chót</small>
            </span>
            {canRedo ? (
              <button type="button" className="btn btn-secondary work-row-btn" onClick={() => openAssignment(o)}>
                Làm lại{attemptsLeft != null ? ` (còn ${attemptsLeft})` : ""}
              </button>
            ) : (
              <span className="assign-chip is-done">Hết lượt</span>
            )}
          </>
        )}
        {tab === "expired" &&
          (count > 0 ? (
            <>
              <span className="work-row-score">
                {best ? <>Điểm <strong>{best}</strong></> : <>Đã nộp</>}
                <small>{count > 1 ? `Cao nhất · ${count} lượt` : "1 lượt"}</small>
              </span>
              {canReview && (
                <button type="button" className="btn btn-primary work-row-btn" onClick={() => onReview(o)}>Xem bài</button>
              )}
            </>
          ) : (
            <span className="assign-chip is-missed">Không nộp</span>
          ))}
      </div>
    </li>
  );
}

export default function MyWorkPage({ onNavigate }) {
  const { isStudent } = useAuth();
  const { active, expired, info, now } = useAssignments();
  const nextClass = useNextClass();
  const [tab, setTab] = useState("todo");
  const [reviewing, setReviewing] = useState(null);

  const lists = {
    todo: active.filter(o => (info[o.id]?.count ?? 0) === 0),
    done: active.filter(o => (info[o.id]?.count ?? 0) > 0),
    expired,
  };
  const list = lists[tab];

  return (
    <div className="home-v2 lessons-screen-v2">
      <Header page="my-work" onNavigate={onNavigate} />

      <div className="dark-hero-band dark-hero-band-sm">
        <div className="dark-hero-inner dark-hero-inner-row">
          <div className="dark-hero-text dark-hero-text-row">
            <button className="lesson-back-link" onClick={() => onNavigate("home")}>⬅ Trang chủ</button>
            <div className="dark-hero-titles">
              <h1 className="dark-hero-title">Bài của con</h1>
              {nextClass && (
                <p className="dark-hero-subtitle">
                  Buổi học tiếp theo: {nextClass.when}{nextClass.left ? ` (${nextClass.left})` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid-section work-section">
        {!isStudent ? (
          <p className="work-empty">Trang này dành cho tài khoản học sinh.</p>
        ) : (
          <div className="work-panel">
            <div className="work-tabs" role="tablist">
              {TABS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`work-tab${tab === t.key ? " is-active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  <span className="work-tab-count">{lists[t.key].length}</span>
                </button>
              ))}
            </div>

            {list.length === 0 ? (
              <p className="work-empty">
                {tab === "todo" ? "Con đã làm hết bài rồi 🎉" : tab === "done" ? "Chưa có bài nào đã nộp." : "Không có bài quá hạn."}
              </p>
            ) : (
              <ul className="work-list">
                {list.map(o => (
                  <WorkRow key={o.id} o={o} row={info[o.id]} now={now} tab={tab} onReview={setReviewing} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {reviewing && <ResultReviewModal opening={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}
