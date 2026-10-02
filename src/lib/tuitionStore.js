import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

// Học phí: 1 doc cho mỗi lớp + tháng trong collection `tuitionBills`, id = "<tên lớp>__<YYYY-MM>" (tên lớp không có
// "/"). Chỉ admin + giáo viên chính đọc/ghi (firestore.rules). Doc lưu kèm danh sách học sinh lúc lập (`students`:
// [{ uid, name }]) để phiếu tháng cũ vẫn đúng tên khi em đó chuyển lớp/bị xoá. Giữ lâu dài, không theo luật xoá 48h.
const billRef = (className, month) => doc(db, "tuitionBills", `${className}__${month}`);

export async function loadBill(className, month) {
  const snap = await getDoc(billRef(className, month));
  return snap.exists() ? snap.data() : null;
}

// Mọi phiếu đã lập của 1 tháng (trang tổng quan các lớp) — 1 lượt truy vấn. Trả về { [tên lớp]: doc }.
export async function listBillsForMonth(month) {
  const snap = await getDocs(query(collection(db, "tuitionBills"), where("month", "==", month)));
  return Object.fromEntries(snap.docs.map(d => [d.data().className, d.data()]));
}

// Xoá hẳn phiếu của 1 lớp + 1 tháng (người dùng chốt 2026-10-02: xoá vĩnh viễn, không thùng rác, không bản sao).
export async function deleteBill(className, month) {
  await deleteDoc(billRef(className, month));
}

export async function saveBill(className, month, { items, dueDate, issueDate, students }, uid) {
  await setDoc(billRef(className, month), {
    className,
    month,
    items,
    dueDate: dueDate || "",
    issueDate: issueDate || "",
    students,
    updatedAt: serverTimestamp(),
    updatedBy: uid ?? null,
  });
}
