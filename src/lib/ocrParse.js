// Tiện ích tách chữ OCR thô (tesseract.js) thành đoạn văn / câu hỏi thô — dùng chung cho các nút
// "Tải ảnh trang sách (OCR)" trong CMS (PracticeStudio.jsx). Đây là công cụ NHẬN DIỆN CHỮ TỰ ĐỘNG
// từ ảnh do CHÍNH giáo viên tải lên (sách họ sở hữu) — không phải nội dung Claude tự gõ/nhớ lại,
// và ảnh KHÔNG được lưu lên Cloudinary/Firestore, chỉ xử lý tạm trong trình duyệt rồi bỏ (xem
// OcrImportPanel.jsx). Giáo viên luôn xem lại/sửa kết quả trước khi Xuất bản.

// Tách đoạn văn theo dòng trống (cách OCR thường giữ lại xuống dòng giữa các đoạn) — nối các dòng
// bị ngắt giữa chừng trong cùng 1 đoạn thành 1 câu liền mạch.
export function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

// Tách các dòng OCR thành danh sách câu hỏi thô: dòng bắt đầu bằng số thứ tự là 1 câu mới, các
// dòng theo sau bắt đầu A/B/C/D (kèm dấu . hoặc )) được gom làm lựa chọn trắc nghiệm của câu đó,
// dòng thường khác được nối tiếp vào câu đang mở (OCR hay ngắt dòng giữa câu dài).
export function parseQuestionLines(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  let current = null;
  const qRe = /^(\d{1,2})[.\s]+(.*)$/;
  const optRe = /^([A-D])[.\)]\s*(.*)$/;
  for (const line of lines) {
    const om = line.match(optRe);
    const qm = !om ? line.match(qRe) : null;
    if (qm) {
      current = { number: Number(qm[1]), text: qm[2], options: [] };
      items.push(current);
    } else if (om && current) {
      current.options.push(om[2]);
    } else if (current) {
      current.text = `${current.text} ${line}`.trim();
    }
  }
  return items;
}
