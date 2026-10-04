// "Sai tối đa N câu mới được nộp" (2026-10-05, yêu cầu của cô — bật theo từng lần mở bài, ô "Sai tối đa" ở trang
// Mở bài): học sinh nộp mà còn sai nhiều hơn N câu thì máy chủ CHƯA nhận bài, chỉ trả về điểm + danh sách câu sai
// (không kèm đáp án — worker/src/submit.js). Kho trạng thái dùng chung này giữ thông tin vòng vừa nộp để
// RetryRoundOverlay.jsx (gắn 1 lần ở main.jsx) hiện đè lên MỌI màn làm bài, không phải sửa giao diện từng dạng bài.
import { toRoman } from "./ketPetPracticeTest.js";

// round: { correct, total, maxWrong, round, wrong: [{ section, group, qNumber }], open } — vòng vừa nộp chưa đạt.
// final: { correct, total } — điểm lúc bài được nhận, để màn "Nộp bài thành công" hiện tổng câu đúng.
let state = { round: null, final: null };
const listeners = new Set();

function set(next) {
  state = next;
  listeners.forEach(fn => fn());
}

export function subscribeRetryRound(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getRetryRoundState() {
  return state;
}

export function showRetryRound(res) {
  set({ round: { correct: res.correct, total: res.total, maxWrong: res.maxWrong, round: res.round, wrong: res.wrong ?? [], open: true }, final: null });
}
export function setRetryRoundOpen(open) {
  if (state.round) set({ ...state, round: { ...state.round, open } });
}
export function finishRetryRound(final) {
  set({ round: null, final: final ?? null });
}
export function clearRetryRound() {
  if (state.round || state.final) set({ round: null, final: null });
}

// Gom câu sai theo phần để đọc cho dễ: [{ heading: "Part 2" | "Phần II" | "", numbers: [1, 3] }].
export function groupWrongQuestions(wrong) {
  const groups = [];
  (wrong ?? []).forEach(w => {
    const heading = w.section || (w.group ? `Phần ${toRoman(w.group)}` : "");
    let g = groups.find(x => x.heading === heading);
    if (!g) groups.push((g = { heading, numbers: [] }));
    if (w.qNumber != null && !g.numbers.includes(w.qNumber)) g.numbers.push(w.qNumber);
  });
  return groups;
}
