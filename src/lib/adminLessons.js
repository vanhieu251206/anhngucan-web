import { doc, setDoc, deleteDoc, getDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

function lessonId(seriesId, level) {
  return `${seriesId}-${level}`;
}

export async function saveListening(seriesId, level, { videoId, title }, uid) {
  await setDoc(
    doc(db, "lessons", lessonId(seriesId, level)),
    { seriesId, level, listening: { videoId, title }, updatedAt: serverTimestamp(), updatedBy: uid },
    { merge: true }
  );
}

export async function getListening(seriesId, level) {
  const snap = await getDoc(doc(db, "lessons", lessonId(seriesId, level)));
  return snap.exists() ? snap.data().listening ?? null : null;
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
