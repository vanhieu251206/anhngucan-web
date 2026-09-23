import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = PdfWorker;

// Tách 1 file PDF (sách quét) thành ảnh JPEG từng trang NGAY TRÊN TRÌNH DUYỆT (pdf.js) — không có
// backend nên không thể xử lý phía server (xem CLAUDE.md mục 2). scale 2 = ~144dpi, đủ nét để đọc
// trên màn hình mà không quá nặng khi tải lên Cloudinary.
export async function pdfToPageImages(file, { scale = 2, onProgress } = {}) {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const files = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
    files.push(new File([blob], `page-${i}.jpg`, { type: "image/jpeg" }));
    onProgress?.(i, pdf.numPages);
  }
  return files;
}
