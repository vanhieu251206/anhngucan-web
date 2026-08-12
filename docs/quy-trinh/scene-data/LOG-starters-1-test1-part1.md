# Log — starters-1-test1-part1 (đã hoàn thành đợt 1)

> Nhật ký chạy quy trình `scene-data/` cho bài đầu tiên. Không phải file quy trình (không bị khoá sửa) — cập nhật tự do theo tiến độ thật.

## Đã làm

- **B0**: `kich-ban-goc.txt` — trích từ `Starters_1.pdf` (Answer Booklet) Test 1 Part 1.
- **Ảnh gốc**: Claude tự cắt trực tiếp từ `STARTER 1 (sách màu).pdf` (không qua bước gen AI vì Part 1 dùng ảnh sách thật):
  - Trang 46 → `scene.jpg` (Scene picture cửa hàng thực phẩm, đã xoay lại đúng chiều — ảnh gốc trong PDF in xoay 90°).
  - Trang 47 (Object cards) → `card-shell.jpg`, `card-book.jpg`, `card-pen.jpg`.
  - Lưu tại `Bài học/starters-1-test1-part1/Tranh goc/`.
- **B4 (đưa vào code)**: copy ảnh sang `public/assets/img/speaking/starters/1/test1/part1/`, cập nhật `STARTERS_1_TEST1_PART1` trong `src/lib/yleData.js` với đường dẫn ảnh thật + toạ độ % đo trực tiếp trên ảnh:
  - `monkey`: x=39%, y=82%, w=9%, h=11%
  - `oranges`: x=52%, y=35%, w=10%, h=12%
- Đã build + test qua Playwright (viewport 1000px, nav desktop) — cả 4 câu chạy đúng, click đúng vị trí, ảnh thẻ hiện rõ.

## Cập nhật 2

- Thay `scene.jpg` bằng bản chất lượng cao, đúng tỉ lệ 4:3 (1200×896), lấy từ dự án Video Listening: `D:\Project Tiếng Anh\Bài Học\Starters 1 - Test 3 - Part 3+4\Ảnh Video\Task_190552_08122026\1_Resize_the_image_to_a_43_la_s1.jpg` (cùng nội dung scene cửa hàng thực phẩm Test 1, chỉ khác nguồn xuất — bản AI-clean thay vì scan từ sách).
- Đo lại toạ độ target trên ảnh mới: `monkey` x:34% y:78% w:18% h:18%, `oranges` x:49% y:39% w:16% h:17%.
- Tăng vùng bấm (hotspot to hơn, min 48px), thêm hiệu ứng rung khi bấm sai + cho phép bấm lại ngay (không khoá câu), bấm đúng thì phát lời khen tiếng Anh (TTS ngẫu nhiên: Well done!/Great job!...) rồi tự động chuyển câu tiếp theo — bỏ nút "Câu tiếp theo" thủ công.
- Test lại bằng Playwright: bấm sai giữ nguyên câu, bấm đúng tự chuyển câu, ảnh hiển thị rõ nét đúng tỉ lệ.

## Còn thiếu / bỏ qua đợt này

- Chưa làm scene `Chào hỏi` (mở đầu bài) — cần ảnh AI-generate + audio mp3 (xem [../B5-scene-anh-gen-va-audio-mp3.md](../B5-scene-anh-gen-va-audio-mp3.md)), đang chờ người dùng gửi.
- Chưa xử lý phần "đặt thẻ vào vị trí" (Put the shell between the watermelons / Put the book-pen in front of the babies) — bỏ qua theo quyết định trước đó, chỉ làm phần "chỉ/chọn đúng vật".
- Bước 4 (Which is the book/pen?) đáp án gốc chấp nhận CẢ book LẪN pen tuỳ đề thi thật dùng thẻ nào — hiện tạm chọn `book` làm đáp án đúng duy nhất, có thể cần xác nhận lại.
- Chưa chạy B1 (`scene-list.md` chính thức) — đã làm tắt thẳng từ B0 sang code vì bài đầu tiên đơn giản (4 scene, không cần bảng riêng). Từ bài thứ 2 trở đi nên làm đủ `scene-list.md` theo đúng quy trình.
