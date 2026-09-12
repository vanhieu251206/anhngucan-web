import { doc, setDoc, deleteDoc, getDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

function lessonId(seriesId, level) {
  return `${seriesId}-${level}`;
}

// videos: { videoId, title }[] — cho phép nhúng nhiều video/bài nghe trong 1 cấp độ.
export async function saveListening(seriesId, level, videos, uid) {
  await setDoc(
    doc(db, "lessons", lessonId(seriesId, level)),
    { seriesId, level, listening: videos, updatedAt: serverTimestamp(), updatedBy: uid },
    { merge: true }
  );
}

export async function getListening(seriesId, level) {
  const snap = await getDoc(doc(db, "lessons", lessonId(seriesId, level)));
  if (!snap.exists()) return null;
  const listening = snap.data().listening ?? null;
  if (!listening) return null;
  // Chuẩn hoá dữ liệu cũ (1 object đơn) thành mảng.
  return Array.isArray(listening) ? listening : [listening];
}

export async function listTests(seriesId, level) {
  const snap = await getDocs(collection(db, "lessons", lessonId(seriesId, level), "tests"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getTest(seriesId, level, testId) {
  const snap = await getDoc(doc(db, "lessons", lessonId(seriesId, level), "tests", testId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// scenes PHẢI đã resolve hết ảnh/audio thành URL đầy đủ (Storage download URL) trước khi gọi
// hàm này — đúng contract SceneRunner.jsx đang đọc, không lưu File/blob URL tạm vào Firestore.
export async function saveTest(seriesId, level, testId, { title, order, scenes, maxAttempts }, uid) {
  await setDoc(doc(db, "lessons", lessonId(seriesId, level), "tests", testId), {
    testId,
    title,
    order,
    scenes,
    maxAttempts: maxAttempts ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function deleteTest(seriesId, level, testId) {
  await deleteDoc(doc(db, "lessons", lessonId(seriesId, level), "tests", testId));
}

// Reading & Writing — cấu trúc tương tự Speaking (subcollection riêng "readingTests" trong cùng
// 1 doc lesson), nhưng mỗi Test chứa `parts` (Part 1/2/3...), mỗi Part chứa `questions` (nhiều loại
// tuỳ series — xem QUESTION_TYPES trong ReadingStudio.jsx) thay vì `scenes`, và có thể có thêm
// `wordBank` (ngân hàng từ dùng chung cho các câu "word-bank" trong Part, chỉ Movers trở lên).
export async function listReadingTests(seriesId, level) {
  const snap = await getDocs(collection(db, "lessons", lessonId(seriesId, level), "readingTests"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getReadingTest(seriesId, level, testId) {
  const snap = await getDoc(doc(db, "lessons", lessonId(seriesId, level), "readingTests", testId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// parts PHẢI đã resolve hết ảnh thành URL đầy đủ (Cloudinary) trước khi gọi hàm này, giống saveTest.
export async function saveReadingTest(seriesId, level, testId, { title, order, parts, maxAttempts }, uid) {
  await setDoc(doc(db, "lessons", lessonId(seriesId, level), "readingTests", testId), {
    testId,
    title,
    order,
    parts,
    maxAttempts: maxAttempts ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function deleteReadingTest(seriesId, level, testId) {
  await deleteDoc(doc(db, "lessons", lessonId(seriesId, level), "readingTests", testId));
}

// Dictation (Nghe & gõ lại) — cấu trúc tương tự Reading/Speaking (subcollection riêng "dictationTests"
// trong cùng 1 doc lesson), mỗi Test chứa `sentences: [{ text, audioUrl }]`, phát từng câu 1 rồi học
// sinh gõ lại đúng câu vừa nghe (không phải audio gốc sách có bản quyền — audio tự thu/TTS do giáo
// viên upload qua Cloudinary).
export async function listDictationTests(seriesId, level) {
  const snap = await getDocs(collection(db, "lessons", lessonId(seriesId, level), "dictationTests"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getDictationTest(seriesId, level, testId) {
  const snap = await getDoc(doc(db, "lessons", lessonId(seriesId, level), "dictationTests", testId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// sentences PHẢI đã resolve hết audio thành URL đầy đủ (Cloudinary) trước khi gọi hàm này, giống saveTest.
export async function saveDictationTest(seriesId, level, testId, { title, order, sentences, maxAttempts }, uid) {
  await setDoc(doc(db, "lessons", lessonId(seriesId, level), "dictationTests", testId), {
    testId,
    title,
    order,
    sentences,
    maxAttempts: maxAttempts ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function deleteDictationTest(seriesId, level, testId) {
  await deleteDoc(doc(db, "lessons", lessonId(seriesId, level), "dictationTests", testId));
}

// ĐỌC HIỂU (IELTS Reading) — cấu trúc riêng (chốt 2026-09-10, khác Reading & Writing YLE ở trên):
// mỗi bài chia thành `sentences: [{ en, vi, vocab: [{ termDef, meaning }] }]` (câu + dịch + từ vựng/
// đồng nghĩa xuất hiện trong câu đó, đúng bố cục file Word gốc — xem IeltsReadingPassage.jsx) thay vì
// `parts`/`questions` — mục này KHÔNG chấm điểm, chỉ để đọc. Có thêm `audioUrl` (giọng đọc tự thu/
// tạo qua Cloudinary, không phải audio gốc đề thi có bản quyền).
export async function listComprehensionTests(seriesId, level) {
  const snap = await getDocs(collection(db, "lessons", lessonId(seriesId, level), "comprehensionTests"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getComprehensionTest(seriesId, level, testId) {
  const snap = await getDoc(doc(db, "lessons", lessonId(seriesId, level), "comprehensionTests", testId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveComprehensionTest(
  seriesId, level, testId, { titleEn, titleVi, order, audioUrl, sentences }, uid
) {
  await setDoc(doc(db, "lessons", lessonId(seriesId, level), "comprehensionTests", testId), {
    testId,
    titleEn,
    titleVi: titleVi ?? "",
    order,
    audioUrl: audioUrl ?? "",
    sentences,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function deleteComprehensionTest(seriesId, level, testId) {
  await deleteDoc(doc(db, "lessons", lessonId(seriesId, level), "comprehensionTests", testId));
}

// LUYỆN ĐỀ (IELTS Reading full test) — cấu trúc riêng, có chấm điểm (chốt 2026-09-10). Mỗi Test
// gồm nhiều `passages`, mỗi passage có `title`, `note` (dòng "You should spend about 20 minutes...")
// `paragraphs: string[]`, và `groups` (nhóm câu hỏi theo đúng cách đề thi thật nhóm — mỗi nhóm có
// `instruction` + `type` ("multiple-choice" | "tfng" | "short-answer") + `questions`). KHÔNG chứa
// nội dung sách có bản quyền nhúng sẵn — giáo viên tự gõ toàn bộ nội dung Test qua CMS
// (PracticeStudio.jsx), Claude không tự điền nội dung đề thi thật (xem CLAUDE.md mục 1, 7).
export async function listPracticeTests(seriesId, level) {
  const snap = await getDocs(collection(db, "lessons", lessonId(seriesId, level), "practiceTests"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getPracticeTest(seriesId, level, testId) {
  const snap = await getDoc(doc(db, "lessons", lessonId(seriesId, level), "practiceTests", testId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function savePracticeTest(
  seriesId, level, testId, { title, order, timeLimitMinutes, passages, maxAttempts }, uid
) {
  await setDoc(doc(db, "lessons", lessonId(seriesId, level), "practiceTests", testId), {
    testId,
    title,
    order,
    timeLimitMinutes: timeLimitMinutes ?? null,
    passages,
    maxAttempts: maxAttempts ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function deletePracticeTest(seriesId, level, testId) {
  await deleteDoc(doc(db, "lessons", lessonId(seriesId, level), "practiceTests", testId));
}

// LISTENING (IELTS full test) — cấu trúc riêng (chốt 2026-09-11), song song với `practiceTests`
// (Reading): mỗi Test gồm `sections` (Section 1-4), mỗi section có `title`, `audioUrl` (Cloudinary,
// KHÔNG phải audio gốc đề thi có bản quyền), `note` (hướng dẫn chung, vd "Complete the notes
// below...") và `groups` (nhóm câu hỏi, TÁI DÙNG đúng schema group của practiceTests: instruction +
// type "multiple-choice"|"tfng"|"short-answer" + questions).
export async function listIeltsListeningTests(seriesId, level) {
  const snap = await getDocs(collection(db, "lessons", lessonId(seriesId, level), "listeningTests"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getIeltsListeningTest(seriesId, level, testId) {
  const snap = await getDoc(doc(db, "lessons", lessonId(seriesId, level), "listeningTests", testId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveIeltsListeningTest(
  seriesId, level, testId, { title, order, sections, maxAttempts }, uid
) {
  await setDoc(doc(db, "lessons", lessonId(seriesId, level), "listeningTests", testId), {
    testId,
    title,
    order,
    sections,
    maxAttempts: maxAttempts ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function deleteIeltsListeningTest(seriesId, level, testId) {
  await deleteDoc(doc(db, "lessons", lessonId(seriesId, level), "listeningTests", testId));
}
