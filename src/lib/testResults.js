import { collection, doc, getDocs, query, where, writeBatch, Timestamp } from "firebase/firestore";
import { db } from "./firebase.js";

// Kết quả CHI TIẾT từng câu của 1 lượt nộp bài (mọi dạng bài). Học sinh chỉ thấy số câu đúng/tổng
// (components/TestScoreReport.jsx); phần chi tiết (câu trả lời của em, đáp án đúng) lưu ở đây CHỈ để giáo viên/admin
// xem lại. Kết quả do Worker chấm + ghi khi học sinh nộp bài (worker/src/submit.js, lib/testSubmit.js, 2026-09-25) —
// trình duyệt không tự ghi nữa (firestore.rules chặn).
// items: mảng tuỳ ý theo từng dạng bài (question/studentAnswer/correctAnswer/isCorrect...).
//
// THỜI HẠN LƯU (chốt 2026-09-25): kết quả chỉ tồn tại từ lúc nộp tới HẾT 48 GIỜ SAU HẠN CHÓT của lần mở bài, sau đó
// bị XOÁ HẲN (cả admin cũng không xem lại được) để không vượt hạn mức lưu trữ free của Firestore. Không có server
// chạy định kỳ (gói Spark, không Cloud Functions) nên việc xoá chạy phía trình duyệt mỗi khi admin/giáo viên mở khu
// vực quản trị — xem purgeExpiredResults().
export const RESULT_KEEP_MS = 48 * 60 * 60 * 1000;

export const RESULT_MODE_LABEL = {
  speaking: "Speaking",
  reading: "Reading & Writing",
  dictation: "Dictation",
  "listening-exam": "Listening",
  "ielts-reading": "IELTS Reading",
  "ielts-listening": "IELTS Listening",
  "ketpet-vocab": "KET/PET Vocabulary",
  "ketpet-test": "KET/PET Practice Test",
};

// Mọi lượt nộp của 1 lần mở bài (tải phiếu chấm cả lớp — lib/resultSheetPdf.js).
export async function listResultsForOpening(openingId) {
  const snap = await getDocs(query(collection(db, "testResults"), where("openingId", "==", openingId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Mốc xoá hiệu lực của 1 kết quả: nếu lần mở bài được GIA HẠN sau khi nộp thì lùi theo hạn chót mới.
function effectivePurgeMs(r, deadlines) {
  const stored = r.purgeAfter?.toMillis?.();
  // Kết quả cũ (trước 2026-09-25, không có purgeAfter): 48h kể từ lúc nộp.
  const fallback = (r.submittedAt?.toMillis?.() ?? Date.now()) + RESULT_KEEP_MS;
  const deadline = r.openingId ? deadlines.get(r.openingId) : null;
  return Math.max(stored ?? fallback, deadline ? deadline + RESULT_KEEP_MS : 0);
}

export function isResultVisible(r, deadlines = new Map()) {
  return effectivePurgeMs(r, deadlines) > Date.now();
}

async function loadDeadlines() {
  const snap = await getDocs(collection(db, "openings"));
  return new Map(snap.docs.map(d => [d.id, d.data().expiresAt?.toMillis?.() ?? null]));
}

let purging = null;

// Xoá hẳn các kết quả đã quá mốc + phiên Speaking (speakingSessions + events) đi kèm. Chạy tối đa 1 lần cùng lúc;
// lỗi (mất mạng, rules chưa publish...) bị nuốt — lần mở quản trị sau sẽ dọn tiếp. Trả về số kết quả đã xoá.
export function purgeExpiredResults() {
  purging ??= (async () => {
    try {
      const now = Date.now();
      const cutoff = Timestamp.fromMillis(now - RESULT_KEEP_MS);
      // Ứng viên: đã quá purgeAfter, HOẶC kết quả cũ không có purgeAfter nộp trước mốc 48h.
      const [byPurge, bySubmit, deadlines] = await Promise.all([
        getDocs(query(collection(db, "testResults"), where("purgeAfter", "<=", Timestamp.fromMillis(now)))),
        getDocs(query(collection(db, "testResults"), where("submittedAt", "<=", cutoff))),
        loadDeadlines(),
      ]);
      const candidates = new Map();
      [...byPurge.docs, ...bySubmit.docs].forEach(d => candidates.set(d.id, d));
      const expired = [...candidates.values()].filter(d => !isResultVisible(d.data(), deadlines));

      // Phiên Speaking: của kết quả sắp xoá + phiên cũ không có kết quả (bỏ dở) không cập nhật quá 48h.
      const sessionIds = new Set(expired.map(d => d.data().sessionId).filter(Boolean));
      const staleSessions = await getDocs(query(collection(db, "speakingSessions"), where("updatedAt", "<=", cutoff)));
      const staleIds = staleSessions.docs.map(d => d.id).filter(id => !sessionIds.has(id));
      // Giữ phiên còn gắn với 1 kết quả CHƯA hết hạn (hạn chót của bài còn xa).
      const keep = new Set();
      for (let i = 0; i < staleIds.length; i += 30) {
        const linked = await getDocs(query(collection(db, "testResults"), where("sessionId", "in", staleIds.slice(i, i + 30))));
        linked.docs.forEach(d => {
          if (isResultVisible(d.data(), deadlines)) keep.add(d.data().sessionId);
        });
      }
      staleIds.filter(id => !keep.has(id)).forEach(id => sessionIds.add(id));

      const refs = expired.map(d => d.ref);
      for (const id of sessionIds) {
        const events = await getDocs(collection(db, "speakingSessions", id, "events"));
        events.docs.forEach(e => refs.push(e.ref));
        refs.push(doc(db, "speakingSessions", id));
      }
      // writeBatch tối đa 500 thao tác/lần.
      for (let i = 0; i < refs.length; i += 450) {
        const batch = writeBatch(db);
        refs.slice(i, i + 450).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      return expired.length;
    } catch {
      return 0;
    } finally {
      purging = null;
    }
  })();
  return purging;
}

export { loadDeadlines as loadOpeningDeadlines };
