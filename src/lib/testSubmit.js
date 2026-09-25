// Nộp bài qua Worker (chốt 2026-09-25, "sửa tận gốc") — học sinh KHÔNG tự ghi kết quả/số lượt vào Firestore nữa
// (rules chặn). Worker (worker/src/submit.js) kiểm tra lớp/lần mở bài/hạn chót/số lượt/thời gian theo giờ máy chủ, tự
// chấm từ câu trả lời thô (đáp án học sinh không đọc được), ghi kết quả + cộng lượt, rồi trả điểm về.
import { useCallback, useEffect, useRef } from "react";
import { auth } from "./firebase.js";

const WORKER_URL = import.meta.env.VITE_WORKER_URL;
const MAX_TRIES = 3;

async function callWorker(path, body) {
  if (!WORKER_URL) throw new Error("worker-not-configured");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("not-signed-in");
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `http-${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Lỗi tạm thời (mất mạng, máy chủ quá tải) — đáng thử lại. Lỗi 4xx (hết hạn, hết lượt...) thử lại cũng vậy.
function isRetryable(err) {
  return err instanceof TypeError || err?.status == null || err.status === 429 || err.status >= 500;
}

// Thông báo lỗi nộp bài dễ hiểu cho học sinh.
export function describeSubmitError(err) {
  const code = err?.message;
  if (code === "expired") return "Bài đã hết hạn nộp — hỏi giáo viên nhé.";
  if (code === "no-attempts") return "Con đã dùng hết lượt làm bài này.";
  if (code === "not-opened") return "Bài này chưa được mở cho lớp của con.";
  if (code === "not-signed-in" || err?.status === 401) return "Phiên đăng nhập đã hết hạn — tải lại trang rồi nộp lại nhé.";
  return "Chưa nộp được bài (mạng yếu?) — con bấm Nộp lại nhé, bài làm vẫn còn nguyên.";
}

// Hook dùng trong mọi trang làm bài. Học sinh (có openingId): tự ghi giờ bắt đầu ở máy chủ ngay khi vào bài (đổi
// `resetKey` = làm lượt mới). `submit({ answers, client, sessionId, elapsedMs })` → { correct, total, parts? }.
//   answers: câu trả lời thô (dạng Worker tự chấm)   client: { correct, total, items } (dạng chấm ở trình duyệt)
export function useTestSubmission({ kind, seriesId, level, testId, openingId, lessonLabel, studentName, resetKey }) {
  const startRef = useRef(null);
  const meta = { kind, seriesId, level, testId: testId == null ? testId : String(testId), openingId: openingId ?? null };

  useEffect(() => {
    startRef.current = openingId
      ? callWorker("/test/start", meta).catch(() => ({ startId: null })) // lỗi mạng lúc vào bài: vẫn cho làm
      : Promise.resolve({ startId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, seriesId, level, testId, openingId, resetKey]);

  return useCallback(
    async ({ answers, client, sessionId, elapsedMs } = {}) => {
      const { startId } = (await startRef.current) ?? {};
      const body = { ...meta, startId, answers, client, sessionId: sessionId ?? null, elapsedMs, lessonLabel, studentName };
      let lastErr;
      for (let i = 0; i < MAX_TRIES; i++) {
        try {
          return await callWorker("/test/submit", body);
        } catch (err) {
          lastErr = err;
          if (!isRetryable(err)) break;
          await new Promise(r => setTimeout(r, 800 * (i + 1)));
        }
      }
      throw lastErr;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, seriesId, level, testId, openingId, lessonLabel, studentName],
  );
}
