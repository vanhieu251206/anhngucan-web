import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";

// Báo cáo QUÁ TRÌNH làm bài Speaking (chốt 2026-08-24) — 1 session = 1 lần học sinh (đã nhập họ
// tên) vào làm 1 bài Speaking, gồm nhiều "event" (mỗi lượt bấm mic/chọn thẻ/kéo-thả/chạm trong
// từng scene). CHƯA tính điểm số tổng (cơ chế điểm số sẽ làm sau, xem CLAUDE.md mục 6) — đây chỉ
// là log chi tiết để giáo viên/admin xem lại quá trình làm bài. Mọi lỗi ghi (mất mạng, rules
// chặn...) đều bị nuốt, KHÔNG được chặn luồng học của học sinh.

export async function startSpeakingSession({ studentName, seriesId, level, testId, lessonLabel, sceneCount }) {
  try {
    const ref = await addDoc(collection(db, "speakingSessions"), {
      studentName: studentName ?? null,
      seriesId: seriesId ?? null,
      level: level ?? null,
      testId: testId ?? null,
      lessonLabel: lessonLabel ?? null,
      sceneCount: sceneCount ?? null,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      finishedAt: null,
    });
    return ref.id;
  } catch {
    return null;
  }
}

export async function finishSpeakingSession(sessionId) {
  if (!sessionId) return;
  try {
    await updateDoc(doc(db, "speakingSessions", sessionId), {
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Không chặn luồng học nếu ghi lỗi.
  }
}

export async function logSpeakingEvent(sessionId, { sceneIndex, sceneType, examinerLine, attemptNumber, result, recognizedText }) {
  if (!sessionId) return;
  try {
    await addDoc(collection(db, "speakingSessions", sessionId, "events"), {
      sceneIndex: sceneIndex ?? null,
      sceneType: sceneType ?? null,
      examinerLine: examinerLine ?? null,
      attemptNumber: attemptNumber ?? null,
      result: result ?? null, // "correct" | "wrong" | "revealed"
      recognizedText: recognizedText ?? null,
      createdAt: serverTimestamp(),
    });
    // Cập nhật updatedAt của session để danh sách "mới nhất trên cùng" phản ánh đúng hoạt động
    // gần nhất, không chỉ lúc bắt đầu bài.
    await updateDoc(doc(db, "speakingSessions", sessionId), { updatedAt: serverTimestamp() });
  } catch {
    // Không chặn luồng học nếu ghi lỗi.
  }
}
