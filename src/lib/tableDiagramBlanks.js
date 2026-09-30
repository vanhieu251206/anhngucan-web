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

// Khi giáo viên sửa đoạn văn có chỗ trống (chèn/xoá "___" ở GIỮA), đáp án phải đi theo đúng chỗ trống của nó — trước
// đây đáp án lưu theo thứ tự nên chèn 1 chỗ trống ở giữa làm mọi đáp án phía sau lệch 1 câu (2026-09-30). Trả về
// mảng dài bằng số chỗ trống MỚI: phần tử i = vị trí chỗ trống cũ tương ứng, hoặc null nếu là chỗ trống mới chèn.
// Cách làm: phần đầu + phần cuối giống nhau của 2 bản text là vùng không đổi; chỗ trống nằm trọn trong đó giữ đáp án.
export function blankIndexMap(oldText, newText, re = BLANK_RE) {
  const a = String(oldText ?? "");
  const b = String(newText ?? "");
  const spans = t => [...t.matchAll(new RegExp(re.source, "g"))].map(m => [m.index, m.index + m[0].length]);
  const oldSpans = spans(a);
  const newSpans = spans(b);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const oldBefore = oldSpans.filter(([, e]) => e <= p).length;
  const newBefore = newSpans.filter(([, e]) => e <= p).length;
  const oldAfter = oldSpans.filter(([st]) => st >= a.length - s).length;
  const newAfter = newSpans.filter(([st]) => st >= b.length - s).length;
  const oldMid = oldSpans.length - oldBefore - oldAfter;
  const newMid = newSpans.length - newBefore - newAfter;
  const map = [];
  for (let i = 0; i < newBefore; i++) map.push(i);
  // Vùng bị sửa: giữ đáp án theo thứ tự nếu còn, chỗ trống dư là mới.
  for (let i = 0; i < newMid; i++) map.push(i < oldMid ? oldBefore + i : null);
  for (let i = 0; i < newAfter; i++) map.push(oldSpans.length - newAfter + i);
  return map;
}

// Sắp lại 1 mảng giá trị theo từng chỗ trống (đáp án, lựa chọn...) theo blankIndexMap. `empty()` = giá trị cho chỗ mới.
export function remapByBlanks(values, map, empty = () => "") {
  return map.map(oldIdx => (oldIdx == null ? empty() : values?.[oldIdx] ?? empty()));
}
