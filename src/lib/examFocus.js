// Giám sát RỜI TAB khi học sinh đang làm bài (2026-10-03, người dùng chốt: chỉ cảnh báo + ghi lại, KHÔNG tự nộp bài).
// Trình duyệt không cho chặn việc chuyển tab/ứng dụng — chỉ phát hiện được: tab bị ẩn (`visibilitychange`: chuyển
// tab, thu nhỏ, sang ứng dụng khác, tắt màn hình) hoặc cửa sổ mất focus (`blur`: bấm sang cửa sổ/màn hình chia đôi).
// Bật trong useTestSubmission() (lib/testSubmit.js) cho mọi dạng bài khi học sinh làm bài thật (có openingId);
// danh sách lần rời tab gửi kèm lúc nộp, Worker ghi vào `testResults.tabLeaves` → giáo viên xem ở "Kết quả học sinh"
// + phiếu chấm, bị xoá theo luật 48h như kết quả. Giao diện cảnh báo: components/ExamFocusOverlay.jsx.
const MAX_LEAVES = 50;
// Mất focus dưới 1 giây mà tab vẫn hiện (lỡ bấm ra ngoài cửa sổ rồi bấm lại ngay) thì bỏ qua.
const BLUR_MIN_MS = 1000;

let state = { active: false, count: 0, alert: false, notice: false };
const listeners = new Set();
let leaves = []; // [{ at: ms, awayMs }]
let away = null; // { at, hidden } — đang rời tab
let current = null; // phiên giám sát đang chạy (để cleanup của phiên cũ không tắt nhầm phiên mới)

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

export function subscribeExamFocus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getExamFocusState = () => state;

function begin(hidden) {
  if (away) {
    if (hidden) away.hidden = true;
    return;
  }
  away = { at: Date.now(), hidden };
}

const counts = a => a.hidden || Date.now() - a.at >= BLUR_MIN_MS;

function end() {
  if (!away) return;
  const record = { at: away.at, awayMs: Date.now() - away.at };
  const counted = counts(away);
  away = null;
  if (!counted) return;
  if (leaves.length < MAX_LEAVES) leaves.push(record);
  set({ count: state.count + 1, alert: true, notice: false });
}

// Bắt đầu giám sát 1 lượt làm bài → hàm dừng. `watchBlur = false` cho Speaking: hộp xin quyền micro của trình duyệt
// cũng làm cửa sổ mất focus, không thể coi là rời bài.
export function startExamFocus({ watchBlur = true } = {}) {
  current?.stop();
  leaves = [];
  away = null;
  const onVisibility = () => (document.visibilityState === "hidden" ? begin(true) : end());
  const onFocus = () => end();
  // Bấm vào iframe nhúng trong bài (video/audio) cũng làm cửa sổ mất focus — không tính.
  const onBlur = () => setTimeout(() => {
    if (document.hasFocus() || document.activeElement?.tagName === "IFRAME") return;
    begin(false);
  }, 0);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onFocus);
  if (watchBlur) window.addEventListener("blur", onBlur);

  const session = {
    stop() {
      if (current !== session) return;
      current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      away = null;
      set({ active: false, alert: false, notice: false });
    },
  };
  current = session;
  set({ active: true, count: 0, alert: false, notice: true });
  return session.stop;
}

// Các lần rời tab của lượt đang làm (gửi kèm lúc nộp) — tính cả lần đang rời dở (bài tự nộp vì hết giờ lúc em vắng).
export function getExamLeaves() {
  if (!current) return [];
  const list = away && counts(away) ? [...leaves, { at: away.at, awayMs: Date.now() - away.at }] : leaves;
  return list.slice(0, MAX_LEAVES);
}

export function dismissExamAlert() {
  set({ alert: false });
}

export function dismissExamNotice() {
  set({ notice: false });
}

// "12 giây" / "3 phút 05 giây" — dùng chung cho trang Kết quả học sinh và phiếu chấm.
export function formatAway(ms) {
  const sec = Math.max(1, Math.round((ms || 0) / 1000));
  return sec < 60 ? `${sec} giây` : `${Math.floor(sec / 60)} phút ${String(sec % 60).padStart(2, "0")} giây`;
}
