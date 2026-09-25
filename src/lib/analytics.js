// Google Analytics 4 (miễn phí) — CHỈ bật khi có VITE_GA_MEASUREMENT_ID (xem .env.example), để trống thì không tải
// gì cả. Chỉ gửi tên trang (?page=...), KHÔNG gửi tên/tài khoản học sinh. Thêm 2026-09-25 (audit trước launch).
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let ready = false;

export function initAnalytics() {
  if (!MEASUREMENT_ID || ready) return;
  ready = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js đọc đúng đối tượng `arguments` trong dataLayer — không đổi thành mảng/rest params.
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  // Web 1 trang (đổi trang không tải lại) — tự gửi page_view mỗi lần đổi trang ở trackPage().
  window.gtag("config", MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

export function trackPage(page, title) {
  if (!ready) return;
  window.gtag("event", "page_view", {
    page_title: title,
    page_location: `${window.location.origin}${window.location.pathname}${page === "home" ? "" : `?page=${page}`}`,
  });
}
