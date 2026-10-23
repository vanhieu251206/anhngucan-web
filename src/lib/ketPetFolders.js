import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { KET_PET_UNITS_PER_GRADE } from "./yleData.js";

// THƯ MỤC tự đặt tên chèn vào danh sách Unit của 1 Grade KET/PET (2026-10-23, VD "Ôn thi giữa kỳ"): bên trong y như
// 1 Unit (Vocabulary + Practice Test 1-4). Lưu ở field `folders` của doc lessons/ket-pet-{grade}:
// [{ id: "f…", name, after }] — `after` = Unit (số) hoặc id thư mục đứng ngay trước, 0 = đầu danh sách.
// Thư mục dùng `id` thay cho số Unit ở mọi chỗ (doc `unit${id}`, `unit${id}-test${n}`, mở bài, ?go=...).
const ref = grade => doc(db, "lessons", `ket-pet-${grade}`);

export async function getKetPetFolders(grade) {
  const snap = await getDoc(ref(grade));
  return snap.exists() ? snap.data().folders ?? [] : [];
}

export async function saveKetPetFolders(grade, folders, uid) {
  await setDoc(ref(grade), { seriesId: "ket-pet", level: grade, folders, updatedAt: serverTimestamp(), updatedBy: uid }, { merge: true });
}

export function newFolderId() {
  return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// Danh sách Unit + thư mục đúng thứ tự hiển thị: [{ key, label, folder? }]. Thư mục mất chỗ neo (thư mục trước bị
// xoá) thì xếp cuối.
export function unitEntries(folders = []) {
  const out = [];
  const placed = new Set();
  const place = anchor => {
    folders.filter(f => f.after === anchor && !placed.has(f.id)).forEach(f => {
      placed.add(f.id);
      out.push({ key: f.id, label: f.name, folder: f });
      place(f.id);
    });
  };
  place(0);
  for (let u = 1; u <= KET_PET_UNITS_PER_GRADE; u++) {
    out.push({ key: u, label: `Unit ${u}` });
    place(u);
  }
  folders.filter(f => !placed.has(f.id)).forEach(f => out.push({ key: f.id, label: f.name, folder: f }));
  return out;
}

export function unitLabel(unit, folders = []) {
  if (typeof unit === "number") return `Unit ${unit}`;
  return folders.find(f => f.id === unit)?.name ?? "Thư mục";
}

// "5" → 5, "fabc12" → "fabc12" (khoá Unit đọc lại từ chuỗi id bài / URL).
export function parseUnitKey(s) {
  return /^\d+$/.test(String(s)) ? Number(s) : String(s);
}
