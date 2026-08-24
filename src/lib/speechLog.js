import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

// Ghi log THUẦN TEXT (không lưu file âm thanh) mỗi lượt học sinh bấm mic trả lời — dùng để sau
// này phân tích các lỗi phát âm/nhận diện thường gặp của trẻ Việt Nam (vd cách phát âm ngoài đời
// giáo viên chấp nhận nhưng AssemblyAI nghe lệch), từ đó tinh chỉnh lại ngưỡng chấm
// (fuzzyIncludesWord trong speech.js) — không phải để chấm điểm học sinh, chỉ phục vụ phân tích.
// Ghi công khai kể cả guest (không có tài khoản) nên KHÔNG được chặn luồng học nếu lỗi (mất mạng,
// rules chặn...) — luôn nuốt lỗi, không throw.
export async function logSpeechAttempt({
  lessonId,
  sceneIndex,
  examinerLine,
  expectedSentence,
  saidText,
  attemptNumber,
  correct,
}) {
  try {
    await addDoc(collection(db, "speechLogs"), {
      lessonId: lessonId ?? null,
      sceneIndex: sceneIndex ?? null,
      examinerLine: examinerLine ?? null,
      expectedSentence: expectedSentence ?? null,
      saidText: saidText ?? "",
      attemptNumber: attemptNumber ?? null,
      correct: Boolean(correct),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Không chặn luồng học nếu ghi log lỗi — đây chỉ là dữ liệu phân tích, không phải chấm điểm.
  }
}
