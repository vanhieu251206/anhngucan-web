// Phiếu báo học phí (PDF) — 2026-10-02. A4 dọc, 2 phiếu/trang (in xong cắt đôi theo đường đứt nét), vẽ lại theo mẫu
// phiếu giấy của trung tâm: khung + chữ in sẵn màu cam, phần điền (tên, lớp, số tiền) màu đen. Số liệu lấy từ
// lib/tuition.js. Thư viện + font chỉ tải khi bấm nút (lib/pdfDoc.js).
import { FONT, newDoc, safeName } from "./pdfDoc.js";
import { itemsFor, itemAmount, totalFor, hasBill, fmtMoney, monthLabel, dateParts } from "./tuition.js";

const ORANGE = [229, 83, 32];
const BLACK = [20, 20, 20];
const PAGE_W = 210;
const SLOT_H = 148.5;
const CENTER = { name: "ANH NGỮ C.A.N", address: "219/19 ĐS5 - BHH - TP.HCM", phone: "0903 03 22 88" };
const COLS = [14, 58, 28, 38, 40]; // STT, Môn học, Số buổi, Đơn giá, Thành tiền
const TABLE_X = 16;
const MIN_ROWS = 5;

function hexagon(pdf, x1, y1, x2, y2, cut) {
  const ym = (y1 + y2) / 2;
  const pts = [[x1 + cut, y1], [x2 - cut, y1], [x2, ym], [x2 - cut, y2], [x1 + cut, y2], [x1, ym]];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    pdf.line(p[0], p[1], q[0], q[1]);
  });
}

// Vẽ 1 phiếu vào nửa trang bắt đầu ở toạ độ dọc `oy` (0 = nửa trên, SLOT_H = nửa dưới).
export function drawBill(pdf, { className, month, items, dueDate, issueDate }, student, oy, logo) {
  const orange = () => { pdf.setTextColor(...ORANGE); pdf.setDrawColor(...ORANGE); pdf.setFillColor(...ORANGE); };
  const black = () => pdf.setTextColor(...BLACK);
  pdf.setLineDashPattern([], 0);
  orange();

  // Khung ngoài (2 nét)
  pdf.setLineWidth(0.6);
  pdf.rect(8, oy + 7, PAGE_W - 16, SLOT_H - 14);
  pdf.setLineWidth(0.2);
  pdf.rect(9.5, oy + 8.5, PAGE_W - 19, SLOT_H - 17);

  // Đầu phiếu: logo + tên trung tâm
  if (logo) pdf.addImage(logo, "PNG", 14, oy + 12, 24, 24);
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(15);
  pdf.text(CENTER.name, 42, oy + 20);
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(8.5);
  pdf.text(`Đ/c: ${CENTER.address}`, 42, oy + 26.5);
  pdf.text(`ĐT: ${CENTER.phone}`, 42, oy + 31.5);

  // Khung tiêu đề
  const bx1 = 98, bx2 = 196, by1 = oy + 13, by2 = oy + 29;
  pdf.setLineWidth(0.5);
  hexagon(pdf, bx1, by1, bx2, by2, 5);
  pdf.setLineWidth(0.2);
  hexagon(pdf, bx1 + 2, by1 + 1.3, bx2 - 2, by2 - 1.3, 4.2);
  const title = `PHIẾU BÁO HỌC PHÍ THÁNG ${monthLabel(month)}`;
  pdf.setFont(FONT, "bold");
  let size = 15;
  pdf.setFontSize(size);
  while (pdf.getTextWidth(title) > bx2 - bx1 - 14 && size > 8) pdf.setFontSize((size -= 0.5));
  pdf.text(title, (bx1 + bx2) / 2, (by1 + by2) / 2, { align: "center", baseline: "middle" });
  const lineY = oy + 33.5, mid = (bx1 + bx2) / 2;
  pdf.setLineWidth(0.3);
  pdf.line(bx1, lineY, mid - 4, lineY);
  pdf.line(mid + 4, lineY, bx2, lineY);
  pdf.triangle(mid - 1.4, lineY, mid, lineY - 1.4, mid + 1.4, lineY, "F");
  pdf.triangle(mid - 1.4, lineY, mid, lineY + 1.4, mid + 1.4, lineY, "F");

  // Họ tên / Lớp
  [["Họ tên", student.name], ["Lớp", className]].forEach(([label, value], i) => {
    const y = oy + 44 + i * 8;
    orange();
    pdf.setFont(FONT, "bold");
    pdf.setFontSize(11);
    pdf.text(label, TABLE_X, y);
    pdf.text(":", 38, y);
    pdf.setLineWidth(0.2);
    pdf.setLineDashPattern([0.3, 0.7], 0);
    pdf.line(40, y + 1.3, 135, y + 1.3);
    pdf.setLineDashPattern([], 0);
    black();
    pdf.setFontSize(12);
    pdf.text(pdf.splitTextToSize(String(value || ""), 94)[0] ?? "", 41, y);
  });

  // Bảng các khoản — tối thiểu 5 dòng như mẫu; nhiều khoản hơn thì dòng thấp lại cho vừa nửa trang.
  const rows = itemsFor(items, student.uid);
  const n = Math.max(MIN_ROWS, rows.length);
  const ty = oy + 57;
  const h = Math.min(8.6, 60 / (n + 2));
  const tableW = COLS.reduce((a, b) => a + b, 0);
  const xs = COLS.reduce((acc, w) => [...acc, acc[acc.length - 1] + w], [TABLE_X]);
  const cy = r => ty + r * h + h / 2; // tâm dọc của dòng r (0 = dòng tiêu đề)
  orange();
  pdf.setLineWidth(0.3);
  pdf.rect(TABLE_X, ty, tableW, h * (n + 2));
  for (let r = 1; r < n + 2; r++) pdf.line(TABLE_X, ty + r * h, TABLE_X + tableW, ty + r * h);
  for (let c = 1; c < COLS.length; c++) pdf.line(xs[c], ty, xs[c], ty + h * (c === COLS.length - 1 ? n + 2 : n + 1));

  const mid_ = { baseline: "middle" };
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(10.5);
  ["STT", "Môn học", "Số buổi", "Đơn giá", "Thành tiền"].forEach((t, c) => pdf.text(t, xs[c] + COLS[c] / 2, cy(0), { align: "center", ...mid_ }));
  const bodySize = Math.min(10.5, h * 1.35);
  for (let r = 0; r < n; r++) {
    const y = cy(r + 1);
    orange();
    pdf.setFont(FONT, "bold");
    pdf.setFontSize(bodySize);
    pdf.text(String(r + 1), xs[0] + COLS[0] / 2, y, { align: "center", ...mid_ });
    const it = rows[r];
    if (!it) continue;
    black();
    pdf.setFont(FONT, "normal");
    pdf.text(pdf.splitTextToSize(String(it.name ?? ""), COLS[1] - 6)[0] ?? "", xs[1] + 3.5, y, mid_);
    const byRate = it.sessions != null && it.unitPrice != null;
    if (byRate) {
      pdf.text(String(it.sessions), xs[2] + COLS[2] / 2, y, { align: "center", ...mid_ });
      pdf.text(fmtMoney(it.unitPrice), xs[4] - 3.5, y, { align: "right", ...mid_ });
    }
    pdf.setFont(FONT, "bold");
    pdf.text(fmtMoney(itemAmount(it)), xs[5] - 3.5, y, { align: "right", ...mid_ });
  }
  orange();
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(11.5);
  pdf.text("TỔNG CỘNG", (xs[0] + xs[4]) / 2, cy(n + 1), { align: "center", ...mid_ });
  black();
  pdf.text(fmtMoney(totalFor(items, student.uid)), xs[5] - 3.5, cy(n + 1), { align: "right", ...mid_ });

  // Chân phiếu
  const fy = ty + h * (n + 2) + 9;
  orange();
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(9.5);
  const lead = "Phụ huynh vui lòng thanh toán trước ngày ";
  pdf.text(lead, TABLE_X, fy);
  const due = dateParts(dueDate);
  const dueX = TABLE_X + pdf.getTextWidth(lead);
  if (due) {
    black();
    pdf.setFont(FONT, "bold");
    pdf.text(`${due.d}/${due.m}/${due.y}`, dueX, fy);
  } else {
    pdf.setLineWidth(0.2);
    pdf.line(dueX, fy + 0.6, dueX + 34, fy + 0.6);
  }
  orange();
  pdf.setFont(FONT, "normal");
  const issued = dateParts(issueDate);
  const right = TABLE_X + tableW;
  if (issued) {
    const date = `${issued.d}/${issued.m}/${issued.y}`;
    black();
    pdf.setFont(FONT, "bold");
    pdf.text(date, right, fy, { align: "right" });
    const dateW = pdf.getTextWidth(date);
    orange();
    pdf.setFont(FONT, "normal");
    pdf.text("Ngày lập phiếu: ", right - dateW, fy, { align: "right" });
  } else {
    pdf.text("Ngày lập phiếu: ........ / ........ / ............", right, fy, { align: "right" });
  }
}

function cutLine(pdf) {
  pdf.setDrawColor(150);
  pdf.setLineWidth(0.15);
  pdf.setLineDashPattern([1.5, 1.5], 0);
  pdf.line(0, SLOT_H, PAGE_W, SLOT_H);
  pdf.setLineDashPattern([], 0);
}

async function loadLogo() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assets/img/logo.png`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // thiếu logo vẫn xuất được phiếu
  }
}

// students: [{ uid, name }] — chỉ em có ít nhất 1 khoản đã nhập tiền mới có phiếu.
export async function downloadTuitionBills(bill, students) {
  const list = students.filter(s => hasBill(bill.items, s.uid));
  if (!list.length) throw new Error("Chưa có em nào có khoản tiền để xuất phiếu.");
  const [{ pdf }, logo] = await Promise.all([newDoc(), loadLogo()]);
  list.forEach((s, i) => {
    if (i > 0 && i % 2 === 0) pdf.addPage();
    if (i % 2 === 0) cutLine(pdf);
    drawBill(pdf, bill, s, (i % 2) * SLOT_H, logo);
  });
  const who = list.length === 1 ? `-${safeName(list[0].name)}` : "";
  pdf.save(`Hoc-phi-${safeName(bill.className)}-${bill.month}${who}.pdf`);
}
