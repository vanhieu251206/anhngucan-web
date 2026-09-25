import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, Timestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { getAttemptCount } from "./attempts.js";

// "Mở bài" (chốt 2026-09-20, thay mật khẩu theo bộ đề + giao bài 1-bài-mỗi-lớp cũ): MẶC ĐỊNH MỌI BÀI ĐỀU
// KHOÁ. Giáo viên mở từng bài cho từng LỚP; 1 lớp có thể có nhiều bài mở cùng lúc. Mỗi lần mở có: hạn chót,
// số lượt tối đa, số phút làm bài. Học sinh (đã đăng nhập) chỉ vào được khi bài đang mở cho lớp của em.
// Mật khẩu vào bài đã BỎ HẲN (chốt 2026-09-25): đăng nhập + mở theo lớp + hạn chót + số lượt đã đủ kiểm soát. Lần
// mở cũ còn field `passwordHash`/`hasPassword` thì bị bỏ qua (học sinh vào thẳng).
//
// kind: "speaking" | "reading" | "dictation" | "listening-exam" | "ielts-reading" | "ielts-listening" |
//       "ketpet-vocab" | "ketpet-test"
export const OPENING_KINDS = {
  speaking: "Speaking",
  reading: "Reading & Writing",
  dictation: "Dictation",
  "listening-exam": "Listening (Luyện đề)",
  "ielts-reading": "IELTS Reading",
  "ielts-listening": "IELTS Listening",
  "ketpet-vocab": "KET/PET Vocabulary",
  "ketpet-test": "KET/PET Practice Test",
};

const COL = "openings";


export async function listOpenings() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createOpening(
  { className, seriesId, level, kind, testId, testTitle, expiresAt, maxAttempts, timeLimitMinutes },
  uid
) {
  await addDoc(collection(db, COL), {
    className,
    seriesId,
    level,
    kind,
    testId,
    testTitle: testTitle ?? null,
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    maxAttempts: maxAttempts ?? null,
    timeLimitMinutes: timeLimitMinutes ?? null,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
}

// patch có thể gồm: expiresAt (Date|null), maxAttempts, timeLimitMinutes.
export async function updateOpening(id, { expiresAt, maxAttempts, timeLimitMinutes }) {
  const patch = {
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    maxAttempts: maxAttempts ?? null,
    timeLimitMinutes: timeLimitMinutes ?? null,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, COL, id), patch);
}

export async function closeOpening(id) {
  await deleteDoc(doc(db, COL, id));
}

export function isExpired(opening) {
  return !!opening.expiresAt && opening.expiresAt.toDate() < new Date();
}

// Khoá đếm lượt riêng cho TỪNG lần mở (mở lại bài sau này = đếm lại từ đầu).
export function attemptKey(testId, openingId) {
  return openingId ? `${testId}@${openingId}` : testId;
}

// Học sinh bấm vào 1 bài: trả { ok: true, opening } hoặc { ok: false, title, message }.
// Lỗi mạng ném ngoại lệ — nơi gọi PHẢI chặn (bài mặc định khoá, không "cho qua khi lỗi").
export async function checkOpening({ uid, className }, { seriesId, level, kind, testId }) {
  if (!className) {
    return { ok: false, title: "Chưa có lớp 🐝", message: "Tài khoản của con chưa được xếp lớp — hỏi giáo viên nhé." };
  }
  const snap = await getDocs(query(collection(db, COL), where("className", "==", className)));
  const matches = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(o => o.seriesId === seriesId && o.level === level && o.kind === kind && o.testId === testId);
  if (!matches.length) {
    return { ok: false, title: "Bài này đang khoá 🐝", message: "Giáo viên chưa mở bài này cho lớp của con — hỏi giáo viên nhé." };
  }
  const active = matches.filter(o => !isExpired(o));
  if (!active.length) {
    return { ok: false, title: "Đã hết hạn 🐝", message: "Bài này đã quá hạn nộp — hỏi giáo viên nếu con cần làm nữa nhé." };
  }
  // Nhiều lần mở trùng bài (hiếm): ưu tiên lần mở còn lượt.
  for (const o of active) {
    if (!o.maxAttempts) return { ok: true, opening: o };
    const used = await getAttemptCount(uid, kind, attemptKey(testId, o.id));
    if (used < o.maxAttempts) return { ok: true, opening: o };
  }
  const o = active[0];
  return {
    ok: false,
    title: "Hết lượt làm bài rồi 🐝",
    message: `Bài này chỉ được làm tối đa ${o.maxAttempts} lượt và con đã dùng hết. Nếu cần làm lại, hãy nhờ giáo viên cấp thêm lượt nhé.`,
  };
}
