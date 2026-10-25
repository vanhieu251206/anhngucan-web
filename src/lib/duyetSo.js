// Duyệt số thửa (2026-10-25): trang duyệt từng ô cho tài khoản đặc biệt `phonglon` (phần bản đồ PHU THO-DC1 của Phong),
// thay trang Artifact của Claude (tài khoản Claude khác chỉ có quyền xem, không lưu được kết quả). Không liên quan bài học.
//   duyetSo/meta        { items: chuỗi JSON, auto: chuỗi JSON, imgs: { "l7_04.webp": url Cloudinary }, ten } — chỉ admin ghi
//   duyetSoKq/{ảnh}     { "<mã ô>": { status, so?, vt?, luc } } — gộp theo ảnh 20 ô (~235 doc) để mỗi lần mở trang chỉ tốn
//                       ~235 lượt đọc thay vì ~4.700 (hạn mức Spark 50k đọc/ngày dùng chung với học sinh)
// Ảnh nằm trên Cloudinary (repo GitHub công khai, không để bản đồ trong mã nguồn). Rules: firestore.rules `isReviewer()`.
import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export const REVIEWER_USERNAME = "phonglon";

// Theo username trên hồ sơ, hoặc email đăng nhập (hồ sơ tạo kiểu cũ có thể không có username).
export function isReviewerProfile(profile, user) {
  if (profile?.role !== "tester") return false;
  const email = (user?.email || profile?.email || "").toLowerCase();
  return profile?.username === REVIEWER_USERNAME || email === `${REVIEWER_USERNAME}@tester.local`;
}

export async function loadReviewMeta() {
  const snap = await getDoc(doc(db, "duyetSo", "meta"));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ten: d.ten || "", items: JSON.parse(d.items), auto: JSON.parse(d.auto || "[]"), imgs: d.imgs || {} };
}

// Admin nhập file du_lieu_duyet_*.json do Claude chuẩn bị (ảnh đã tải sẵn lên Cloudinary, file chỉ chứa link).
export async function importReviewMeta(file) {
  const d = JSON.parse(await file.text());
  if (d.loai !== "duyet-so-thua" || !Array.isArray(d.items) || !d.imgs) throw new Error("File không đúng định dạng dữ liệu duyệt số.");
  const missing = d.items.filter(it => !d.imgs[it[7]]).length;
  if (missing) throw new Error(`Thiếu link ảnh cho ${missing} ô.`);
  await setDoc(doc(db, "duyetSo", "meta"), {
    ten: d.ten || "", items: JSON.stringify(d.items), auto: JSON.stringify(d.auto || []), imgs: d.imgs,
  });
  return d.items.length;
}

export const sheetKey = img => img.replace(/\.[a-z]+$/i, "");

export function watchResults(onChange, onError) {
  return onSnapshot(collection(db, "duyetSoKq"), snap => {
    const all = {};
    for (const d of snap.docs) Object.assign(all, d.data());
    onChange(all);
  }, onError);
}

export function saveResult(img, code, value) {
  return setDoc(doc(db, "duyetSoKq", sheetKey(img)), { [String(code)]: value }, { merge: true });
}
