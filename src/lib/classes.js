import { doc, setDoc, getDoc, getDocs, collection, query, where, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { listStudents } from "./adminUsers.js";
import { YLE_SERIES, KIDS_GRADES, KET_PET_GRADES } from "./yleData.js";

// Lớp học (chốt 2026-09-25): giáo viên TẠO LỚP trước (Dashboard → "Quản lý học sinh"), rồi mới thêm học sinh
// vào lớp đó. 1 doc/lớp trong collection `classes`, id = tên lớp (vd "3A") — học sinh vẫn lưu `className` là
// chuỗi tên lớp như cũ nên các trang Mở bài/Kết quả/phạm vi giáo viên không phải đổi dữ liệu. Lớp cũ chỉ tồn tại
// qua `className` của học sinh (tạo trước khi có collection này) vẫn được tính là lớp (listClassNames()).
export function normalizeClassName(name) {
  return (name || "").trim().replace(/\s+/g, " ");
}

export async function listClassDocs() {
  const snap = await getDocs(collection(db, "classes"));
  return snap.docs.map(d => ({ name: d.id, ...d.data() }));
}

// Hợp của lớp đã tạo + lớp đang có học sinh. Đọc `classes` lỗi (vd chưa publish firestore.rules mới) thì vẫn
// trả về lớp suy ra từ học sinh như trước.
export async function listClassNames() {
  const [docs, students] = await Promise.all([listClassDocs().catch(() => []), listStudents()]);
  return [...new Set([...docs.map(c => c.name), ...students.map(s => s.className).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
}

// Lịch học của lớp: days = thứ trong tuần (2..7, 8 = Chủ nhật), time = "HH:MM" ("" = chưa có giờ).
export const DAY_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
export const dayLabel = d => (d === 8 ? "CN" : `T${d}`);

export function formatSchedule(c) {
  const days = [...(c?.days ?? [])].sort((a, b) => a - b);
  if (!days.length && !c?.time) return "";
  return [days.map(dayLabel).join(" · "), c?.time].filter(Boolean).join(" — ");
}

// Đọc 1 dòng tên lớp thô giáo viên gửi, vd "CAN-ANH2-246-16H30", "CAN-ANH6-SÁNG 3-5", "CAN- IELTS 1" →
// { name: "ANH2", days: [2,4,6], time: "16:30" }. Bỏ tiền tố "CAN-" và số thứ tự đầu dòng.
export function parseClassLine(line) {
  let s = (line || "").trim().replace(/^\d+\s*[.)]\s*/, "").replace(/^CAN\s*-\s*/i, "");
  let time = "";
  let days = [];
  const t = s.match(/-?\s*(\d{1,2})\s*H\s*(\d{2})?\s*$/i);
  if (t) {
    time = `${t[1].padStart(2, "0")}:${t[2] ?? "00"}`;
    s = s.slice(0, t.index);
  }
  const morning = s.match(/-?\s*S[ÁA]NG\s+([2-8](?:\s*-\s*[2-8])*)\s*$/i);
  const digits = s.match(/-\s*([2-8]{2,4})\s*$/);
  if (morning) {
    days = morning[1].split("-").map(Number);
    s = s.slice(0, morning.index);
  } else if (digits) {
    days = [...digits[1]].map(Number);
    s = s.slice(0, digits.index);
  }
  const name = normalizeClassName(s.replace(/\s*-\s*/g, "-").replace(/-+$/, ""));
  return { name, days: [...new Set(days)].sort((a, b) => a - b), time };
}

// ---------- Sách của lớp (chốt 2026-09-25) ----------
// Mỗi lớp gán ĐÚNG 1 bộ đề: book = { seriesId, levels } — levels rỗng = cả bộ, có số = chỉ các cấp đó. book null =
// chưa gán → học sinh lớp đó bị khoá hết. Học sinh chỉ vào được bộ đề/cấp của lớp MÌNH ĐANG Ở (chuyển lớp là quyền
// đổi theo); admin/giáo viên/tester không bị giới hạn. Chỉ chặn ở giao diện — bài cụ thể vẫn phải "Mở bài".
export const BOOK_OPTIONS = YLE_SERIES.map(s => {
  const grades = s.id === "kids" ? KIDS_GRADES : s.id === "ket-pet" ? KET_PET_GRADES : null;
  return {
    id: s.id,
    title: s.title,
    levels: grades ?? (s.levels ?? []).map(l => l.number),
    levelLabel: n => (grades ? `Grade ${n}` : `${s.title} ${n}`),
  };
});

export function formatBook(book) {
  const opt = BOOK_OPTIONS.find(o => o.id === book?.seriesId);
  if (!opt) return "";
  const levels = [...(book.levels ?? [])].sort((a, b) => a - b);
  if (!levels.length || levels.length === opt.levels.length) return opt.levels.length > 1 ? `${opt.title} (cả bộ)` : opt.title;
  const labels = levels.map(opt.levelLabel).join(", ");
  // Kids/KET-PET nhãn là "Grade n" → thêm tên bộ đề cho rõ ("Kids · Grade 1, Grade 3").
  return labels.includes(opt.title) ? labels : `${opt.title} · ${labels}`;
}

export function bookAllowsSeries(book, seriesId) {
  return !!book && book.seriesId === seriesId;
}

export function bookAllowsLevel(book, seriesId, level) {
  return bookAllowsSeries(book, seriesId) && (!book.levels?.length || book.levels.includes(Number(level)));
}

export async function setClassBook(name, book) {
  await setDoc(doc(db, "classes", name), { book: book ?? null }, { merge: true });
}

export async function getClass(name) {
  if (!name) return null;
  const snap = await getDoc(doc(db, "classes", name));
  return snap.exists() ? { name, ...snap.data() } : null;
}

export async function createClass(name, uid, { days = [], time = "", book = null } = {}) {
  const className = normalizeClassName(name);
  if (!className) throw new Error("Chưa nhập tên lớp.");
  // Firestore không cho "/" trong id doc.
  if (className.includes("/")) throw new Error('Tên lớp không được chứa dấu "/".');
  const ref = doc(db, "classes", className);
  if ((await getDoc(ref)).exists()) throw new Error(`Lớp "${className}" đã có.`);
  await setDoc(ref, { days, time, book, createdAt: serverTimestamp(), createdBy: uid ?? null });
  return className;
}

// merge: lớp cũ chỉ tồn tại qua className của học sinh (chưa có doc) cũng đặt lịch được.
export async function setClassSchedule(name, { days, time }) {
  await setDoc(doc(db, "classes", name), { days, time }, { merge: true });
}

// Dữ liệu đang gắn theo tên lớp: học sinh (className), bài đang mở (openings.className), phạm vi giáo viên phụ
// (users.allowedClasses). Xoá/đổi tên lớp cập nhật TẤT CẢ trong 1 lần ghi (writeBatch — hoặc xong hết, hoặc không
// đổi gì, tránh lớp bị chuyển dở dang). Chốt 2026-09-25.
async function classRefs(name, myUid) {
  const [students, openings, teachers] = await Promise.all([
    getDocs(query(collection(db, "users"), where("role", "==", "student"), where("className", "==", name))),
    getDocs(query(collection(db, "openings"), where("className", "==", name))),
    getDocs(query(collection(db, "users"), where("allowedClasses", "array-contains", name))),
  ]);
  // Giáo viên không sửa được phạm vi của chính mình (firestore.rules) — bỏ qua hồ sơ của người đang thao tác.
  const teacherDocs = teachers.docs.filter(d => d.data().role === "teacher" && d.id !== myUid);
  return { students: students.docs, openings: openings.docs, teachers: teacherDocs };
}

// Xoá lớp: học sinh chuyển sang "Chưa xếp lớp" (KHÔNG xoá tài khoản), đóng các bài đang mở của lớp, gỡ lớp khỏi
// phạm vi giáo viên phụ.
export async function deleteClass(name, myUid) {
  const refs = await classRefs(name, myUid);
  const batch = writeBatch(db);
  refs.students.forEach(d => batch.update(d.ref, { className: "" }));
  refs.openings.forEach(d => batch.delete(d.ref));
  refs.teachers.forEach(d => batch.update(d.ref, { allowedClasses: (d.data().allowedClasses ?? []).filter(c => c !== name) }));
  batch.delete(doc(db, "classes", name));
  await batch.commit();
}

// Đổi tên lớp: tạo doc lớp mới (giữ lịch/sách), xoá doc cũ, cập nhật học sinh + bài đang mở + phạm vi giáo viên phụ
// theo tên mới. Kết quả bài làm cũ vẫn lưu tên lớp lúc nộp (trang Kết quả nhóm theo lớp hiện tại của học sinh).
export async function renameClass(oldName, newName, myUid) {
  const name = normalizeClassName(newName);
  if (!name) throw new Error("Chưa nhập tên lớp.");
  if (name === oldName) return name;
  if (name.includes("/")) throw new Error('Tên lớp không được chứa dấu "/".');
  const [oldSnap, newSnap, refs] = await Promise.all([
    getDoc(doc(db, "classes", oldName)),
    getDoc(doc(db, "classes", name)),
    classRefs(oldName, myUid),
  ]);
  if (newSnap.exists()) throw new Error(`Lớp "${name}" đã có.`);
  const batch = writeBatch(db);
  batch.set(doc(db, "classes", name), { ...(oldSnap.exists() ? oldSnap.data() : { createdAt: serverTimestamp(), createdBy: myUid ?? null }) });
  if (oldSnap.exists()) batch.delete(oldSnap.ref);
  refs.students.forEach(d => batch.update(d.ref, { className: name }));
  refs.openings.forEach(d => batch.update(d.ref, { className: name }));
  refs.teachers.forEach(d => batch.update(d.ref, { allowedClasses: (d.data().allowedClasses ?? []).map(c => (c === oldName ? name : c)) }));
  await batch.commit();
  return name;
}
