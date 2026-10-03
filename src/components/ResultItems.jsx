import { Fragment } from "react";
import { SpeakingReportView } from "./SpeakingReportView.jsx";

// " · 4/5" của 1 Part — bỏ qua câu không chấm; Part không có câu nào chấm được thì không ghi số.
export function sectionScore(items, section) {
  const graded = items.filter(it => it.section === section && !it.ungraded);
  return graded.length ? ` · ${graded.filter(it => it.isCorrect).length}/${graded.length}` : " ";
}

// Chi tiết từng câu của 1 lượt nộp (testResults.items) — dùng chung cho giáo viên (StudentResultsPage.jsx) và học sinh
// xem lại bài sau hạn chót (ResultReviewModal.jsx).
export default function ResultItems({ mode, items, elapsedMs, answerLabel = "Bé trả lời" }) {
  if (!items.length) return <p className="admin-muted-text">Không có chi tiết từng câu.</p>;

  // Speaking: dùng lại đúng màn tổng kết Speaking.
  if (mode === "speaking") {
    return (
      <div className="admin-report-panel">
        <SpeakingReportView items={items} elapsedMs={elapsedMs} />
      </div>
    );
  }

  // Listening Luyện đề nộp trước 2026-10-03 chỉ lưu điểm từng Part.
  if (items[0]?.part) {
    return (
      <ul className="results-parts">
        {items.map((it, i) => (
          <li key={i}><strong>{it.part}</strong><span>{it.correct}/{it.total}</span></li>
        ))}
      </ul>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr><th>Câu</th><th></th><th>{answerLabel}</th><th>Đáp án đúng</th></tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const blanks = Array.isArray(it.blanks) ? it.blanks : null;
            // Bài chia Part (Listening luyện đề): dòng tiêu đề + số câu đúng của Part trước câu đầu tiên của Part đó.
            const head = it.section && it.section !== items[i - 1]?.section ? sectionScore(items, it.section) : null;
            return (
              <Fragment key={i}>
              {head && <tr className="results-section-row"><td colSpan={4}><strong>{it.section}</strong>{head}</td></tr>}
              <tr>
                <td>
                  <div>{it.group ? `${it.group}.${it.qNumber}` : it.qNumber ?? i + 1}</div>
                  {it.prompt && <div className="opening-test-kind">{it.prompt}</div>}
                </td>
                <td>{it.ungraded ? "—" : it.isCorrect ? <span className="opening-chip opening-chip-on">✓</span> : <span className="opening-chip opening-chip-off">✗</span>}</td>
                <td>{blanks ? blanks.map(b => b.studentAnswer).join(" · ") : it.studentAnswer || <em>(bỏ trống)</em>}</td>
                <td>{blanks ? blanks.map(b => b.correctAnswer).join(" · ") : it.correctAnswer || "—"}</td>
              </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
