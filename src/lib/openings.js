import { collection, deleteField, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch, Timestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { sha256Hex } from "./seriesAccess.js";
import { getAttemptCount } from "./attempts.js";

// "Mở bài" (chốt 2026-09-20, thay mật khẩu theo bộ đề + giao bài 1-bài-mỗi-lớp cũ): MẶC ĐỊNH MỌI BÀI ĐỀU
// KHOÁ. Giáo viên mở từng bài cho từng LỚP; 1 lớp có thể có nhiều bài mở cùng lúc. Mỗi lần mở có: mật khẩu
// vào bài (lưu hash SHA-256), hạn chót, số lượt tối đa, số phút làm bài. Học sinh chỉ vào được khi bài đang
// mở cho lớp của em VÀ nhập đúng mật khẩu. Toàn bộ kiểm tra ở trình duyệt (không có server) — đủ dùng cho nội
// dung ít nhạy cảm, cùng đánh đổi đã chấp nhận với mật khẩu hash trước đây (xem CLAUDE.md mục 2).
//
// Mật khẩu (audit bảo mật 2026-09-25): doc lần mở chỉ lưu `hasPassword`. Hash SHA-256("<openingId>:<mật khẩu>") là
// ID của 1 doc riêng `openingKeys/<openingId>_<hash>` — học sinh chỉ `get` được đúng doc (rules cấm list) nên không
// lấy được hash về dò offline, mỗi lần đoán phải hỏi Firestore. Lần mở cũ còn field `passwordHash` (hash đọc được)
// vẫn chạy như trước cho tới khi giáo viên đặt lại mật khẩu.
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
const KEYS = "openingKeys";

async function keyDocId(openingId, password) {
  return `${openingId}_${await sha256Hex(`${openingId}:${password}`)}`;
}

async function oldKeyRefs(openingId) {
  const snap = await getDocs(query(collection(db, KEYS), where("openingId", "==", openingId)));
  return snap.docs.map(d => d.ref);
}

export function openingNeedsPassword(opening) {
  return !!(opening.hasPassword || opening.passwordHash);
}

export async function listOpenings() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createOpening(
  { className, seriesId, level, kind, testId, testTitle, password, expiresAt, maxAttempts, timeLimitMinutes },
  uid
) {
  const ref = doc(collection(db, COL));
  const batch = writeBatch(db);
  batch.set(ref, {
    className,
    seriesId,
    level,
    kind,
    testId,
    testTitle: testTitle ?? null,
    hasPassword: !!password,
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    maxAttempts: maxAttempts ?? null,
    timeLimitMinutes: timeLimitMinutes ?? null,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
  if (password) batch.set(doc(db, KEYS, await keyDocId(ref.id, password)), { openingId: ref.id });
  await batch.commit();
}

// patch có thể gồm: expiresAt (Date|null), maxAttempts, timeLimitMinutes, password (chuỗi mới; bỏ trống = giữ nguyên).
export async function updateOpening(id, { expiresAt, maxAttempts, timeLimitMinutes, password }) {
  const patch = {
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    maxAttempts: maxAttempts ?? null,
    timeLimitMinutes: timeLimitMinutes ?? null,
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  if (password) {
    patch.hasPassword = true;
    patch.passwordHash = deleteField();
    (await oldKeyRefs(id)).forEach(ref => batch.delete(ref));
    batch.set(doc(db, KEYS, await keyDocId(id, password)), { openingId: id });
  }
  batch.update(doc(db, COL, id), patch);
  await batch.commit();
}

export async function closeOpening(id) {
  const batch = writeBatch(db);
  (await oldKeyRefs(id)).forEach(ref => batch.delete(ref));
  batch.delete(doc(db, COL, id));
  await batch.commit();
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

// Lỗi mạng/rules ném ngoại lệ — nơi gọi báo "không kiểm tra được", không cho qua.
export async function verifyOpeningPassword(opening, plain) {
  if (opening.passwordHash) return (await sha256Hex(plain)) === opening.passwordHash;
  if (!opening.hasPassword) return true;
  return (await getDoc(doc(db, KEYS, await keyDocId(opening.id, plain)))).exists();
}
