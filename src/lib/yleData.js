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
// Quy trình soạn: xem docs/quy-trinh/ (B0 chia scene, B1 tạo ảnh, B2 đưa ảnh vào code, B3 code scene).
// Nguồn scene: Bài học/starters-1-test1-part1/scene-list.md (11 scene, đủ từ đầu tới cuối Part 1).
// Dùng import.meta.env.BASE_URL (khớp `base` trong vite.config.js) thay vì "/assets/..." tuyệt đối,
// vì GitHub Pages phục vụ ở subpath (vd /anhngucan-web/) — đường dẫn tuyệt đối từ gốc domain sẽ sai.
const P1_IMG = `${import.meta.env.BASE_URL}assets/img/speaking/starters/1/test1/part1`;
const SCENE = `${P1_IMG}/scene.jpg`;
const CARD = {
  shell: `${P1_IMG}/card-shell.jpg`,
  book: `${P1_IMG}/card-book.jpg`,
  pen: `${P1_IMG}/card-pen.jpg`,
  clock: `${P1_IMG}/card-clock.jpg`,
};

// STT khớp đúng scene-list.md
const STARTERS_1_TEST1_PART1 = [
  // 1 — Chao-hoi
  {
    type: "mic",
    examinerLine: "Hello. My name's Jane.",
    answerTemplate: "Hello.",
  },
  // 2 — Chao-hoi
  {
    type: "mic",
    examinerLine: "What's your name?",
    answerTemplate: "My name is ....",
    followupQuestion: "Is your name (child's name)?",
    followupAnswerTemplate: "Yes.",
  },
  // 3 — Huong-dan
  {
    type: "narration",
    examinerLine: "Look at this. This is a food shop. The man is looking at the fruit.",
    sceneImage: SCENE,
  },
  // 4 — Huong-dan
  {
    type: "narration",
    examinerLine: "Here's the lemonade.",
    sceneImage: SCENE,
  },
  // 5 — Canh-click
  {
    type: "scene-click",
    examinerLine: "Where's the monkey?",
    sceneImage: SCENE,
    target: { id: "monkey", label: "monkey", x: 34, y: 78, w: 18, h: 18 },
    followupQuestion: "Is this the monkey?",
  },
  // 6 — Canh-click
  {
    type: "scene-click",
    examinerLine: "Where are the oranges?",
    sceneImage: SCENE,
    target: { id: "oranges", label: "oranges", x: 49, y: 39, w: 16, h: 17 },
    followupQuestion: "Are these the oranges?",
  },
  // 7 — The-chon
  {
    type: "card-select",
    examinerLine: "Now look at these. Which is the shell?",
    options: [
      { id: "shell", label: "shell", image: CARD.shell },
      { id: "book", label: "book", image: CARD.book },
      { id: "pen", label: "pen", image: CARD.pen },
      { id: "clock", label: "clock", image: CARD.clock },
    ],
    correctId: "shell",
    followupQuestion: "Is this the shell?",
  },
  // 8 — Huong-dan
  {
    type: "narration",
    examinerLine: "I'm putting the shell on the door.",
    sceneImage: SCENE,
  },
  // 9 — Dat-vi-tri
  {
    type: "drag-drop",
    examinerLine: "Now you put the shell between the watermelons.",
    sceneImage: SCENE,
    card: { id: "shell", label: "shell", image: CARD.shell },
    target: { id: "watermelons", label: "between the watermelons", x: 66, y: 28, w: 13, h: 24 },
    followupLine: "Between the watermelons.",
  },
  // 10 — The-chon
  {
    type: "card-select",
    examinerLine: "Which is the book/pen?",
    options: [
      { id: "book", label: "book/pen", image: CARD.book },
      { id: "shell", label: "shell", image: CARD.shell },
      { id: "pen2", label: "pen", image: CARD.pen },
      { id: "clock", label: "clock", image: CARD.clock },
    ],
    correctId: "book",
    followupQuestion: "Is this the book/pen?",
  },
  // 11 — Dat-vi-tri
  {
    type: "drag-drop",
    examinerLine: "Put the book/pen in front of the babies.",
    sceneImage: SCENE,
    card: { id: "book", label: "book/pen", image: CARD.book },
    target: { id: "babies", label: "in front of the babies", x: 38, y: 74, w: 12, h: 12 },
    followupLine: "In front of the babies.",
  },
];

const starters1 = YLE_SERIES[0].levels[0];
starters1.speakingPart1 = STARTERS_1_TEST1_PART1;
