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
// Nguồn scene: Bài học/starters-1-test1-part1/scene-list.md (55 scene: Part 1 = scene 1-16,
// Part 2 = scene 17-28, Part 3 = scene 29-48, Part 4 = scene 49-55).
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
  fish: `${P1_IMG}/card-fish.jpg`,
  eyes: `${P1_IMG}/card-eyes.jpg`,
  guitar: `${P1_IMG}/card-guitar.jpg`,
  bear: `${P1_IMG}/card-bear.jpg`,
};
const SCENE_MUSIC = `${P1_IMG}/scene-nghe-nhac.jpg`;
const SCENE_ANIMALS = `${P1_IMG}/scene-con-vat.jpg`;
const SCENE_DOG = `${P1_IMG}/scene-cho.jpg`;
const SCENE_BEDROOM = `${P1_IMG}/scene-phong-ngu.jpg`;

// Khung khoanh vùng cho các scene mic Part 2 (đo tạm bằng mắt trên scene.jpg, đơn vị %,
// theo đúng cách dùng ở scene "Are these the oranges?" — cần xem lại trên web thật rồi chỉnh
// cho khớp bằng image-map.net trước khi coi là chốt).
// Đo lại 2026-08-15 trên scene.jpg 16:9 mới (1376×768) sau khi đổi từ ảnh 4:3 cũ.
// Đề thi thật giám khảo chỉ hỏi 1 TRONG 2 ("Which is the book?" HOẶC "Which is the pen?"),
// không hỏi gộp cả 2 — chọn ngẫu nhiên 1 trong 2 mỗi lần tải trang (chốt 2026-08-15), áp dụng
// nhất quán cho cả 3 scene liên quan (10 The-chon, 10b câu hỏi phụ mic, 11 kéo-thả).
const BOOK_OR_PEN = Math.random() < 0.5 ? "book" : "pen";
const BOOK_OR_PEN_CARD =
  BOOK_OR_PEN === "book"
    ? { id: "book", label: "book", image: CARD.book }
    : { id: "pen2", label: "pen", image: CARD.pen };

const PINEAPPLE_HL = { x: 43.6, y: 24.74, w: 14.17, h: 13.02 }; // coords="600,190,795,290"
const WOMAN_HL = { x: 14.39, y: 31.9, w: 10.25, h: 67.84 }; // coords="198,245,339,766"
const FLOWERS_HL = { x: 72.75, y: 43.49, w: 13.01, h: 24.35 }; // coords="1001,334,1180,521"

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
    highlight: { x: 81.69, y: 76.43, w: 12.65, h: 18.62 }, // đo lại 2026-08-17 trên scene.jpg 16:9, coords="1124,587,1298,730"
    audioUrl: `${P1_AUDIO}/04-lemonade.mp3`,
  },
  // 5 — Canh-click (câu chính) (Câu 6/16)
  {
    type: "scene-click",
    examinerLine: "Where's the monkey?",
    sceneImage: SCENE,
    target: { id: "monkey", label: "monkey", x: 38.01, y: 83.2, w: 10.97, h: 10.55 },
    audioUrl: `${P1_AUDIO}/05-monkey.mp3`,
  },
  // 5b — Cau-hoi-mic (câu hỏi phụ Yes/No, khoanh vùng gợi ý — không bấm được, phải trả lời bằng mic) (Câu 7/16)
  {
    type: "mic",
    examinerLine: "Is this the monkey?",
    sceneImage: SCENE,
    highlight: { x: 38.01, y: 83.2, w: 10.97, h: 10.55 },
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/05-followup.mp3`,
  },
  // 6 — Canh-click (câu chính) (Câu 8/16)
  {
    type: "scene-click",
    examinerLine: "Where are the oranges?",
    sceneImage: SCENE,
    target: { id: "oranges", label: "oranges", x: 50.29, y: 36.59, w: 8.94, h: 17.45 },
    audioUrl: `${P1_AUDIO}/06-oranges.mp3`,
  },
  // 6b — Cau-hoi-mic (câu hỏi phụ Yes/No, khoanh vùng gợi ý — không bấm được, phải trả lời bằng mic) (Câu 9/16)
  {
    type: "mic",
    examinerLine: "Are these the oranges?",
    sceneImage: SCENE,
    highlight: { x: 50.29, y: 36.59, w: 8.94, h: 17.45 },
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
      target: { x: 15.26, y: 8.46, w: 11.99, h: 25.39 }, // vùng cửa, đo lại 2026-08-15 trên scene.jpg 16:9
    },
    audioUrl: `${P1_AUDIO}/08-putting-shell.mp3`,
  },
  // 9 — Dat-vi-tri (không tách câu hỏi phụ — xem ghi chú đầu file) (Câu 13/16)
  {
    type: "drag-drop",
    examinerLine: "Now you put the shell between the watermelons.",
    sceneImage: SCENE,
    card: { id: "shell", label: "shell", image: CARD.shell },
    target: { id: "watermelons", label: "between the watermelons", x: 62.28, y: 32.68, w: 6.61, h: 19.27 },
    followupLine: "Between the watermelons.",
    audioUrl: `${P1_AUDIO}/09-watermelons.mp3`,
    followupAudioUrl: `${P1_AUDIO}/09-followup.mp3`,
  },
  // 10 — The-chon (câu chính) (Câu 14/16) — câu hỏi + đáp án đúng phụ thuộc BOOK_OR_PEN
  // (chọn ngẫu nhiên 1 trong 2 mỗi lần tải trang, xem ghi chú ở BOOK_OR_PEN phía trên).
  {
    type: "card-select",
    examinerLine: `Which is the ${BOOK_OR_PEN}?`,
    options: [
      { id: "book", label: "book", image: CARD.book },
      { id: "shell", label: "shell", image: CARD.shell },
      { id: "pen2", label: "pen", image: CARD.pen },
      { id: "clock", label: "clock", image: CARD.clock },
    ],
    correctId: BOOK_OR_PEN === "book" ? "book" : "pen2",
    audioUrl: `${P1_AUDIO}/10-book-pen.mp3`,
  },
  // 10b — Cau-hoi-mic (câu hỏi phụ Yes/No — chỉ hiện đúng 1 thẻ, trả lời bằng mic) (Câu 15/16)
  {
    type: "mic",
    examinerLine: `Is this the ${BOOK_OR_PEN}?`,
    card: BOOK_OR_PEN_CARD,
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/10-followup.mp3`,
  },
  // 11 — Dat-vi-tri (không tách câu hỏi phụ — xem ghi chú đầu file) (Câu 16/16)
  {
    type: "drag-drop",
    examinerLine: `Put the ${BOOK_OR_PEN} in front of the babies.`,
    sceneImage: SCENE,
    card: BOOK_OR_PEN_CARD,
    target: { id: "babies", label: "in front of the babies", x: 49.71, y: 55.6, w: 8.5, h: 15.63 },
    followupLine: "In front of the babies.",
    audioUrl: `${P1_AUDIO}/11-babies.mp3`,
    followupAudioUrl: `${P1_AUDIO}/11-followup.mp3`,
  },

  // --- Part 2 (dùng lại đúng scene.jpg của Part 1, không có Object cards) ---
  // Nguồn: Bài học/starters-1-test1-part1/scene-list.md mục "Part 2" (scene 17-28).

  // 17 — Cau-hoi-mic (câu chính) — highlight giống cách làm ở scene "Are these the oranges?" (Câu 9/16)
  {
    type: "mic",
    examinerLine: "What are these?",
    sceneImage: SCENE,
    highlight: PINEAPPLE_HL,
    answerTemplate: "They are ....",
    expectedKeyword: "pineapples",
    audioUrl: `${P1_AUDIO}/17-pineapple-what.mp3`,
  },
  // 18 — Cau-hoi-mic (câu hỏi phụ, scene riêng)
  {
    type: "mic",
    examinerLine: "Are they pineapples?",
    sceneImage: SCENE,
    highlight: PINEAPPLE_HL,
    answerTemplate: "Yes, they are. / No, they aren't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/18-pineapple-confirm.mp3`,
  },
  // 19 — Cau-hoi-mic (câu chính)
  {
    type: "mic",
    examinerLine: "What colour is it?",
    sceneImage: SCENE,
    highlight: PINEAPPLE_HL,
    answerTemplate: "It's ....",
    expectedKeyword: "yellow",
    audioUrl: `${P1_AUDIO}/19-pineapple-colour.mp3`,
  },
  // 20 — Cau-hoi-mic (câu hỏi phụ, scene riêng — dạng lựa chọn 2 phương án, chấm theo từ khoá)
  {
    type: "mic",
    examinerLine: "Is it white or yellow?",
    sceneImage: SCENE,
    highlight: PINEAPPLE_HL,
    answerTemplate: "It's ....",
    expectedKeyword: "yellow",
    audioUrl: `${P1_AUDIO}/20-pineapple-colour-confirm.mp3`,
  },
  // 21 — Cau-hoi-mic (câu chính)
  {
    type: "mic",
    examinerLine: "How many pineapples are there?",
    sceneImage: SCENE,
    highlight: PINEAPPLE_HL,
    answerTemplate: "There are ....",
    expectedKeyword: "three",
    audioUrl: `${P1_AUDIO}/21-pineapple-how-many.mp3`,
  },
  // 22 — Cau-hoi-mic (câu hỏi phụ, scene riêng — dạng lựa chọn 2 phương án, chấm theo từ khoá)
  {
    type: "mic",
    examinerLine: "Are there three or two pineapples?",
    sceneImage: SCENE,
    highlight: PINEAPPLE_HL,
    answerTemplate: "There are ....",
    expectedKeyword: "three",
    audioUrl: `${P1_AUDIO}/22-pineapple-how-many-confirm.mp3`,
  },
  // 23 — Cau-hoi-mic (câu chính)
  {
    type: "mic",
    examinerLine: "What's the woman doing?",
    sceneImage: SCENE,
    highlight: WOMAN_HL,
    answerTemplate: "She's ....",
    expectedKeyword: ["phoning", "talking"], // 2 đáp án đều đúng theo sách
    audioUrl: `${P1_AUDIO}/23-woman-doing.mp3`,
  },
  // 24 — Cau-hoi-mic (câu hỏi phụ, scene riêng)
  {
    type: "mic",
    examinerLine: "Is she phoning?",
    sceneImage: SCENE,
    highlight: WOMAN_HL,
    answerTemplate: "Yes, she is. / No, she isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/24-woman-confirm.mp3`,
  },
  // 25 — Cau-hoi-mic (câu chính, ý 1: màu sắc)
  {
    type: "mic",
    examinerLine: "Tell me about the flowers.",
    sceneImage: SCENE,
    highlight: FLOWERS_HL,
    answerTemplate: "They're ....",
    expectedKeyword: ["pink", "table"], // 2 đáp án đều đúng theo sách (màu sắc hoặc vị trí)
    audioUrl: `${P1_AUDIO}/25-flowers-colour.mp3`,
  },
  // 26 — Cau-hoi-mic (câu hỏi phụ, scene riêng)
  {
    type: "mic",
    examinerLine: "What colour are the flowers?",
    sceneImage: SCENE,
    highlight: FLOWERS_HL,
    answerTemplate: "They're ....",
    expectedKeyword: "pink",
    audioUrl: `${P1_AUDIO}/26-flowers-colour-confirm.mp3`,
  },
  // 27 — Cau-hoi-mic (câu chính, ý 2: vị trí)
  {
    type: "mic",
    examinerLine: "Tell me about the flowers.",
    sceneImage: SCENE,
    highlight: FLOWERS_HL,
    answerTemplate: "They're on the ....",
    expectedKeyword: "table",
    audioUrl: `${P1_AUDIO}/27-flowers-location.mp3`,
  },
  // 28 — Cau-hoi-mic (câu hỏi phụ, scene riêng)
  {
    type: "mic",
    examinerLine: "Where are they?",
    sceneImage: SCENE,
    highlight: FLOWERS_HL,
    answerTemplate: "They're on the ....",
    expectedKeyword: "table",
    audioUrl: `${P1_AUDIO}/28-flowers-location-confirm.mp3`,
  },

  // --- Part 3 (4 Object card mới: fish, eyes, guitar, bear — không dùng lại scene.jpg/card Part 1) ---
  // Nguồn: Bài học/starters-1-test1-part1/scene-list.md mục "Part 3" (scene 29-48).
  // Câu hỏi mở cá nhân (breakfast/eye colour/nơi nghe nhạc/con vật yêu thích) KHÔNG dùng
  // expectedKeyword — đáp án tuỳ từng học sinh, sách chỉ in ví dụ minh hoạ, không chấm đúng/sai.

  // 29 — Cau-hoi-mic (câu chính, định danh)
  {
    type: "mic",
    examinerLine: "What's this?",
    card: { id: "fish", label: "fish", image: CARD.fish },
    answerTemplate: "It's a ....",
    expectedKeyword: "fish",
    audioUrl: `${P1_AUDIO}/29-fish-what.mp3`,
  },
  // 30 — Cau-hoi-mic (câu hỏi phụ, scene riêng)
  {
    type: "mic",
    examinerLine: "Is it a fish?",
    card: { id: "fish", label: "fish", image: CARD.fish },
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/30-fish-confirm.mp3`,
  },
  // 31 — Cau-hoi-mic (câu hỏi cá nhân Yes/No)
  {
    type: "mic",
    examinerLine: "Do you eat fish?",
    card: { id: "fish", label: "fish", image: CARD.fish },
    answerTemplate: "Yes, I do. / No, I don't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/31-fish-eat.mp3`,
  },
  // 32 — Cau-hoi-mic (câu hỏi cá nhân mở, không chấm đúng/sai — chủ đề đã chuyển
  // sang đồ ăn sáng nói chung, không còn nói về con cá nữa nên KHÔNG hiện lại card fish)
  {
    type: "mic",
    examinerLine: "What do you eat for breakfast?",
    answerTemplate: "I eat ....",
    audioUrl: `${P1_AUDIO}/32-breakfast.mp3`,
  },
  // 33 — Cau-hoi-mic (câu hỏi phụ, scene riêng — cá nhân Yes/No, cùng chủ đề đồ ăn sáng)
  {
    type: "mic",
    examinerLine: "Do you eat bread?",
    answerTemplate: "Yes, I do. / No, I don't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/33-breakfast-followup.mp3`,
  },

  // 34 — Cau-hoi-mic (câu chính, định danh)
  {
    type: "mic",
    examinerLine: "What are these?",
    card: { id: "eyes", label: "eyes", image: CARD.eyes },
    answerTemplate: "They're ....",
    expectedKeyword: "eyes",
    audioUrl: `${P1_AUDIO}/34-eyes-what.mp3`,
  },
  // 35 — Cau-hoi-mic (câu hỏi phụ, scene riêng)
  {
    type: "mic",
    examinerLine: "Are they eyes?",
    card: { id: "eyes", label: "eyes", image: CARD.eyes },
    answerTemplate: "Yes, they are. / No, they aren't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/35-eyes-confirm.mp3`,
  },
  // 36 — Cau-hoi-mic (câu hỏi cá nhân mở, không chấm đúng/sai)
  {
    type: "mic",
    examinerLine: "What colour are your eyes?",
    card: { id: "eyes", label: "eyes", image: CARD.eyes },
    answerTemplate: "My eyes are ....",
    audioUrl: `${P1_AUDIO}/36-eyes-colour.mp3`,
  },
  // 37 — Cau-hoi-mic (câu hỏi phụ, scene riêng — cá nhân Yes/No)
  {
    type: "mic",
    examinerLine: "Are your eyes brown?",
    card: { id: "eyes", label: "eyes", image: CARD.eyes },
    answerTemplate: "Yes, they are. / No, they aren't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/37-eyes-colour-followup.mp3`,
  },
  // 38 — Cau-hoi-mic (câu hỏi cá nhân Yes/No, không có back-up)
  {
    type: "mic",
    examinerLine: "Do you wear glasses?",
    card: { id: "eyes", label: "eyes", image: CARD.eyes },
    answerTemplate: "Yes, I do. / No, I don't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/38-glasses.mp3`,
  },

  // 39 — Cau-hoi-mic (câu chính, định danh)
  {
    type: "mic",
    examinerLine: "What's this?",
    card: { id: "guitar", label: "guitar", image: CARD.guitar },
    answerTemplate: "It's a ....",
    expectedKeyword: "guitar",
    audioUrl: `${P1_AUDIO}/39-guitar-what.mp3`,
  },
  // 40 — Cau-hoi-mic (câu hỏi phụ, scene riêng)
  {
    type: "mic",
    examinerLine: "Is it a guitar?",
    card: { id: "guitar", label: "guitar", image: CARD.guitar },
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/40-guitar-confirm.mp3`,
  },
  // 41 — Cau-hoi-mic (câu hỏi cá nhân Yes/No, không có back-up)
  {
    type: "mic",
    examinerLine: "Can you play the guitar?",
    card: { id: "guitar", label: "guitar", image: CARD.guitar },
    answerTemplate: "Yes, I can. / No, I can't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/41-guitar-play.mp3`,
  },
  // 42 — Cau-hoi-mic (câu hỏi cá nhân mở, không chấm đúng/sai — hỏi NƠI nghe nhạc,
  // không còn nói về cây guitar nữa nên KHÔNG hiện lại card guitar)
  {
    type: "mic",
    examinerLine: "Where do you listen to music?",
    sceneImage: SCENE_MUSIC,
    answerTemplate: "I listen to music in my ....",
    audioUrl: `${P1_AUDIO}/42-music-where.mp3`,
  },
  // 43 — Cau-hoi-mic (câu hỏi phụ, scene riêng — cá nhân Yes/No, cùng chủ đề nơi nghe nhạc)
  {
    type: "mic",
    examinerLine: "Do you listen to music in your bedroom?",
    answerTemplate: "Yes, I do. / No, I don't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/43-music-where-followup.mp3`,
  },

  // 44 — Cau-hoi-mic (câu chính, định danh)
  {
    type: "mic",
    examinerLine: "What's this?",
    card: { id: "bear", label: "bear", image: CARD.bear },
    answerTemplate: "It's a ....",
    expectedKeyword: "bear",
    audioUrl: `${P1_AUDIO}/44-bear-what.mp3`,
  },
  // 45 — Cau-hoi-mic (câu hỏi phụ, scene riêng)
  {
    type: "mic",
    examinerLine: "Is it a bear?",
    card: { id: "bear", label: "bear", image: CARD.bear },
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "yes",
    audioUrl: `${P1_AUDIO}/45-bear-confirm.mp3`,
  },
  // 46 — Cau-hoi-mic (câu hỏi cá nhân Yes/No, không có back-up)
  {
    type: "mic",
    examinerLine: "Do you like bears?",
    card: { id: "bear", label: "bear", image: CARD.bear },
    answerTemplate: "Yes, I do. / No, I don't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/46-bear-like.mp3`,
  },
  // 47 — Cau-hoi-mic (câu hỏi cá nhân mở, không chấm đúng/sai — hỏi CON VẬT YÊU THÍCH
  // nói chung, không còn nói riêng về con gấu nữa nên KHÔNG hiện lại card bear)
  {
    type: "mic",
    examinerLine: "What's your favourite animal?",
    sceneImage: SCENE_ANIMALS,
    answerTemplate: "My favourite animal is ....",
    audioUrl: `${P1_AUDIO}/47-favourite-animal.mp3`,
  },
  // 48 — Cau-hoi-mic (câu hỏi phụ, scene riêng — hỏi về CON CHÓ, không phải con gấu, nên
  // cũng không hiện card bear)
  {
    type: "mic",
    examinerLine: "Do you like dogs?",
    sceneImage: SCENE_DOG,
    answerTemplate: "Yes, I do. / No, I don't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/48-dogs.mp3`,
  },

  // --- Part 4 (không có ảnh/thẻ minh hoạ nào — chỉ hỏi cá nhân) ---
  // Nguồn: Bài học/starters-1-test1-part1/scene-list.md mục "Part 4" (scene 49-55).

  // 49 — Cau-hoi-mic (câu hỏi cá nhân mở, không chấm đúng/sai)
  {
    type: "mic",
    examinerLine: "Do you live in a house or a flat?",
    answerTemplate: "I live in a ....",
    audioUrl: `${P1_AUDIO}/49-live-where.mp3`,
  },
  // 50 — Cau-hoi-mic (câu hỏi phụ, scene riêng — cá nhân Yes/No)
  {
    type: "mic",
    examinerLine: "Do you live in a house?",
    answerTemplate: "Yes, I do. / No, I don't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/50-live-where-followup.mp3`,
  },
  // 51 — Cau-hoi-mic (câu hỏi cá nhân mở, không chấm đúng/sai)
  {
    type: "mic",
    examinerLine: "Who lives in your house?",
    answerTemplate: "I live with ....",
    audioUrl: `${P1_AUDIO}/51-live-who.mp3`,
  },
  // 52 — Cau-hoi-mic (câu hỏi phụ, scene riêng — cá nhân Yes/No)
  {
    type: "mic",
    examinerLine: "Does your family live in a house?",
    answerTemplate: "Yes, we do. / No, we don't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/52-live-who-followup.mp3`,
  },
  // 53 — Cau-hoi-mic (câu hỏi cá nhân mở, không chấm đúng/sai)
  {
    type: "mic",
    examinerLine: "Is your bedroom big or small?",
    sceneImage: SCENE_BEDROOM,
    answerTemplate: "My bedroom is ....",
    audioUrl: `${P1_AUDIO}/53-bedroom-size.mp3`,
  },
  // 54 — Cau-hoi-mic (câu hỏi phụ, scene riêng — cá nhân Yes/No)
  {
    type: "mic",
    examinerLine: "Is your bedroom big?",
    answerTemplate: "Yes, it is. / No, it isn't.",
    expectedYesNo: "either",
    audioUrl: `${P1_AUDIO}/54-bedroom-size-followup.mp3`,
  },
  // 55 — Cau-hoi-mic (lời chào tạm biệt, kết thúc cả bài Speaking)
  {
    type: "mic",
    examinerLine: "OK. Thank you, *. Goodbye.",
    answerTemplate: "Goodbye!",
    expectedKeyword: "goodbye",
    audioUrl: `${P1_AUDIO}/55-goodbye.mp3`,
  },
];

const starters1 = YLE_SERIES[0].levels[0];
starters1.speakingPart1 = STARTERS_1_TEST1_PART1;
