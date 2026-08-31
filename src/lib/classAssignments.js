import { doc, setDoc, deleteDoc, getDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

// "Giao bài cho lớp" (chốt 2026-08-27) — giáo viên phải chủ động MỞ đúng 1 bài (Listening/
// Speaking/Reading) cho 1 lớp thì học sinh lớp đó mới vào làm được, dù đã có tài khoản đăng nhập.
// Mỗi lớp chỉ có ĐÚNG 1 bài đang mở tại 1 thời điểm (giống việc lớp đang học 1 bài cụ thể trong
// buổi học đó) — đơn giản hơn nhiều so với bật/tắt từng ô cho từng bài, dễ thao tác cho giáo viên
// không rành công nghệ (chỉ cần chọn lớp → chọn bài → bấm "Mở"). 1 doc/lớp, doc không tồn tại =
// lớp đó chưa được mở bài nào.
export async function getClassAssignment(className) {
  if (!className) return null;
  const snap = await getDoc(doc(db, "classAssignments", className));
  return snap.exists() ? snap.data() : null;
}

export async function listClassAssignments() {
  const snap = await getDocs(collection(db, "classAssignments"));
  return snap.docs.map(d => ({ className: d.id, ...d.data() }));
}

// expiresAt: mốc thời gian TỰ ĐỘNG hết hạn mở bài (Date hoặc null = không hết hạn, giáo viên phải
// tự bấm "Đóng") — chốt 2026-08-27, kiểm tra client-side lúc học sinh bấm vào bài (LessonsPage.jsx),
// KHÔNG có cron/Cloud Functions tự xoá doc khi hết hạn (Spark plan không có Cloud Functions).
// maxAttempts: số lượt làm RIÊNG cho lần mở bài này, ghi đè `test.maxAttempts` mặc định của cả
// Test (null = dùng đúng số lượt mặc định của Test, không ghi đè).
export async function setClassAssignment(className, { seriesId, level, mode, testId, testTitle, expiresAt, maxAttempts }, uid) {
  await setDoc(doc(db, "classAssignments", className), {
    seriesId,
    level,
    mode,
    testId: testId ?? null,
    testTitle: testTitle ?? null,
    expiresAt: expiresAt ?? null,
    maxAttempts: maxAttempts ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function clearClassAssignment(className) {
  await deleteDoc(doc(db, "classAssignments", className));
}
