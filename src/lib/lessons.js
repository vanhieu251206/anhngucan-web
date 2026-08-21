import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "./firebase.js";

// Loader phía học sinh: GỘP dữ liệu hardcode có sẵn trong level (yleData.js — vd level.speakingPart1
// của starters-1, luôn hiện dưới id cố định "test1") VỚI các Test soạn qua CMS lưu trong Firestore —
// không phải "có Firestore thì bỏ hết hardcode" như trước (từng khiến Test 1 nhúng cứng biến mất
// khỏi mắt học sinh chỉ vì CMS lỡ tạo thêm 1 Test nháp khác). Nếu CMS thật sự tạo 1 Test có id
// "test1" (cố tình ghi đè), Firestore mới thắng — còn lại luôn cộng dồn, không thay thế.
export async function loadLevelContent(series, level) {
  const lessonId = `${series.id}-${level.number}`;

  let listening = level.listening ?? null;
  let firestoreTests = [];

  try {
    const snap = await getDoc(doc(db, "lessons", lessonId));
    if (snap.exists() && snap.data().listening) {
      listening = snap.data().listening;
    }
    // Chuẩn hoá thành mảng (hỗ trợ nhiều video/bài nghe) — dữ liệu cũ (hardcode yleData.js hoặc
    // Firestore trước khi có tính năng này) là 1 object đơn, không phải mảng.
    if (listening && !Array.isArray(listening)) listening = [listening];
    const testsSnap = await getDocs(collection(db, "lessons", lessonId, "tests"));
    // Chỉ tính các test ĐÃ có scene thật — test nháp rỗng (mới tạo qua CMS, chưa soạn scene)
    // không hiện cho học sinh thấy bài trống trơn.
    firestoreTests = testsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.scenes?.length);
  } catch {
    // Lỗi mạng/Firestore — coi như chưa có gì mới, vẫn hiện được hardcode bên dưới, không chặn học.
  }

  const hardcodeTests = level.speakingPart1
    ? [{ id: "test1", title: "Test 1", order: 1, scenes: level.speakingPart1 }]
    : [];
  const firestoreIds = new Set(firestoreTests.map(t => t.id));
  const tests = [...hardcodeTests.filter(t => !firestoreIds.has(t.id)), ...firestoreTests].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  return { listening, tests };
}
