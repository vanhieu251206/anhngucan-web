import { useSyncExternalStore } from "react";
import { subscribeRetryRound, getRetryRoundState, setRetryRoundOpen, groupWrongQuestions } from "../lib/retryRound.js";

// Bài có yêu cầu "sai tối đa N câu mới được nộp" (lib/retryRound.js) — gắn 1 lần ở main.jsx, hiện đè lên mọi màn
// làm bài. Nộp mà chưa đạt: hộp báo số câu đúng + các câu chưa đúng (không có đáp án); đóng hộp thì còn 1 nút nhỏ
// ở góc để mở lại danh sách câu sai trong lúc sửa bài.
export default function RetryRoundOverlay() {
  const { round } = useSyncExternalStore(subscribeRetryRound, getRetryRoundState);
  if (!round) return null;

  if (!round.open) {
    return (
      <button type="button" className="retry-round-pill" onClick={() => setRetryRoundOpen(true)}>
        ❗ {round.wrong.length} câu chưa đúng
      </button>
    );
  }

  const groups = groupWrongQuestions(round.wrong);
  return (
    <div className="exam-focus-overlay" role="alertdialog" aria-modal="true">
      <div className="exam-focus-dialog retry-round-dialog">
        <h2>Con đúng {round.correct}/{round.total}</h2>
        <p>Còn <strong>{round.wrong.length}</strong> câu chưa đúng:</p>
        <ul className="retry-round-list">
          {groups.map(g => (
            <li key={g.heading}>
              {g.heading && <strong>{g.heading}: </strong>}
              câu {g.numbers.join(", ")}
            </li>
          ))}
        </ul>
        <p>Con sửa lại rồi nộp tiếp nhé — được sai nhiều nhất <strong>{round.maxWrong}</strong> câu.</p>
        <button type="button" className="btn btn-primary" onClick={() => setRetryRoundOpen(false)}>Sửa bài</button>
      </div>
    </div>
  );
}
