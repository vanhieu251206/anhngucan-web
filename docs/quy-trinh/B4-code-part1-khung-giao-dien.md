# B4 — Đã code khung giao diện Part 1 (Test 1, Starters 1)

> Ghi lại những gì đã triển khai thật trong code, để các bước sau (khi có ảnh thật) biết sửa ở đâu.

## 1. File đã thêm/sửa

- `src/components/Part1Mode.jsx` (mới) — component chạy luồng Part 1: tuần tự từng câu (kiểu Duolingo, xem B2), TTS đọc câu hỏi, học sinh **click chọn** đáp án, chấm đúng/sai, có nút sang câu tiếp theo.
- `src/lib/yleData.js` — thêm `STARTERS_1_TEST1_PART1` (4 câu hỏi THẬT lấy từ `Starters_1.pdf` Test 1 Part 1: *Where's the monkey? / Where are the oranges? / Which is the shell? / Which is the book/pen?*), gán vào `level.speakingPart1` của Starters cấp 1.
- `src/pages/LessonsPage.jsx` — luồng "Speaking" giờ chạy **Part 1 trước** (`Part1Mode`), xong mới sang **Part 3/4** (`SpeakingMode`, mic) nếu cấp độ có `speakingPart1`. Cấp độ khác (chưa có Part 1) bỏ qua bước này, vào thẳng mic như cũ.
- `src/index.css` — thêm style `.part1-scene`, `.part1-hotspot`, `.part1-options`, `.part1-option` (+ `.is-correct` / `.is-wrong`).

## 2. Cách hoạt động hiện tại (khi CHƯA có ảnh thật)

- Mỗi step Part 1 có 2 dạng: `scene-click` (chỉ vào vật trong tranh cảnh) và `card-select` (chọn thẻ vật).
- Vì `sceneImage` / `option.image` đang để trống (`""`), component tự **fallback sang lưới nút lựa chọn có nhãn chữ** (đáp án đúng + các nhãn trong `distractors`), thay cho ảnh thật — dùng để test luồng trước khi có ảnh.
- Khi có ảnh thật (từ `Bài học/`, xem B3): chỉ cần điền `sceneImage` (link ảnh Scene) + `target.x/y/w/h` (toạ độ % vùng đúng trên ảnh) cho step `scene-click`, hoặc `option.image` cho step `card-select` — không cần sửa logic component.

## 3. Đã kiểm tra thực tế

- Chạy `npm run dev`, dùng Playwright điều khiển Chromium headless, đi qua luồng: Trang chủ → Bài học → Starters → Cấp 1 → Speaking → hiện đúng câu hỏi Part 1 đầu tiên (dạng lưới 3 lựa chọn placeholder) → click đáp án đúng → hiện "✅ Đúng rồi, giỏi quá!" → nút "Câu tiếp theo". Không có lỗi console.
- `npm run build` chạy thành công, không lỗi.

## 4. Việc còn lại (chưa làm, chờ ảnh thật + hướng dẫn thêm)

- Toạ độ `target.x/y/w/h` trong `yleData.js` hiện là **số tạm/giả**, chưa khớp ảnh thật nào — phải chỉnh lại khi có ảnh Scene thật.
- Chưa xử lý dạng "đặt thẻ vào đúng vị trí" (vd *Put the shell between the watermelons* trong đề gốc) — đã bỏ qua, xem B2 mục 5 (còn treo, chưa được mô tả cách làm).
- Chưa làm Part 2 (đã chốt "chỉ làm Part 1 trong bài trước").

## 5. Lịch sử

- 2026-08-12: Code xong khung Part 1 (ảnh placeholder), nối vào luồng Speaking, test qua Playwright — hoạt động đúng như B1/B2 mô tả.
