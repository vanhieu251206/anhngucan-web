// Dữ liệu bài học 1 - nhúng trực tiếp thành biến JS để chạy được khi mở file trực tiếp
// (mở bằng file:// trình duyệt chặn fetch() đọc file .json cục bộ)
const LESSON_1 = {
  "title": "Bài học 1 - Đồ vật trong nhà",
  "vocab": [
    { "word": "chair", "meaning": "cái ghế", "image": "assets/img/chair.png" },
    { "word": "table", "meaning": "cái bàn", "image": "assets/img/table.png" },
    { "word": "book", "meaning": "quyển sách", "image": "assets/img/book.png" },
    { "word": "lamp", "meaning": "cái đèn", "image": "assets/img/lamp.png" }
  ],
  "dragdrop": [
    { "item": "chair", "target": "chair", "image": "assets/img/chair.png" },
    { "item": "table", "target": "table", "image": "assets/img/table.png" },
    { "item": "book", "target": "book", "image": "assets/img/book.png" },
    { "item": "lamp", "target": "lamp", "image": "assets/img/lamp.png" }
  ],
  "speaking": [
    { "id": 1, "sentence": "This is a chair." },
    { "id": 2, "sentence": "I see a table." },
    { "id": 3, "sentence": "The book is on the table." },
    { "id": 4, "sentence": "Turn on the lamp, please." }
  ]
};
