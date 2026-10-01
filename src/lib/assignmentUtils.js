import { OPENING_KINDS } from "./openings.js";
import { YLE_SERIES } from "./yleData.js";
import { navigateApp } from "./urlState.js";

// Hàm hiển thị dùng chung cho chuông thông báo (AssignmentBell.jsx) và trang "Bài của con" (MyWorkPage.jsx).
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const pad = n => String(n).padStart(2, "0");
const HOUR = 3600 * 1000;

export function levelLabel(o) {
  if (o.seriesId === "ket-pet") return `KET/PET · Grade ${o.level}`;
  const series = YLE_SERIES.find(s => s.id === o.seriesId);
  return `${series?.title ?? o.seriesId} ${o.level}`;
}

export function kindLabel(o) {
  return OPENING_KINDS[o.kind] ?? o.kind;
}

export function formatDateTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${WEEKDAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// "còn 5 phút" / "còn 3 giờ" / "còn 2 ngày" (ms > 0).
export function timeLeft(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `còn ${mins} phút`;
  if (mins < 24 * 60) return `còn ${Math.floor(mins / 60)} giờ`;
  return `còn ${Math.floor(mins / 1440)} ngày`;
}

export function deadlineInfo(o, now = Date.now()) {
  const d = o.expiresAt?.toDate?.();
  if (!d) return { text: "Không có hạn chót", left: "", urgent: false };
  const ms = d.getTime() - now;
  return { text: formatDateTime(d), left: ms > 0 ? timeLeft(ms) : "", urgent: ms > 0 && ms < 24 * HOUR };
}

// Mức nhắc hạn của bài CHƯA LÀM: "1h" (còn < 1 giờ), "24h" (còn < 24 giờ) hoặc null.
export function reminderStage(o, now = Date.now()) {
  const ms = (o.expiresAt?.toMillis?.() ?? Infinity) - now;
  if (ms <= 0) return null;
  if (ms < HOUR) return "1h";
  if (ms < 24 * HOUR) return "24h";
  return null;
}

// "18/20" hoặc null khi bài nộp trước lúc Worker bắt đầu lưu điểm tóm tắt.
export function scoreText(correct, total) {
  return correct != null && total != null ? `${correct}/${total}` : null;
}

// Bấm 1 bài → vào thẳng bài đó (LessonsPage/KetPetPage đọc ?go=<kind>~<testId>).
function assignmentParams(o) {
  if (o.seriesId === "kids") return { page: "lessons", series: "kids" };
  return { page: "lessons", series: o.seriesId, level: o.level, go: `${o.kind}~${o.testId}` };
}

export function openAssignment(o) {
  navigateApp(assignmentParams(o));
}

// Link đầy đủ tới 1 bài để giáo viên gửi cho học sinh (nút "Copy link" ở trang Mở bài) — cùng tham số với
// openAssignment(); chưa đăng nhập thì App.jsx hiện form đăng nhập rồi vào thẳng bài. Đi qua trang tĩnh
// public/bai/index.html (ảnh + tiêu đề xem trước riêng khi dán link vào Zalo...) rồi mới chuyển vào app.
// Dev server của Vite không phục vụ thư mục /bai/ (trả về app) nên lúc dev link vào thẳng app.
export function assignmentLink(o) {
  const query = new URLSearchParams(assignmentParams(o)).toString();
  return `${window.location.origin}${window.location.pathname}${import.meta.env.DEV ? "" : "bai/"}?${query}`;
}
