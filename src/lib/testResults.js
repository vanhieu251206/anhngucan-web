import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { isHistoryDisabled } from "./historyGuard.js";

// Kết quả CHI TIẾT từng câu của 1 lượt nộp bài (mọi dạng bài trừ Speaking — Speaking đã có log riêng ở
// speakingSessions.js). Học sinh chỉ thấy số câu đúng/tổng (components/TestScoreReport.jsx); phần chi tiết
// (câu trả lời của em, đáp án đúng) lưu ở đây CHỈ để giáo viên/admin xem lại. Mọi lỗi ghi đều bị nuốt để
// không chặn luồng nộp bài của học sinh.
// items: mảng tuỳ ý theo từng dạng bài (question/studentAnswer/correctAnswer/isCorrect...).
export async function saveTestResult({
  mode, seriesId, level, testId, lessonLabel, studentName, studentClass, uid, correct, total, elapsedMs, items,
}) {
  if (isHistoryDisabled()) return;
  try {
    await addDoc(collection(db, "testResults"), {
      mode: mode ?? null,
      seriesId: seriesId ?? null,
      level: level ?? null,
      testId: testId ?? null,
      lessonLabel: lessonLabel ?? null,
      studentName: studentName ?? null,
      studentClass: studentClass ?? null,
      uid: uid ?? null,
      correct: correct ?? 0,
      total: total ?? 0,
      elapsedMs: elapsedMs ?? null,
      // JSON round-trip: Firestore từ chối giá trị undefined/hàm nằm trong dữ liệu lồng nhau.
      items: JSON.parse(JSON.stringify(items ?? [])),
      submittedAt: serverTimestamp(),
    });
  } catch {
    // Không chặn luồng học nếu ghi lỗi.
  }
}
