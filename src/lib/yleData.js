// Dữ liệu giả (mock) mô phỏng cấu trúc luyện thi Cambridge YLE:
// 3 bộ đề (Starters / Movers / Flyers), mỗi bộ có 4 cấp, mỗi cấp gồm
// 1 phần Listening (video có sẵn) + 1 phần Speaking (luyện nói tương tác).
// Dùng để dựng giao diện trước khi có dữ liệu Google Sheet thật.

// TODO: thay bằng videoId YouTube (Không công khai) thật của từng cấp khi có.
const PLACEHOLDER_VIDEO_ID = "M7lc1UVf-VE";

function buildLevel(seriesId, number) {
  return {
    id: `${seriesId}-${number}`,
    number,
    listening: {
      videoId: PLACEHOLDER_VIDEO_ID,
      title: `${seriesId} ${number} – Listening (video mẫu)`,
    },
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
  buildSeries("starters", "Starters", "#FF7A45"),
  buildSeries("movers", "Movers", "#2FB6C4"),
  buildSeries("flyers", "Flyers", "#4CAF7D"),
];

// Speaking Part 1 — dữ liệu THẬT lấy từ Starters_1.pdf (Answer Booklet) + STARTER 1 (sách màu).pdf, Test 1.
// Quy trình soạn: xem docs/quy-trinh/scene-data/ (thư mục làm việc: Bài học/starters-1-test1-part1/)
// Ảnh: cắt thật từ sách màu (trang 46 scene, trang 47 object cards), toạ độ target đo trực tiếp trên ảnh thật.
// Dùng import.meta.env.BASE_URL (khớp `base` trong vite.config.js) thay vì "/assets/..." tuyệt đối,
// vì GitHub Pages phục vụ ở subpath (vd /anhngucan-web/) — đường dẫn tuyệt đối từ gốc domain sẽ sai.
const P1_IMG = `${import.meta.env.BASE_URL}assets/img/speaking/starters/1/test1/part1`;
const STARTERS_1_TEST1_PART1 = [
  {
    type: "scene-click",
    sceneImage: `${P1_IMG}/scene.jpg`,
    question: "Where's the monkey?",
    target: { id: "monkey", label: "monkey", x: 34, y: 78, w: 18, h: 18 },
    followupQuestion: "Is this the monkey?",
  },
  {
    type: "scene-click",
    sceneImage: `${P1_IMG}/scene.jpg`,
    question: "Where are the oranges?",
    target: { id: "oranges", label: "oranges", x: 49, y: 39, w: 16, h: 17 },
    followupQuestion: "Are these the oranges?",
  },
  {
    type: "card-select",
    question: "Which is the shell?",
    options: [
      { id: "shell", label: "shell", image: `${P1_IMG}/card-shell.jpg` },
      { id: "book", label: "book", image: `${P1_IMG}/card-book.jpg` },
      { id: "pen", label: "pen", image: `${P1_IMG}/card-pen.jpg` },
    ],
    correctId: "shell",
  },
  {
    type: "card-select",
    question: "Which is the book/pen?",
    options: [
      { id: "book", label: "book/pen", image: `${P1_IMG}/card-book.jpg` },
      { id: "shell", label: "shell", image: `${P1_IMG}/card-shell.jpg` },
      { id: "pen2", label: "pen", image: `${P1_IMG}/card-pen.jpg` },
    ],
    correctId: "book",
  },
];

const starters1 = YLE_SERIES[0].levels[0];
starters1.speakingPart1 = STARTERS_1_TEST1_PART1;
