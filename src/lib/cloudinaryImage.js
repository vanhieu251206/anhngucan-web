// Tự nén ảnh Cloudinary khi hiển thị (2026-09-25): chèn `f_auto,q_auto` vào URL để Cloudinary trả định dạng nhẹ
// nhất trình duyệt hỗ trợ (WebP/AVIF) với chất lượng tự chọn — giảm ~40-70% băng thông (credit Cloudinary) và tải
// nhanh hơn trên 4G. Ảnh gốc trong Firestore/Cloudinary giữ nguyên, chỉ đổi URL lúc hiển thị. Mỗi bản nén chỉ tốn
// 1 transformation lần đầu rồi được Cloudinary cache.
//
// KHÔNG dùng cho ảnh cần đọc đúng từng điểm ảnh (tô màu Listening Part 4 — StartersListeningPart4.jsx): nén lossy
// làm nhoè viền, hỏng thuật toán tô vùng. URL không phải ảnh Cloudinary (asset nội bộ, data:, blob:) trả nguyên.
const UPLOAD_MARKER = "/image/upload/";

// maxWidth (tuỳ chọn): thu ảnh về tối đa bề ngang này (c_limit — không phóng to ảnh nhỏ hơn) cho nơi khung hiển
// thị nhỏ hơn hẳn ảnh gốc (vd bài Speaking), tải nhanh hơn trên mạng chậm.
export function optimizeImage(url, { maxWidth } = {}) {
  if (typeof url !== "string" || !url.startsWith("https://res.cloudinary.com/")) return url;
  const i = url.indexOf(UPLOAD_MARKER);
  if (i === -1 || /\.svg($|\?)/i.test(url)) return url;
  const head = url.slice(0, i + UPLOAD_MARKER.length);
  const rest = url.slice(i + UPLOAD_MARKER.length);
  // Đã có f_auto ở bước transformation đầu thì không chèn lại.
  if (/(^|,)f_auto(,|$)/.test(rest.split("/")[0])) return url;
  return `${head}f_auto,q_auto${maxWidth ? `,c_limit,w_${maxWidth}` : ""}/${rest}`;
}
