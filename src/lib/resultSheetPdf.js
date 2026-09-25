// Phiếu chấm bài (PDF) gửi phụ huynh — chốt 2026-09-25. Chỉ tải được SAU hạn chót của lần mở bài và TRƯỚC khi kết
// quả bị xoá (48h sau hạn chót, xem lib/testResults.js). Thiết kế cho giấy in TRẮNG ĐEN: không nền màu, chữ đen,
// câu sai tô xám nhạt + chữ "Sai" in đậm để phân biệt được khi in đen trắng. Chữ vector (nhúng font Be Vietnam Pro,
// public/assets/fonts, giấy phép OFL) nên in sắc nét; bảng dài tự sang trang (jspdf-autotable). Thư viện + font chỉ
// tải khi bấm nút.
import { RESULT_MODE_LABEL, RESULT_KEEP_MS } from "./testResults.js";

const FONT = "BeVietnamPro";
const PAGE_W = 210;
const MARGIN = 14;

async function loadFontBase64(file) {
  const res = await fetch(`${import.meta.env.BASE_URL}assets/fonts/${file}`);
  if (!res.ok) throw new Error("Không tải được font cho phiếu PDF.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

let fontsPromise = null;
function loadFonts() {
  fontsPromise ??= Promise.all([loadFontBase64("BeVietnamPro-Regular.ttf"), loadFontBase64("BeVietnamPro-Bold.ttf")]).catch(err => {
    fontsPromise = null;
    throw err;
  });
  return fontsPromise;
}

async function newDoc() {
  const [{ jsPDF }, { autoTable }, [regular, bold]] = await Promise.all([import("jspdf"), import("jspdf-autotable"), loadFonts()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.addFileToVFS("BeVietnamPro-Regular.ttf", regular);
  pdf.addFont("BeVietnamPro-Regular.ttf", FONT, "normal");
  pdf.addFileToVFS("BeVietnamPro-Bold.ttf", bold);
  pdf.addFont("BeVietnamPro-Bold.ttf", FONT, "bold");
  pdf.setFont(FONT, "normal");
  pdf.setTextColor(0);
  return { pdf, autoTable };
}

const toDate = v => (v?.toDate ? v.toDate() : v instanceof Date ? v : null);
const pad = n => String(n).padStart(2, "0");
const fmtWhen = d => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "—");
function fmtDuration(ms) {
  if (ms == null) return "—";
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)} phút ${String(sec % 60).padStart(2, "0")} giây`;
}
const fmtNum = n => Number(n ?? 0).toFixed(2).replace(/\.?0+$/, "");
const pct = r => (r.total > 0 ? Math.round((r.correct / r.total) * 100) : null);

// Bảng chi tiết theo dạng bài (cùng cách đọc dữ liệu với trang Kết quả học sinh).
function detailTable(r) {
  const items = r.items ?? [];
  if (!items.length) return null;
  if (r.mode === "speaking") {
    return {
      head: [["Câu", "Câu hỏi của giám khảo", "Con trả lời", "Kết quả"]],
      body: items.map((it, i) => [String(i + 1), it.examinerLine ?? "", it.recognizedText || "(không trả lời)", it.result === "correct" ? "Đúng" : "Sai"]),
      wrong: items.map(it => it.result !== "correct"),
      widths: { 0: 12, 3: 20 },
    };
  }
  if (items[0]?.part) {
    return {
      head: [["Phần", "Số câu đúng"]],
      body: items.map(it => [it.part, `${it.correct}/${it.total}`]),
      wrong: items.map(() => false),
      widths: { 1: 40 },
    };
  }
  return {
    head: [["Câu", "Con trả lời", "Đáp án đúng", "Kết quả"]],
    body: items.map((it, i) => {
      const blanks = Array.isArray(it.blanks) ? it.blanks : null;
      const num = it.group ? `${it.group}.${it.qNumber}` : String(it.qNumber ?? i + 1);
      return [
        it.prompt ? `${num}. ${it.prompt}` : num,
        (blanks ? blanks.map(b => b.studentAnswer || "(trống)").join(" · ") : it.studentAnswer) || "(bỏ trống)",
        (blanks ? blanks.map(b => b.correctAnswer).join(" · ") : it.correctAnswer) ?? "—",
        it.isCorrect ? "Đúng" : "Sai",
      ];
    }),
    wrong: items.map(it => !it.isCorrect),
    widths: { 3: 20 },
  };
}

function drawSheet(pdf, autoTable, r, { className, attemptLabel }) {
  let y = MARGIN;
  // Đầu phiếu
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(11);
  pdf.text("ANH NGỮ C.A.N", MARGIN, y + 4);
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(9);
  pdf.text("anhngucan.com", PAGE_W - MARGIN, y + 4, { align: "right" });
  y += 12;
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(18);
  pdf.text("PHIẾU KẾT QUẢ BÀI LÀM", PAGE_W / 2, y, { align: "center" });
  y += 4;
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // Thông tin + ô điểm
  const info = [
    ["Học sinh", r.studentName || "—"],
    ["Lớp", className || r.studentClass || "—"],
    ["Bài", r.lessonLabel || "—"],
    ["Dạng bài", `${RESULT_MODE_LABEL[r.mode] ?? r.mode ?? "—"}${attemptLabel ? ` · ${attemptLabel}` : ""}`],
    ["Ngày nộp", fmtWhen(toDate(r.submittedAt))],
    ["Thời gian làm", fmtDuration(r.elapsedMs)],
  ];
  pdf.setFontSize(10.5);
  info.forEach(([k, v], i) => {
    pdf.setFont(FONT, "normal");
    pdf.text(`${k}:`, MARGIN, y + i * 6.5);
    pdf.setFont(FONT, "bold");
    pdf.text(pdf.splitTextToSize(String(v), 100)[0], MARGIN + 30, y + i * 6.5);
  });
  const boxX = PAGE_W - MARGIN - 48;
  pdf.setLineWidth(0.5);
  pdf.roundedRect(boxX, y - 5, 48, 34, 2, 2);
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(9);
  pdf.text("ĐIỂM", boxX + 24, y + 1, { align: "center" });
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(22);
  pdf.text(`${fmtNum(r.correct)}/${fmtNum(r.total)}`, boxX + 24, y + 13, { align: "center" });
  const p = pct(r);
  if (p != null) {
    pdf.setFont(FONT, "normal");
    pdf.setFontSize(11);
    pdf.text(`${p}%`, boxX + 24, y + 22, { align: "center" });
  }
  y += info.length * 6.5 + 6;

  // Bảng chi tiết từng câu
  const table = detailTable(r);
  if (table) {
    autoTable(pdf, {
      startY: y,
      head: table.head,
      body: table.body,
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 20 },
      styles: { font: FONT, fontSize: 9.5, textColor: 0, lineColor: 0, lineWidth: 0.2, cellPadding: 2, valign: "middle" },
      headStyles: { font: FONT, fontStyle: "bold", fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.4 },
      columnStyles: Object.fromEntries(Object.entries(table.widths).map(([k, w]) => [k, { cellWidth: w, halign: "center" }])),
      didParseCell: data => {
        if (data.section === "body" && table.wrong[data.row.index]) {
          data.cell.styles.fillColor = [232, 232, 232];
          if (data.column.index === data.table.columns.length - 1) data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = pdf.lastAutoTable.finalY + 8;
  } else {
    pdf.setFont(FONT, "normal");
    pdf.setFontSize(10);
    pdf.text("(Bài này không có chi tiết từng câu.)", MARGIN, y + 2);
    y += 10;
  }

  // Nhận xét + chữ ký — sang trang mới nếu không đủ chỗ.
  if (y > 297 - 70) {
    pdf.addPage();
    y = MARGIN + 4;
  }
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(10.5);
  pdf.text("Nhận xét của giáo viên:", MARGIN, y);
  pdf.setLineWidth(0.2);
  pdf.setLineDashPattern([0.8, 1], 0);
  for (let i = 1; i <= 3; i++) pdf.line(MARGIN, y + i * 8, PAGE_W - MARGIN, y + i * 8);
  pdf.setLineDashPattern([], 0);
  y += 34;
  const colW = (PAGE_W - 2 * MARGIN) / 2;
  pdf.text("Giáo viên", MARGIN + colW / 2, y, { align: "center" });
  pdf.text("Chữ ký phụ huynh", MARGIN + colW + colW / 2, y, { align: "center" });
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(8.5);
  pdf.text("(ký, ghi rõ họ tên)", MARGIN + colW / 2, y + 4.5, { align: "center" });
  pdf.text("(ký, ghi rõ họ tên)", MARGIN + colW + colW / 2, y + 4.5, { align: "center" });
}

// Bảng điểm cả lớp (trang đầu của file cả lớp — dành cho giáo viên, không gửi phụ huynh).
function drawSummary(pdf, autoTable, rows, { title, className, deadline }) {
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(16);
  pdf.text(`BẢNG ĐIỂM LỚP ${className}`, PAGE_W / 2, MARGIN + 6, { align: "center" });
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(10);
  pdf.text(`${title} · Hạn nộp: ${fmtWhen(deadline)}`, PAGE_W / 2, MARGIN + 13, { align: "center" });
  autoTable(pdf, {
    startY: MARGIN + 19,
    head: [["STT", "Học sinh", "Lượt", "Ngày nộp", "Điểm", "%"]],
    body: rows.map((r, i) => [String(i + 1), r.studentName || "—", r.attemptLabel || "", fmtWhen(toDate(r.submittedAt)), `${fmtNum(r.correct)}/${fmtNum(r.total)}`, pct(r) == null ? "—" : `${pct(r)}%`]),
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: FONT, fontSize: 10, textColor: 0, lineColor: 0, lineWidth: 0.2, cellPadding: 2 },
    headStyles: { font: FONT, fontStyle: "bold", fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 16, halign: "center" }, 4: { cellWidth: 22, halign: "center" }, 5: { cellWidth: 16, halign: "center" } },
  });
}

function addPageNumbers(pdf) {
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setFont(FONT, "normal");
    pdf.setFontSize(8);
    pdf.text(`Trang ${i}/${n}`, PAGE_W / 2, 297 - 8, { align: "center" });
  }
}

const safeName = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9.]+/gi, "-").replace(/^-|-$/g, "");

// Nhiều lượt nộp của cùng 1 em → ghi "Lượt 1", "Lượt 2"... theo thời gian nộp.
function labelAttempts(results) {
  const sorted = [...results].sort(
    (a, b) => (a.studentName || "").localeCompare(b.studentName || "", "vi") || (toDate(a.submittedAt)?.getTime() ?? 0) - (toDate(b.submittedAt)?.getTime() ?? 0)
  );
  const count = {};
  sorted.forEach(r => (count[r.uid || r.studentName] = (count[r.uid || r.studentName] ?? 0) + 1));
  const seen = {};
  return sorted.map(r => {
    const k = r.uid || r.studentName;
    seen[k] = (seen[k] ?? 0) + 1;
    return { ...r, attemptLabel: count[k] > 1 ? `Lượt ${seen[k]}` : "" };
  });
}

// Cả lớp theo 1 lần mở bài: trang đầu bảng điểm, sau đó mỗi lượt nộp 1 phiếu (bắt đầu ở trang mới).
export async function downloadClassResultSheets({ results, className, title, deadline }) {
  if (!results.length) throw new Error("Chưa có học sinh nào nộp bài này.");
  const { pdf, autoTable } = await newDoc();
  const rows = labelAttempts(results);
  drawSummary(pdf, autoTable, rows, { title, className, deadline });
  for (const r of rows) {
    pdf.addPage();
    drawSheet(pdf, autoTable, r, { className, attemptLabel: r.attemptLabel });
  }
  // Không đánh số trang chung cả file — phụ huynh nhận phiếu lẻ của con sẽ thấy "Trang 5/30" khó hiểu.
  pdf.save(`Phieu-cham-${safeName(className)}-${safeName(title)}.pdf`);
}

// 1 lượt nộp của 1 em.
export async function downloadResultSheet(result, { className } = {}) {
  const { pdf, autoTable } = await newDoc();
  drawSheet(pdf, autoTable, result, { className });
  addPageNumbers(pdf);
  pdf.save(`Phieu-cham-${safeName(result.studentName)}-${safeName(result.lessonLabel)}.pdf`);
}

// Cửa sổ tải phiếu: từ lúc HẾT HẠN NỘP tới khi kết quả bị xoá (hạn chót + 48h).
export function canDownloadSheets(deadlineMs, now = Date.now()) {
  return deadlineMs != null && now >= deadlineMs && now < deadlineMs + RESULT_KEEP_MS;
}
