import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";

// Mật khẩu MỞ KHOÁ theo TỪNG BỘ ĐỀ (Starters/Movers/Flyers/Kids/KET-PET/IELTS...) — thay cho đăng
// nhập tài khoản học sinh (chốt 2026-09-17: bỏ hẳn tài khoản học sinh, quay lại mật khẩu như
// PasswordGate cũ nhưng tách riêng theo từng bộ đề thay vì 1 mật khẩu chung toàn trung tâm). Lưu
// hash SHA-256 (không lưu plaintext) trong 1 doc duy nhất `settings/seriesPasswords`, field =
// seriesId, so khớp bằng Web Crypto API ngay trên trình duyệt — không có backend, không có Cloud
// Functions (đúng ràng buộc dự án). Đây KHÔNG phải bảo mật cấp production thật, chỉ đủ dùng cho nội
// dung ít nhạy cảm (bài học tiếng Anh trẻ em), giống đánh đổi đã chấp nhận với lessonAccess.js cũ.
const DOC_REF_PATH = ["settings", "seriesPasswords"];
const SESSION_KEY = "unlockedSeries";

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getSeriesPasswordHashes() {
  const snap = await getDoc(doc(db, ...DOC_REF_PATH));
  return snap.exists() ? snap.data() : {};
}

// Admin/giáo viên đặt/đổi mật khẩu cho 1 bộ đề — ghi đè đúng field seriesId, giữ nguyên các bộ
// khác (merge: true).
export async function setSeriesPassword(seriesId, plainPassword) {
  const hash = await sha256Hex(plainPassword);
  await setDoc(doc(db, ...DOC_REF_PATH), { [seriesId]: hash }, { merge: true });
}

function readUnlockedSet() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function isUnlockedInSession(seriesId) {
  return readUnlockedSet().has(seriesId);
}

function markUnlockedInSession(seriesId) {
  try {
    const set = readUnlockedSet();
    set.add(seriesId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...set]));
  } catch {
    // sessionStorage chặn (chế độ ẩn danh nghiêm ngặt...) — chấp nhận phải nhập lại mật khẩu mỗi
    // lần F5 trong phiên đó, không chặn cả tính năng.
  }
}

// So khớp mật khẩu học sinh nhập với hash đã lưu — đúng thì đánh dấu mở khoá cho phiên trình
// duyệt này (sessionStorage, mất khi đóng tab, giống cơ chế PasswordGate cũ).
export async function verifySeriesPassword(seriesId, plainPassword) {
  const hashes = await getSeriesPasswordHashes();
  const expected = hashes[seriesId];
  if (!expected) return false;
  const actual = await sha256Hex(plainPassword);
  const ok = actual === expected;
  if (ok) markUnlockedInSession(seriesId);
  return ok;
}
