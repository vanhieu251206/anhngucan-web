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
const P1_AUDIO = `${import.meta.env.BASE_URL}assets/audio/speaking/starters/1/test1/part1`;
const SCENE = `${P1_IMG}/scene.jpg`;
const CARD = {
  shell: `${P1_IMG}/card-shell.jpg`,
  book: `${P1_IMG}/card-book.jpg`,
  pen: `${P1_IMG}/card-pen.jpg`,
  clock: `${P1_IMG}/card-clock.jpg`,
};

// Câu hỏi phụ (Back-up questions) giờ là SCENE RIÊNG, cùng loại tương tác với câu chính
// (học sinh phải tương tác lại thật sự, không chỉ nghe rồi qua) — chốt 2026-08-13.
// Ngoại lệ: 2 scene Dat-vi-tri (kéo-thả) KHÔNG tách câu hỏi phụ thành scene riêng vì
// không hợp lý khi bắt kéo-thả lại lần 2 sau khi đã đặt đúng — vẫn đọc thêm câu phụ tại chỗ.
const STARTERS_1_TEST1_PART1 = [
  // 1 — Chao-hoi (Câu 1/16)
  {
    type: "mic",
    examinerLine: "Hello. My name's Jane.",
    answerTemplate: "Hello.",
    audioUrl: `${P1_AUDIO}/01-hello.mp3`,
  },
  // 2 — Chao-hoi (câu chính) (Câu 2/16)
  {
    type: "mic",
    examinerLine: "What's your name?",
    answerTemplate: "My name is ....",
    audioUrl: `${P1_AUDIO}/02-whats-your-name.mp3`,
  },
  // 2b — Chao-hoi (câu hỏi phụ, scene riêng) (Câu 3/16)
  {
    type: "mic",
    examinerLine: "Is your name (child's name)?",
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "either", // phụ thuộc tên thật của học sinh, app không biết trước — chấp nhận cả 2
    audioUrl: `${P1_AUDIO}/02-followup.mp3`,
  },
  // 3 — Huong-dan (Câu 4/16)
  {
    type: "narration",
    examinerLine: "Look at this. This is a food shop. The man is looking at the fruit.",
    sceneImage: SCENE,
    audioUrl: `${P1_AUDIO}/03-food-shop.mp3`,
  },
  // 4 — Huong-dan (Câu 5/16)
  {
    type: "narration",
    examinerLine: "Here's the lemonade.",
    sceneImage: SCENE,
    highlight: { x: 39.6, y: 38.1, w: 10.3, h: 15.9 }, // khoanh vùng chai chanh trong ảnh, đo bằng image-map.net
    audioUrl: `${P1_AUDIO}/04-lemonade.mp3`,
  },
  // 5 — Canh-click (câu chính) (Câu 6/16)
  {
    type: "scene-click",
    examinerLine: "Where's the monkey?",
    sceneImage: SCENE,
    target: { id: "monkey", label: "monkey", x: 34, y: 78, w: 18, h: 18 },
    audioUrl: `${P1_AUDIO}/05-monkey.mp3`,
  },
  // 5b — Cau-hoi-mic (câu hỏi phụ Yes/No, khoanh vùng gợi ý — không bấm được, phải trả lời bằng mic) (Câu 7/16)
  {
    type: "mic",
    examinerLine: "Is this the monkey?",
    sceneImage: SCENE,
    highlight: { x: 34, y: 78, w: 18, h: 18 },
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/05-followup.mp3`,
  },
  // 6 — Canh-click (câu chính) (Câu 8/16)
  {
    type: "scene-click",
    examinerLine: "Where are the oranges?",
    sceneImage: SCENE,
    target: { id: "oranges", label: "oranges", x: 49, y: 39, w: 16, h: 17 },
    audioUrl: `${P1_AUDIO}/06-oranges.mp3`,
  },
  // 6b — Cau-hoi-mic (câu hỏi phụ Yes/No, khoanh vùng gợi ý — không bấm được, phải trả lời bằng mic) (Câu 9/16)
  {
    type: "mic",
    examinerLine: "Are these the oranges?",
    sceneImage: SCENE,
    highlight: { x: 49, y: 39, w: 16, h: 17 },
    answerTemplate: "Yes, they are. / No, they aren't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/06-followup.mp3`,
  },
  // 7 — The-chon (câu chính) (Câu 10/16)
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
    audioUrl: `${P1_AUDIO}/07-shell.mp3`,
  },
  // 7b — Cau-hoi-mic (câu hỏi phụ Yes/No — chỉ hiện đúng 1 thẻ, trả lời bằng mic) (Câu 11/16)
  {
    type: "mic",
    examinerLine: "Is this the shell?",
    card: { id: "shell", label: "shell", image: CARD.shell },
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/07-followup.mp3`,
  },
  // 8 — Huong-dan (giám khảo làm mẫu đặt thẻ trước khi học sinh tự kéo-thả ở scene 9) (Câu 12/16)
  {
    type: "narration",
    examinerLine: "I'm putting the shell on the door.",
    sceneImage: SCENE,
    demoCard: {
      card: { id: "shell", label: "shell", image: CARD.shell },
      target: { x: 4.0, y: 2.6, w: 16.3, h: 38.7 }, // vùng cửa, đo bằng image-map.net
    },
    audioUrl: `${P1_AUDIO}/08-putting-shell.mp3`,
  },
  // 9 — Dat-vi-tri (không tách câu hỏi phụ — xem ghi chú đầu file) (Câu 13/16)
  {
    type: "drag-drop",
    examinerLine: "Now you put the shell between the watermelons.",
    sceneImage: SCENE,
    card: { id: "shell", label: "shell", image: CARD.shell },
    target: { id: "watermelons", label: "between the watermelons", x: 66, y: 28, w: 13, h: 24 },
    followupLine: "Between the watermelons.",
    audioUrl: `${P1_AUDIO}/09-watermelons.mp3`,
    followupAudioUrl: `${P1_AUDIO}/09-followup.mp3`,
  },
  // 10 — The-chon (câu chính) (Câu 14/16)
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
    audioUrl: `${P1_AUDIO}/10-book-pen.mp3`,
  },
  // 10b — Cau-hoi-mic (câu hỏi phụ Yes/No — chỉ hiện đúng 1 thẻ, trả lời bằng mic) (Câu 15/16)
  {
    type: "mic",
    examinerLine: "Is this the book/pen?",
    card: { id: "book", label: "book/pen", image: CARD.book },
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/10-followup.mp3`,
  },
  // 11 — Dat-vi-tri (không tách câu hỏi phụ — xem ghi chú đầu file) (Câu 16/16)
  {
    type: "drag-drop",
    examinerLine: "Put the book/pen in front of the babies.",
    sceneImage: SCENE,
    card: { id: "book", label: "book/pen", image: CARD.book },
    target: { id: "babies", label: "in front of the babies", x: 38, y: 74, w: 12, h: 12 },
    followupLine: "In front of the babies.",
    audioUrl: `${P1_AUDIO}/11-babies.mp3`,
    followupAudioUrl: `${P1_AUDIO}/11-followup.mp3`,
  },
];

const starters1 = YLE_SERIES[0].levels[0];
starters1.speakingPart1 = STARTERS_1_TEST1_PART1;
