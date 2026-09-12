// Chỗ trống trong dạng "Bảng / đoạn văn / sơ đồ điền từ" (table-diagram) — ĐƠN GIẢN NHẤT có thể
// (chốt 2026-09-12, thay hẳn cơ chế gõ tay token {{n}} cũ hay bị lệch số khi thêm/xoá): giáo viên
// chỉ cần gõ 3 dấu gạch dưới liền nhau "___" ngay tại chỗ cần trống, KHÔNG cần biết/gõ số thứ tự.
// Đáp án của từng chỗ trống lưu NGAY TRONG ô/đoạn văn chứa nó (mảng `answers`, độ dài luôn tự khớp
// số "___" tìm thấy trong `text` — xem PracticeStudio.jsx `TableDiagramEditor`) nên không thể lệch.
// Số thứ tự THẬT hiển thị cho học sinh (1..N xuyên suốt cả Test) được tính bằng cách quét theo đúng
// thứ tự: bảng (theo hàng, theo cột) → đoạn văn (theo thứ tự) → sơ đồ (theo thứ tự thêm điểm) — xem
// `deriveTableDiagramBlanks()`, dùng chung ở cả CMS lẫn IeltsPracticeRunner.jsx để luôn khớp nhau.
export const BLANK_MARK = "___";
const BLANK_RE = /_{3,}/g;

export function countBlanks(text) {
  return (String(text ?? "").match(BLANK_RE) ?? []).length;
}

// Chuẩn hoá 1 cell/paragraph về dạng { text, answers } — chấp nhận cả dữ liệu cũ (chuỗi thô dùng
// token {{n}}) để không vỡ dữ liệu đã lưu trước đây, tự đổi token cũ thành "___".
export function normalizeBlankHolder(value) {
  if (value && typeof value === "object") return { text: value.text ?? "", answers: value.answers ?? [] };
  const text = String(value ?? "").replace(/\{\{\d+\}\}/g, BLANK_MARK);
  return { text, answers: [] };
}

// Danh sách chỗ trống theo ĐÚNG thứ tự sẽ hiển thị cho học sinh (dùng để đánh số + chấm điểm).
export function deriveTableDiagramBlanks(group) {
  const blanks = [];
  (group.table?.rows ?? []).forEach(row => {
    (row.cells ?? []).forEach(cellRaw => {
      const cell = normalizeBlankHolder(cellRaw);
      const n = countBlanks(cell.text);
      for (let k = 0; k < n; k++) blanks.push({ acceptedAnswers: cell.answers[k] ?? "" });
    });
  });
  (group.paragraphs ?? []).forEach(pRaw => {
    const p = normalizeBlankHolder(pRaw);
    const n = countBlanks(p.text);
    for (let k = 0; k < n; k++) blanks.push({ acceptedAnswers: p.answers[k] ?? "" });
  });
  (group.diagramPoints ?? []).forEach(pt => {
    blanks.push({ acceptedAnswers: pt?.answer ?? "" });
  });
  return blanks;
}

// Số chỗ trống nằm trong bảng+đoạn văn (KHÔNG tính sơ đồ) — sơ đồ có ô nhập riêng đè lên ảnh, còn
// lại (bảng/đoạn văn) dùng chung 1 danh sách input tách riêng bên dưới (xem AnswerList trong
// IeltsPracticeRunner.jsx) — 2 nhóm này không trùng nhau nhờ luôn đứng ĐẦU danh sách theo thứ tự
// quét ở `deriveTableDiagramBlanks`.
export function textBlankCount(group) {
  let n = 0;
  (group.table?.rows ?? []).forEach(row => (row.cells ?? []).forEach(c => { n += countBlanks(normalizeBlankHolder(c).text); }));
  (group.paragraphs ?? []).forEach(p => { n += countBlanks(normalizeBlankHolder(p).text); });
  return n;
}

// Tổng số câu hỏi CHẤM ĐIỂM của 1 nhóm, bất kể dạng — dùng để tính "Question N" thật hiển thị cho
// học sinh khi soạn (xem PracticeStudio.jsx `LuyenDePage` tính `startNumber` cộng dồn các nhóm đứng
// trước trong CÙNG passage).
export function groupQuestionCount(group) {
  if (group.type === "table-diagram") return deriveTableDiagramBlanks(group).length;
  if (group.type === "diagram") return (group.diagramPoints ?? []).length;
  return (group.questions ?? []).length;
}
