// Dữ liệu giả (mock) mô phỏng cấu trúc luyện thi Cambridge YLE:
// 3 bộ đề (Starters / Movers / Flyers), mỗi bộ có 4 cấp, mỗi cấp gồm
// 1 phần Listening (video có sẵn) + 1 phần Speaking (luyện nói tương tác).
// Dùng để dựng giao diện trước khi có dữ liệu Google Sheet thật.

// TODO: thay bằng Google Drive File ID thật của từng cấp khi có.
const PLACEHOLDER_VIDEO_ID = "";

function buildLevel(seriesId, number) {
  return {
    id: `${seriesId}-${number}`,
    number,
    listening: [
      {
        videoId: PLACEHOLDER_VIDEO_ID,
        title: `${seriesId} ${number} – Listening (video mẫu)`,
      },
    ],
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
    levels: [1, 2, 3, 4].map(n => buildLevel(id, n)),
  };
}

export const YLE_SERIES = [
  buildSeries("kids", "Kids", "#F2A93B"),
  buildSeries("starters", "Starters", "#FF7A45"),
  buildSeries("movers", "Movers", "#2FB6C4"),
  buildSeries("flyers", "Flyers", "#4CAF7D"),
  buildSeries("ket-pet", "KET / PET", "#8B5CF6"),
  buildSeries("ielts", "IELTS", "#1F3A63"),
];

