// Đọc/ghi đề bài KÈM kho đáp án tách riêng (answerKeys — xem lib/grading/answerKeys.js, chốt 2026-09-25).
// - Lưu (CMS): tách đáp án khỏi đề, ghi đề + khoá trong CÙNG 1 writeBatch.
// - Đọc: CHỈ admin/giáo viên/tài khoản đặc biệt được ghép đáp án lại (rules chặn học sinh đọc answerKeys) — cờ
//   `canReadAnswers` do AuthProvider bật theo role, giống cách historyGuard.js làm cho tài khoản đặc biệt.
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { answerKeyDocId, answerKind, mergeAnswers, parseEntries, splitAnswers } from "./grading/answerKeys.js";

let canRead = false;

export function setAnswerAccess(value) {
  canRead = Boolean(value);
}

export function canReadAnswers() {
  return canRead;
}

// Ghép đáp án vào 1 đề (data có `id`). Học sinh / đề chưa tách: trả nguyên. Lỗi đọc khoá: trả đề không đáp án.
export async function withAnswers(lessonId, collectionName, data) {
  if (!canRead || !data?.answersSplit) return data;
  const kind = answerKind(collectionName, lessonId);
  try {
    const snap = await getDoc(doc(db, "answerKeys", answerKeyDocId(lessonId, collectionName, data.id)));
    // restoreOrder: CMS cần thứ tự gốc của nhóm "sắp xếp thứ tự" KET/PET; bộ chấm ở trình duyệt chấm được cả 2 kiểu.
    return snap.exists() ? mergeAnswers(kind, data, parseEntries(snap.data()), { restoreOrder: true }) : data;
  } catch {
    return data;
  }
}

export function withAnswersAll(lessonId, collectionName, list) {
  return Promise.all(list.map(d => withAnswers(lessonId, collectionName, d)));
}

// Lưu đề: tách đáp án (nếu loại bài có đáp án) rồi ghi đề + khoá cùng lúc.
export async function saveWithAnswers(seriesId, lessonId, collectionName, docId, data, setOptions) {
  const kind = answerKind(collectionName, lessonId);
  const { data: publicData, entries } = kind ? splitAnswers(kind, data) : { data, entries: null };
  const batch = writeBatch(db);
  const ref = doc(db, "lessons", lessonId, collectionName, docId);
  if (setOptions) batch.set(ref, publicData, setOptions);
  else batch.set(ref, publicData);
  if (kind) {
    batch.set(doc(db, "answerKeys", answerKeyDocId(lessonId, collectionName, docId)), {
      seriesId,
      lessonId,
      collection: collectionName,
      docId,
      entries: JSON.stringify(entries),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// Xoá đề + khoá đáp án đi kèm.
export async function deleteWithAnswers(lessonId, collectionName, docId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "lessons", lessonId, collectionName, docId));
  if (answerKind(collectionName, lessonId)) batch.delete(doc(db, "answerKeys", answerKeyDocId(lessonId, collectionName, docId)));
  await batch.commit();
}
