// Chấm lại TOÀN BỘ kết quả còn lưu theo đáp án hiện tại (2026-10-05, chỉ admin — nút ở trang Kết quả học sinh). Dùng sau
// khi giáo viên sửa/thêm đáp án: trình duyệt gom danh sách các bài đang có kết quả, rồi gọi Worker chấm lại từng bài
// (worker/src/submit.js → regradeTest; trình duyệt không được ghi testResults/attempts). Chỉ các dạng Worker tự chấm;
// Speaking, Dictation và Part tô màu/nối tranh của Listening giữ nguyên điểm.
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase.js";
import { callWorker } from "./testSubmit.js";
import { SERVER_GRADED } from "./grading/index.js";

// onProgress({ done, tests, checked, changed, skipped, failed }) sau mỗi bài.
export async function regradeAllResults(onProgress) {
  const snap = await getDocs(collection(db, "testResults"));
  const tests = new Map();
  snap.docs.forEach(d => {
    const r = d.data();
    if (!SERVER_GRADED.has(r.mode) || r.testId == null || !r.seriesId || r.level == null) return;
    tests.set(`${r.mode}|${r.seriesId}|${r.level}|${r.testId}`, { kind: r.mode, seriesId: r.seriesId, level: r.level, testId: r.testId });
  });

  const stats = { done: 0, tests: tests.size, checked: 0, changed: 0, skipped: 0, failed: 0 };
  onProgress?.({ ...stats });
  for (const test of tests.values()) {
    try {
      const res = await callWorker("/admin/regrade", test);
      stats.checked += res.checked ?? 0;
      stats.changed += res.changed ?? 0;
      stats.skipped += res.skipped ?? 0;
    } catch {
      stats.failed += 1; // đề đã bị xoá, mất mạng... — bài khác vẫn chấm tiếp
    }
    stats.done += 1;
    onProgress?.({ ...stats });
  }
  return stats;
}
