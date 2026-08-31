import { doc, getDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

// Đếm số lượt học sinh đã NỘP BÀI 1 Test (Speaking/Reading) — dùng để chặn khi chạm
// `test.maxAttempts` (đặt riêng từng Test trong CMS, xem CreateLessonPage.jsx). 1 doc riêng cho
// mỗi (học sinh, chế độ, Test), khác `speakingSessions` (log từng lần bắt đầu, không phải bộ đếm).
function attemptDocId(uid, mode, testId) {
  return `${uid}_${mode}_${testId}`;
}

export async function getAttemptCount(uid, mode, testId) {
  const snap = await getDoc(doc(db, "attempts", attemptDocId(uid, mode, testId)));
  return snap.exists() ? snap.data().count ?? 0 : 0;
}

// increment(1) là atomic ở cấp Firestore — không cần đọc trước/transaction để +1 an toàn dù
// nhiều tab cùng nộp (hiếm nhưng an toàn hơn). Firestore Rules bắt buộc mỗi lần ghi chỉ được
// tăng ĐÚNG +1 trên đúng doc của chính uid đó (xem firestore.rules).
export async function incrementAttempt({ uid, mode, testId, seriesId, level }) {
  await setDoc(
    doc(db, "attempts", attemptDocId(uid, mode, testId)),
    { uid, mode, testId, seriesId, level, count: increment(1), updatedAt: serverTimestamp() },
    { merge: true }
  );
}
