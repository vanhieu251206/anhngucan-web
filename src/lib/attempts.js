import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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

// Học sinh đã nộp của nhiều lần mở bài cùng lúc (trang Tổng quan) → Map<khoá lượt "testId@openingId", Set<uid>>.
// Truy vấn `in` tối đa 30 giá trị/lần.
export async function listSubmittedUids(keys) {
  const map = new Map(keys.map(k => [k, new Set()]));
  for (let i = 0; i < keys.length; i += 30) {
    const snap = await getDocs(query(collection(db, "attempts"), where("testId", "in", keys.slice(i, i + 30))));
    snap.docs.forEach(d => {
      const a = d.data();
      if (a.uid) map.get(a.testId)?.add(a.uid);
    });
  }
  return map;
}

// Cộng lượt do Worker làm khi học sinh nộp bài (worker/src/submit.js, 2026-09-25) — trình duyệt không tự ghi nữa.
