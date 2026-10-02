// Học phí theo lớp + tháng (2026-10-02) — phần tính toán THUẦN (không Firebase), dùng chung cho trang nhập
// (pages/dashboard/TuitionPage.jsx) và phiếu PDF (lib/tuitionPdf.js). Lưu trữ ở lib/tuitionStore.js.
// 1 khoản = { name, sessions, unitPrice, amount, uids }:
// - Nhập đủ số buổi + đơn giá → thành tiền = số buổi × đơn giá; bỏ trống hai ô đó thì lấy `amount` gõ thẳng.
// - `uids`: null = cả lớp, mảng uid = chỉ các em được chọn.
export const DEFAULT_ITEM_NAMES = ["Anh văn", "Phí photo", "Phí tăng buổi"];

export function blankItem(name = "") {
  return { name, sessions: null, unitPrice: null, amount: null, uids: null };
}

export function itemAmount(item) {
  if (item.sessions != null && item.unitPrice != null) return item.sessions * item.unitPrice;
  return item.amount ?? null;
}

export function itemApplies(item, uid) {
  return item.uids == null || item.uids.includes(uid);
}

// Khoản in lên phiếu của 1 em: có tên hoặc có tiền, và áp dụng cho em đó.
export function itemsFor(items, uid) {
  return (items ?? []).filter(it => (String(it.name ?? "").trim() || itemAmount(it) != null) && itemApplies(it, uid));
}

export function totalFor(items, uid) {
  return itemsFor(items, uid).reduce((sum, it) => sum + (itemAmount(it) ?? 0), 0);
}

// Em có ít nhất 1 khoản đã nhập tiền mới xuất phiếu.
export function hasBill(items, uid) {
  return itemsFor(items, uid).some(it => itemAmount(it) != null);
}

export function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "";
  const r = Math.round(n);
  return (r < 0 ? "-" : "") + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Chuỗi người dùng gõ ("1.200.000", "-50000") → số, rỗng → null.
export function parseMoney(text) {
  const digits = String(text ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return (String(text).trim().startsWith("-") ? -1 : 1) * Number(digits);
}

const pad = n => String(n).padStart(2, "0");

export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function today(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// "2026-10" → "2026-09"
export function prevMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

// "2026-10" → "10/2026"
export function monthLabel(month) {
  const [y, m] = String(month ?? "").split("-");
  return y && m ? `${Number(m)}/${y}` : "";
}

// "2026-10-05" → { d: "05", m: "10", y: "2026" } hoặc null.
export function dateParts(iso) {
  const [y, m, d] = String(iso ?? "").split("-");
  return y && m && d ? { d, m, y } : null;
}
