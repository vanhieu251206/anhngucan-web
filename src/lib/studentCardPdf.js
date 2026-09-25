// Phiếu đăng nhập riêng từng học sinh, TẢI THẲNG file PDF (không qua hộp thoại in) — chốt 2026-09-25. Chỉ có
// ngay sau khi tạo tài khoản (mật khẩu ban đầu không lưu ở đâu). Vẽ phiếu lên canvas bằng font của web (hiện đúng
// tiếng Việt, không phải nhúng font vào PDF) rồi đặt ảnh vào 1 trang PDF qua jsPDF (tải động, không làm nặng bundle).

// Tên miền thật của web (public/CNAME) — in cho phụ huynh dù giáo viên đang chạy local.
const SITE_URL = "anhngucan.com";
const W = 1500;
const H = 1000;
const ORANGE = "#ff7a45";
const INK = "#2b2a28";
const MUTED = "#7a756d";

// Linh vật trên phiếu: cô bé đội nón lá (co-can.png, thay ong — 2026-09-25).
let mascotPromise = null;
function loadMascot() {
  mascotPromise ??= new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${import.meta.env.BASE_URL}assets/img/mascot/co-can.png`;
  });
  return mascotPromise;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Cắt chữ dài xuống dòng theo bề rộng tối đa.
function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Co cỡ chữ cho vừa bề rộng (tên dài).
function fitFont(ctx, text, weight, size, family, maxWidth) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 24);
}

async function drawCard({ displayName, username, className, schedule, password }) {
  await Promise.all([
    document.fonts.load('800 60px "Baloo 2"'),
    document.fonts.load('700 30px "Nunito"'),
    document.fonts.load('800 30px "Nunito"'),
  ]).catch(() => {});
  const mascot = await loadMascot();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const DISPLAY = '"Baloo 2", "Segoe UI", sans-serif';
  const BODY = 'Nunito, "Segoe UI", sans-serif';

  ctx.fillStyle = "#fffbf2";
  ctx.fillRect(0, 0, W, H);

  // Dải đầu phiếu
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "#ffb27a");
  grad.addColorStop(0.55, ORANGE);
  grad.addColorStop(1, "#2fb6c4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 190);
  // Ảnh dọc (502×732) — giữ đúng tỉ lệ, cao 172px trong dải đầu phiếu.
  if (mascot) ctx.drawImage(mascot, 62, 9, (172 * mascot.width) / mascot.height, 172);
  ctx.fillStyle = "#fff";
  ctx.font = `800 64px ${DISPLAY}`;
  ctx.fillText("Anh Ngữ C.A.N", 215, 100);
  ctx.font = `700 32px ${BODY}`;
  ctx.fillText("Phiếu đăng nhập học online", 218, 148);

  // Tên + lớp
  ctx.fillStyle = INK;
  fitFont(ctx, displayName, 800, 76, DISPLAY, W - 140);
  ctx.fillText(displayName, 70, 300);
  ctx.fillStyle = MUTED;
  ctx.font = `700 34px ${BODY}`;
  ctx.fillText([`Lớp ${className}`, schedule].filter(Boolean).join("   ·   "), 72, 358);

  // 3 dòng thông tin đăng nhập
  const rows = [
    ["Trang web", SITE_URL],
    ["Tên đăng nhập", username],
    ["Mật khẩu", password],
  ];
  rows.forEach(([label, value], i) => {
    const y = 410 + i * 125;
    ctx.fillStyle = "#fff";
    roundRect(ctx, 60, y, W - 120, 105, 22);
    ctx.fill();
    ctx.strokeStyle = "#f0e2d4";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = `700 32px ${BODY}`;
    ctx.fillText(label, 100, y + 66);
    ctx.fillStyle = i === 0 ? INK : "#e85d2e";
    fitFont(ctx, value, 800, 46, i === 0 ? BODY : 'Consolas, "Courier New", monospace', W - 620);
    ctx.fillText(value, 520, y + 70);
  });

  // Lời nhắc phụ huynh
  ctx.fillStyle = MUTED;
  ctx.font = `600 28px ${BODY}`;
  wrapLines(ctx, "Lần đăng nhập đầu tiên, con sẽ được yêu cầu đặt mật khẩu mới. Phụ huynh vui lòng ghi nhớ mật khẩu mới giúp con.", W - 140).forEach(
    (line, i) => ctx.fillText(line, 70, 835 + i * 42)
  );
  return canvas;
}

function fileNameFor(s) {
  return `Phieu-dang-nhap-${s.username}.pdf`;
}

// student: { displayName, username }; info: { className, schedule, password }
export async function downloadStudentCardPdf(student, info) {
  const [{ jsPDF }, canvas] = await Promise.all([import("jspdf"), drawCard({ ...student, ...info })]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [150, 100] });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 150, 100);
  pdf.save(fileNameFor(student));
}

// Cả lớp trong 1 file PDF: giấy A4 dọc, 2 cột × 4 hàng = 8 phiếu/trang (tỉ lệ 3:2 như phiếu lẻ), viền nét đứt để
// cắt; nhiều hơn 8 em thì sang trang mới.
const PAGE_W = 210;
const PAGE_H = 297;
const COLS = 2;
const ROWS = 4;
const GAP = 6;
const CARD_W = 96;
const CARD_H = CARD_W / 1.5;
const MARGIN_X = (PAGE_W - COLS * CARD_W - (COLS - 1) * GAP) / 2;
const MARGIN_Y = (PAGE_H - ROWS * CARD_H - (ROWS - 1) * GAP) / 2;

export async function downloadAllStudentCardPdfs(students, info) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const perPage = COLS * ROWS;
  for (let i = 0; i < students.length; i++) {
    if (i > 0 && i % perPage === 0) pdf.addPage();
    const slot = i % perPage;
    const x = MARGIN_X + (slot % COLS) * (CARD_W + GAP);
    const y = MARGIN_Y + Math.floor(slot / COLS) * (CARD_H + GAP);
    const canvas = await drawCard({ ...students[i], ...info });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", x, y, CARD_W, CARD_H);
    pdf.setDrawColor(190, 184, 174);
    pdf.setLineWidth(0.2);
    pdf.setLineDashPattern([1.5, 1.5], 0);
    pdf.rect(x, y, CARD_W, CARD_H);
  }
  const safeClass = (info.className || "lop").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9.]+/gi, "-");
  pdf.save(`Phieu-dang-nhap-lop-${safeClass}.pdf`);
}
