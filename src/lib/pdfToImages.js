import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = PdfWorker;

// Bộ giải mã ảnh của pdf.js (JBIG2/CCITT Fax, JPEG 2000, màu ICC) nằm ở file riêng, pdf.js tự tải từ thư mục này khi
// gặp ảnh dạng đó. Thiếu thì trang sách scan trắng đen (CCITT Fax — vd Cambridge IELTS 9) ra TRẮNG TRƠN, chỉ còn chữ
// (lỗi thật 2026-10-10). File chép từ node_modules/pdfjs-dist/wasm sang public/pdfjs-wasm — nâng phiên bản pdfjs-dist
// thì chép lại. URL tuyệt đối vì worker của pdf.js tự tải (đường dẫn tương đối sẽ tính theo thư mục assets/).
const WASM_URL = new URL(`${import.meta.env.BASE_URL}pdfjs-wasm/`, document.baseURI).href;

// Tách 1 file PDF (sách quét) thành ảnh JPEG từng trang NGAY TRÊN TRÌNH DUYỆT (pdf.js) — không có
// backend nên không thể xử lý phía server (xem CLAUDE.md mục 2). scale 2 = ~144dpi, đủ nét để đọc
// trên màn hình mà không quá nặng khi tải lên Cloudinary.
export async function pdfToPageImages(file, { scale = 2, onProgress } = {}) {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer, wasmUrl: WASM_URL }).promise;
  const files = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // Thử lại 1 lần: toBlob trả null khi trình duyệt tạm hết bộ nhớ đồ hoạ (sách dày hàng trăm trang).
    const blob = (await renderPageBlob(page, scale)) ?? (await renderPageBlob(page, scale));
    page.cleanup();
    // Không kiểm tra thì File([null]) thành file chữ "null" — Cloudinary báo "Raw file format jpg not allowed" (lỗi thật 2026-10-10).
    if (!blob) throw new Error(`Không tạo được ảnh trang ${i} (trình duyệt hết bộ nhớ) — đóng bớt tab rồi thử lại`);
    files.push(new File([blob], `page-${i}.jpg`, { type: "image/jpeg" }));
    onProgress?.(i, pdf.numPages);
  }
  return files;
}

async function renderPageBlob(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  try {
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } finally {
    // Trả bộ nhớ canvas ngay — không thì hàng trăm canvas dồn lại tới khi trình duyệt tự dọn.
    canvas.width = 0;
    canvas.height = 0;
  }
}
