// Dữ liệu giả (mock) mô phỏng cấu trúc luyện thi Cambridge YLE:
// 3 bộ đề (Starters / Movers / Flyers), mỗi bộ có 4 cấp, mỗi cấp gồm
// 1 phần Listening (video có sẵn) + 1 phần Speaking (luyện nói tương tác).
// Dùng để dựng giao diện trước khi có dữ liệu Google Sheet thật.

// Cambridge YLE Listening (Starters/Movers/Flyers) luôn có ĐÚNG 3 Test cố định mỗi cấp, mỗi Test
// chia thành các bài nghe theo Part cố định — Starters 2 bài (Part 1&2, Part 3&4), Movers/Flyers
// 3 bài (thêm Part 5). Dùng chung ở đây (mock mặc định khi chưa có dữ liệu Firestore) và ở CMS
// (CreateLessonPage.jsx) để tên bài luôn khớp nhau — CMS lưu đè đúng theo tiêu đề này (chốt 2026-09-04).
export const LISTENING_PART_LABELS = {
  starters: ["Part 1 & 2", "Part 3 & 4"],
  movers: ["Part 1 & 2", "Part 3 & 4", "Part 5"],
  flyers: ["Part 1 & 2", "Part 3 & 4", "Part 5"],
};

export function buildListeningTitles(seriesId, seriesTitle, levelNumber) {
  const parts = LISTENING_PART_LABELS[seriesId];
  if (!parts) return null;
  const titles = [];
  for (let t = 1; t <= 3; t++) {
    for (const part of parts) {
      titles.push(`${seriesTitle} ${levelNumber} - Test ${t} - ${part}`);
    }
  }
  return titles;
}

function buildLevel(seriesId, seriesTitle, number) {
  const fixedTitles = buildListeningTitles(seriesId, seriesTitle, number);
  return {
    id: `${seriesId}-${number}`,
    number,
    listening: fixedTitles
      ? fixedTitles.map(title => ({ videoId: "", title }))
      : [{ videoId: "", title: `${seriesId} ${number} – Listening (video mẫu)` }],
    speaking: [
      { image: "", question: "What's this?", answer_keywords: "" },
      { image: "", question: "What colour is it?", answer_keywords: "red, blue, green, yellow" },
      { image: "", question: "How many are there?", answer_keywords: "one, two, three, four, five" },
    ],
  };
}

function buildSeries(id, title, color) {
  return {
    id,
    title,
    color,
    levels: [1, 2, 3, 4].map(n => buildLevel(id, title, n)),
  };
}

// IELTS KHÔNG chia cấp độ (Band) như YLE — chốt với người dùng 2026-09-11: bấm vào thẻ IELTS ở
// trang chủ vào thẳng "IELTS 8" (level ẩn số 8, đúng tên bộ đề Cambridge IELTS 8 đang soạn — sau
// này thêm bộ khác thì thêm entry vào mảng `levels`, tái dùng đúng cơ chế chọn cấp độ của YLE thay
// vì làm cơ chế "chọn bộ sách" riêng). Bên trong chia theo kỹ năng: READING/LISTENING (Test 1-4,
// mỗi Test có Passage/Section riêng — xem LessonsPage.jsx `isIelts`), WRITING/SPEAKING (chưa làm,
// chỉ hiện placeholder), DICTATION (dùng chung DictationEditor/DictationRunner với YLE).
function buildIeltsSeries() {
  return {
    id: "ielts",
    title: "IELTS",
    color: "#1F3A63",
    levels: [{ id: "ielts-8", number: 8, listening: [], speaking: [] }],
  };
}

// KET/PET KHÔNG dùng cấu trúc Level/Test/Part như YLE — tổ chức theo Grade (6-9) → Unit (1-16) →
// Vocabulary/Practice Test, giống chương trình SGK phổ thông chứ không theo format đề thi Cambridge
// (chốt với người dùng 2026-09-14). Vì vậy chỉ giữ id/title/color để hiện thẻ ở Trang chủ, phần
// điều hướng Grade/Unit nằm riêng ở KetPetPage.jsx (không đi qua LessonsPage.jsx như các bộ khác).
const ketPetSeries = { id: "ket-pet", title: "KET / PET", color: "#8B5CF6" };

export const YLE_SERIES = [
  buildSeries("kids", "Kids", "#F2A93B"),
  buildSeries("starters", "Starters", "#FF7A45"),
  buildSeries("movers", "Movers", "#2FB6C4"),
  buildSeries("flyers", "Flyers", "#4CAF7D"),
  ketPetSeries,
  buildIeltsSeries(),
];

// Grade 6-9, mỗi Grade 16 Unit — khung cố định dùng cho điều hướng KetPetPage.jsx (chưa có nội
// dung thật, chỉ tạo cấu trúc trước theo yêu cầu người dùng 2026-09-14).
export const KET_PET_GRADES = [6, 7, 8, 9];
export const KET_PET_UNITS_PER_GRADE = 16;
