import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, query, serverTimestamp, updateDoc, where, Timestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { getAttemptCount } from "./attempts.js";

// "Mở bài" (chốt 2026-09-20, thay mật khẩu theo bộ đề + giao bài 1-bài-mỗi-lớp cũ): MẶC ĐỊNH MỌI BÀI ĐỀU
// KHOÁ. Giáo viên mở từng bài cho từng LỚP; 1 lớp có thể có nhiều bài mở cùng lúc. Mỗi lần mở có: hạn chót,
// số lượt tối đa, số phút làm bài. Học sinh (đã đăng nhập) chỉ vào được khi bài đang mở cho lớp của em.
// Mật khẩu vào bài đã BỎ HẲN (chốt 2026-09-25): đăng nhập + mở theo lớp + hạn chót + số lượt đã đủ kiểm soát. Lần
// mở cũ còn field `passwordHash`/`hasPassword` thì bị bỏ qua (học sinh vào thẳng).
//
// kind: "speaking" | "reading" | "dictation" | "listening-exam" | "ielts-reading" | "ielts-listening" |
//       "ketpet-vocab" | "ketpet-test" | "yle-vocab"
export const OPENING_KINDS = {
  speaking: "Speaking",
  reading: "Reading & Writing",
  dictation: "Dictation",
  "yle-vocab": "Vocabulary",
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
  { className, seriesId, level, kind, testId, testTitle, expiresAt, maxAttempts, timeLimitMinutes, maxWrong },
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
    // Còn sai nhiều hơn số câu này thì học sinh phải sửa câu sai rồi nộp lại (Worker submit.js). null = bài thường.
    maxWrong: maxWrong ?? null,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
}

// patch có thể gồm: expiresAt (Date|null), maxAttempts, timeLimitMinutes, maxWrong.
export async function updateOpening(id, { expiresAt, maxAttempts, timeLimitMinutes, maxWrong }) {
  const patch = {
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    maxAttempts: maxAttempts ?? null,
    timeLimitMinutes: timeLimitMinutes ?? null,
    maxWrong: maxWrong ?? null,
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

// MỞ LẠI RIÊNG cho từng học sinh (2026-10-09): hạn chót của LỚP giữ nguyên (các em đã nộp vẫn xem được đáp án đúng
// hẹn), chỉ các em được chỉ định có hạn riêng + thêm lượt:
//   opening.extensions = { [uid]: { expiresAt, extraAttempts, at, by } }
// Kết quả, số lượt, phiếu chấm vẫn gắn với cùng lần mở bài. Worker kiểm tra y hệt (worker/src/submit.js).
export function extensionOf(opening, uid) {
  return (uid && opening?.extensions?.[uid]) || null;
}

// Lần mở bài NHÌN TỪ 1 học sinh: hạn chót = hạn muộn hơn giữa hạn lớp và hạn riêng; số lượt = lượt của lớp + lượt
// được cấp thêm. `reopened` = em này đang được mở lại.
export function openingForStudent(opening, uid) {
  const ext = extensionOf(opening, uid);
  const own = ext?.expiresAt?.toMillis?.();
  if (own == null) return opening;
  const classMs = opening.expiresAt?.toMillis?.() ?? null;
  if (classMs == null || own <= classMs) return opening;
  return {
    ...opening,
    classExpiresAt: opening.expiresAt,
    expiresAt: ext.expiresAt,
    maxAttempts: opening.maxAttempts ? opening.maxAttempts + (Number(ext.extraAttempts) || 0) : opening.maxAttempts ?? null,
    reopened: true,
    reopenedAt: ext.at ?? null,
  };
}

// Các em đang được mở lại (hạn riêng còn hiệu lực) của 1 lần mở bài → [{ uid, expiresAt }].
export function activeExtensions(opening, now = Date.now()) {
  return Object.entries(opening?.extensions ?? {})
    .map(([uid, ext]) => ({ uid, ...ext }))
    .filter(ext => (ext.expiresAt?.toMillis?.() ?? 0) > now);
}

// Hạn muộn nhất của lần mở bài tính cả các em được mở lại (để biết kết quả còn được giữ tới khi nào).
export function latestDeadlineMs(opening) {
  const all = [opening?.expiresAt, ...Object.values(opening?.extensions ?? {}).map(e => e?.expiresAt)]
    .map(t => t?.toMillis?.())
    .filter(ms => ms != null);
  return all.length ? Math.max(...all) : null;
}

export async function reopenForStudents(opening, uids, { expiresAt, extraAttempts }, byUid) {
  const patch = { className: opening.className, updatedAt: serverTimestamp() };
  uids.forEach(uid => {
    patch[`extensions.${uid}`] = {
      expiresAt: Timestamp.fromDate(expiresAt),
      extraAttempts: Math.max(0, Number(extraAttempts) || 0),
      at: Timestamp.now(),
      by: byUid ?? null,
    };
  });
  await updateDoc(doc(db, COL, opening.id), patch);
}

export async function cancelReopen(opening, uids) {
  const patch = { className: opening.className, updatedAt: serverTimestamp() };
  uids.forEach(uid => { patch[`extensions.${uid}`] = deleteField(); });
  await updateDoc(doc(db, COL, opening.id), patch);
}

// Số lượt + điểm tóm tắt của MỌI học sinh ở 1 lần mở bài → Map<uid, { count, bestCorrect, lastCorrect, total }>.
export async function listAttemptsForOpening(opening) {
  const snap = await getDocs(query(collection(db, "attempts"), where("testId", "==", attemptKey(opening.testId, opening.id))));
  const map = new Map();
  snap.docs.forEach(d => {
    const a = d.data();
    if (a.uid && a.mode === opening.kind) map.set(a.uid, { count: a.count ?? 0, bestCorrect: a.bestCorrect ?? null, lastCorrect: a.lastCorrect ?? null, total: a.total ?? null });
  });
  return map;
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
    .map(d => openingForStudent({ id: d.id, ...d.data() }, uid))
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
