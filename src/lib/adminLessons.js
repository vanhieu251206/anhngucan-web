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
export async function saveTest(seriesId, level, testId, { title, order, scenes }, uid) {
  await setDoc(doc(db, "lessons", lessonId(seriesId, level), "tests", testId), {
    testId,
    title,
    order,
    scenes,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function deleteTest(seriesId, level, testId) {
  await deleteDoc(doc(db, "lessons", lessonId(seriesId, level), "tests", testId));
}

// Reading & Writing — cấu trúc tương tự Speaking (subcollection riêng "readingTests" trong cùng
// 1 doc lesson), nhưng mỗi Test chứa `parts` (Part 1/2/3...), mỗi Part chứa `questions` (3 loại:
// yesno/gapfill/short-answer) thay vì `scenes`.
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
export async function saveReadingTest(seriesId, level, testId, { title, order, parts }, uid) {
  await setDoc(doc(db, "lessons", lessonId(seriesId, level), "readingTests", testId), {
    testId,
    title,
    order,
    parts,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function deleteReadingTest(seriesId, level, testId) {
  await deleteDoc(doc(db, "lessons", lessonId(seriesId, level), "readingTests", testId));
}
