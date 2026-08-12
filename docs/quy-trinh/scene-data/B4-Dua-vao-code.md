# B4 — Đưa vào code web

> Bước cuối của quy trình chuẩn bị dữ liệu scene.
> Từ `scene-list.md` (B1) + ảnh/audio đã đặt tên (B3), cập nhật vào dữ liệu thật của web (`src/lib/yleData.js`, hoặc Google Sheet khi đã nối — xem [../B0-tong-quan.md](../B0-tong-quan.md) mục 4).

> **KHÔNG được tự ý sửa file quy trình này.** Chỉ sửa khi người dùng đã kiểm tra kết quả chạy quy trình, xác nhận đạt, và yêu cầu sửa cụ thể.

## Đầu vào

- `scene-list.md` (B1).
- `Anh scene/`, `Audio scene/` (B3) — copy sang `public/assets/img/speaking/<series>/<level>/test<n>/part<n>/` và `public/assets/audio/speaking/<series>/<level>/test<n>/part<n>/` (theo quy ước ở [../B3-thu-muc-bai-hoc-staging.md](../B3-thu-muc-bai-hoc-staging.md)).

## Cách làm

1. Copy toàn bộ file trong `Anh scene/`/`Audio scene/` sang đúng thư mục `public/assets/...` (đặt tên rõ nghĩa hơn số thứ tự khi copy vào code, vd `scene.jpg`, `card-shell.jpg`, `greeting.mp3` — không bắt buộc giữ tên `001.jpg` trong code, chỉ cần giữ tên khi còn ở `Bài học/`).
2. Với mỗi dòng trong `scene-list.md`, tạo 1 object dữ liệu tương ứng đúng cấu trúc component đang dùng:
   - `Chao-hoi` → step riêng có audio thật (thẻ `<audio>`), không dùng `speak()` (xem B5 gốc — còn treo: cần quyết định component render trước khi code thật).
   - `Canh-click` → step `Part1Mode` loại `scene-click` (`sceneImage`, `target.x/y/w/h`).
   - `The-chon` → step `Part1Mode` loại `card-select` (`options[].image`, `correctId`).
   - `Cau-hoi-mic` → step `SpeakingMode` (`question`, `answer_keywords`) — lưu ý cấu trúc hiện tại của `SpeakingMode.jsx` CHƯA có field cho câu hỏi phụ/gợi ý trả lời dạng `....` (xem [../B1-cau-truc-kich-ban.md](../B1-cau-truc-kich-ban.md) mục 4, còn treo) — nếu scene cần các field này mà component chưa hỗ trợ, dừng lại báo người dùng, không tự thêm field/tự đoán cách hiển thị.
3. Build (`npm run build`) và chạy thử thật trên trình duyệt/Playwright (xem [../B4-code-part1-khung-giao-dien.md](../B4-code-part1-khung-giao-dien.md) mục 3 làm ví dụ) trước khi báo hoàn thành.

## Luật / Quy tắc

- Không tự thêm field/schema mới vào component khi chưa xác nhận với người dùng — nếu dữ liệu scene cần thứ component hiện chưa hỗ trợ, dừng lại hỏi thay vì tự đoán.
- Không tự đổi toạ độ `target.x/y/w/h` khác với ảnh thật cung cấp — phải đo/ước lượng đúng theo ảnh thật, không để nguyên số placeholder cũ.
- Sau khi xong, đưa người dùng xem lại trên web thật trước khi coi bài đó là hoàn chỉnh.
