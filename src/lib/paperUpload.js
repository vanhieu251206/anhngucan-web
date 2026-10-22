import { uploadWithRetry } from "./cloudinaryUpload.js";
import { pdfToPageImages } from "./pdfToImages.js";

// Tải ĐỀ của Practice Test KET/PET dạng "Đề tải lên" (lib/ketPetPracticeTest.js `answerSheetGroup`):
// - PDF: tách từng trang thành ảnh JPEG ngay trên trình duyệt rồi tải lên Cloudinary → { pages: [url] }. Ảnh nhẹ hơn
//   file PDF scan nhiều (băng thông Cloudinary free) và xem trên điện thoại mượt hơn.
// - Word (.docx): đổi sang HTML bằng mammoth (ảnh trong file tải lên Cloudinary) → { html }. File .doc đời cũ
//   mammoth không đọc được — báo cô lưu lại thành .docx hoặc PDF.
export async function uploadPaper(file, onStage) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    onStage?.("Đang tách trang...");
    const images = await pdfToPageImages(file, {
      scale: 1.75,
      onProgress: (done, total) => onStage?.(`Đang tách trang ${done}/${total}...`),
    });
    const pages = [];
    for (let i = 0; i < images.length; i++) {
      onStage?.(`Đang tải lên ${i + 1}/${images.length}...`);
      pages.push(await uploadWithRetry(images[i], i + 1));
    }
    return { pages, fileName: file.name };
  }
  if (name.endsWith(".docx")) {
    onStage?.("Đang đọc file Word...");
    const mod = await import("mammoth/mammoth.browser.js");
    const mammoth = mod.default ?? mod;
    let imageNo = 0;
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      {
        convertImage: mammoth.images.imgElement(async image => {
          imageNo += 1;
          onStage?.(`Đang tải ảnh ${imageNo} lên...`);
          const blob = new Blob([await image.read()], { type: image.contentType });
          const ext = image.contentType.split("/")[1] || "png";
          return { src: await uploadWithRetry(new File([blob], `word-${imageNo}.${ext}`, { type: image.contentType }), imageNo) };
        }),
      },
    );
    return { html: sanitizePaperHtml(result.value), fileName: file.name };
  }
  if (name.endsWith(".doc")) throw new Error("File .doc đời cũ chưa đọc được — mở bằng Word rồi lưu lại thành .docx hoặc PDF.");
  throw new Error("Chỉ nhận file PDF hoặc Word (.docx).");
}

const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "S", "SUB", "SUP", "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "IMG", "A", "SPAN", "BLOCKQUOTE"]);

// Chỉ giữ thẻ định dạng cơ bản mammoth sinh ra — bỏ mọi thuộc tính trừ ảnh (src https) và gộp ô bảng.
export function sanitizePaperHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  root.querySelectorAll("*").forEach(el => {
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") {
      el.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...el.childNodes);
      return;
    }
    [...el.attributes].forEach(attr => {
      const keep = (el.tagName === "IMG" && attr.name === "src" && attr.value.startsWith("https://"))
        || (el.tagName === "IMG" && attr.name === "alt")
        || ((el.tagName === "TD" || el.tagName === "TH") && (attr.name === "colspan" || attr.name === "rowspan"));
      if (!keep) el.removeAttribute(attr.name);
    });
  });
  return root.innerHTML;
}
