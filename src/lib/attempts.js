import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

// Đếm số lượt học sinh đã NỘP BÀI 1 Test (Speaking/Reading) — dùng để chặn khi chạm
// `test.maxAttempts` (đặt riêng từng Test trong CMS, xem CreateLessonPage.jsx). 1 doc riêng cho
// mỗi (học sinh, chế độ, Test), khác `speakingSessions` (log từng lần bắt đầu, không phải bộ đếm).
function attemptDocId(uid, mode, testId) {
  return `${uid}_${mode}_${testId}`;
}

// Số lượt + điểm tóm tắt (lastCorrect/bestCorrect/total — Worker ghi từ 2026-09-30, bài nộp trước đó chưa có).
export async function getAttemptInfo(uid, mode, testId) {
  const snap = await getDoc(doc(db, "attempts", attemptDocId(uid, mode, testId)));
  const d = snap.exists() ? snap.data() : {};
  return { count: d.count ?? 0, lastCorrect: d.lastCorrect ?? null, bestCorrect: d.bestCorrect ?? null, total: d.total ?? null };
}

export async function getAttemptCount(uid, mode, testId) {
  const snap = await getDoc(doc(db, "attempts", attemptDocId(uid, mode, testId)));
  return snap.exists() ? snap.data().count ?? 0 : 0;
}

// Cộng lượt do Worker làm khi học sinh nộp bài (worker/src/submit.js, 2026-09-25) — trình duyệt không tự ghi nữa.
