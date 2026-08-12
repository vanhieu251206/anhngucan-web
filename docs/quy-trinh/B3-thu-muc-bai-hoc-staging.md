# B3 — Thư mục `Bài học/` (staging) ở gốc dự án

> Ghi lại quy ước làm việc: nơi người dùng thả dữ liệu bài học thô, và việc Claude cần làm với nó.

## 1. Mục đích

- `Bài học/` (ở gốc dự án, ngang hàng `Input/`, `src/`, `public/`) là nơi **người dùng thả dữ liệu bài học thô** vào — ví dụ ảnh Scene/Object card đã cắt sẵn từ sách màu (xem [B2-part1-tuong-tac-click.md](B2-part1-tuong-tac-click.md)), hoặc các file dữ liệu khác cho bài học mới.
- Việc của Claude: **copy/di chuyển nội dung từ `Bài học/` vào đúng vị trí thật trong project** (vd ảnh → `public/assets/img/speaking/<series>/<level>/test<n>/part<n>/`, dữ liệu câu hỏi → `src/lib/yleData.js` hoặc Google Sheet sau này) rồi mới dùng, không dùng trực tiếp file trong `Bài học/` làm nguồn cho app.

## 2. Quy tắc

- Đã thêm `Bài học/` vào `.gitignore` — không đẩy lên repo, vì có thể chứa ảnh cắt từ sách có bản quyền (giống lý do `Input/` bị ignore, xem CLAUDE.md mục 1, 3).
- Khi người dùng báo "đã bỏ ảnh/dữ liệu vào `Bài học/`", Claude cần:
  1. Liệt kê nội dung vừa thả vào để xác nhận đúng file/đúng bài.
  2. Xác định đích đến đúng theo quy ước đặt tên (series/level/test/part — xem B2 mục cấu trúc thư mục ảnh).
  3. Copy sang đúng vị trí trong `public/` (hoặc nơi tương ứng), **không tự đổi tên/tự crop lại** trừ khi cần thiết và đã báo trước.
  4. Không xoá file gốc trong `Bài học/` trừ khi được yêu cầu (coi đây là kho lưu trữ nguồn của người dùng).

## 3. Lịch sử

- 2026-08-12: Tạo thư mục `Bài học/` ở gốc dự án theo yêu cầu người dùng, thêm vào `.gitignore`, ghi lại quy ước sử dụng.
