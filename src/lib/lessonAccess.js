import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

const UNLOCK_KEY = "lessons-unlocked";
const HASH_CACHE_KEY = "lessons-access-hash-cache";

// Chuyển 1 chuỗi thành hash SHA-256 dạng hex, dùng Web Crypto API có sẵn trên mọi trình duyệt
// hiện đại — không cần thư viện ngoài. Không lưu mật khẩu dạng thô (plaintext) ở bất kỳ đâu.
export async function hashPassword(plainText) {
  const bytes = new TextEncoder().encode(plainText);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function checkPassword(plainText, storedHash) {
  const hash = await hashPassword(plainText);
  return hash === storedHash;
}

export function isUnlockedInSession() {
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function setUnlockedInSession() {
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

// Đọc doc settings/access (chứa passwordHash) — cache lại trong sessionStorage để KHÔNG đọc lại
// Firestore mỗi lần PasswordGate mount trong cùng 1 phiên (tránh tốn quota đọc miễn phí/ngày).
export async function getAccessHash() {
  const cached = sessionStorage.getItem(HASH_CACHE_KEY);
  if (cached) return cached;
  const snap = await getDoc(doc(db, "settings", "access"));
  const hash = snap.exists() ? snap.data().passwordHash : null;
  if (hash) sessionStorage.setItem(HASH_CACHE_KEY, hash);
  return hash;
}

// Admin/teacher đổi mật khẩu chung — chỉ ghi hash lên Firestore, không bao giờ ghi plaintext.
export async function setAccessPassword(newPlainText, uid) {
  const hash = await hashPassword(newPlainText);
  await setDoc(doc(db, "settings", "access"), {
    passwordHash: hash,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  sessionStorage.setItem(HASH_CACHE_KEY, hash);
}
