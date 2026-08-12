# B0 — Trích xuất kịch bản gốc

> Bước ĐẦU TIÊN của quy trình chuẩn bị dữ liệu scene.
> Từ Answer Booklet (đề thi thật), trích nguyên văn bảng kịch bản Speaking đúng Test + Part đã chọn, cộng tranh minh hoạ gốc nếu Part đó có.

> **KHÔNG được tự ý sửa file quy trình này.** Chỉ sửa khi người dùng đã kiểm tra kết quả chạy quy trình, xác nhận đạt, và yêu cầu sửa cụ thể.

## Mục tiêu

Tạo trong thư mục bài học (`Bài học/<series>-<level>-test<n>-part<n>/`):
1. `kich-ban-goc.txt` — copy NGUYÊN VĂN bảng kịch bản Speaking (5 cột: `Part | Examiner does this | Examiner says this | Minimum response expected | Back-up questions`) đúng Test + Part đã chọn, từ mục "Speaking" trong Answer Booklet (xem [../B0-tong-quan.md](../B0-tong-quan.md) mục 5).
2. `Tranh goc/` — nếu Part đó dựa vào tranh cảnh/thẻ vật có sẵn trong sách (như Part 1, xem [../B2-part1-tuong-tac-click.md](../B2-part1-tuong-tac-click.md)): copy ảnh cắt từ sách bản màu vào đây, đặt tên theo mô tả trong bảng (vd `scene.jpg`, `card-shell.jpg`).

## Đầu vào

- `Input/<Series>_<N>.pdf` (Answer Booklet, bản không màu) — mục "Test N Answers" → "Speaking" (xem [../B0-tong-quan.md](../B0-tong-quan.md) mục 5).
- `Input/<SERIES N> (sách màu).pdf` — nếu cần tranh gốc cho scene.

## Bước 0a — Xác định phạm vi

Hỏi/xác nhận với người dùng: **Series** (Starters/Movers/Flyers) + **Level** (1-4) + **Test** số mấy + **Part** nào — đã chốt làm Test 1 trước (xem [../B0-tong-quan.md](../B0-tong-quan.md) mục 5), Part 1 trước (xem hội thoại chốt ngày 2026-08-12).

## Bước 0b — Trích xuất `kich-ban-goc.txt`

- Copy NGUYÊN VĂN từng dòng của bảng kịch bản đúng Part, giữ đúng cấu trúc 5 cột và đánh số dòng con (vd `3.1`, `3.2`...) y hệt bản gốc.
- KHÔNG bỏ dòng nào, KHÔNG tự diễn giải lại câu, KHÔNG tự sửa lỗi chính tả (nếu nghi ngờ sai thì hỏi người dùng).
- Giữ nguyên các câu có nhiều dòng con trong 1 ô (vd cột "Examiner says this" của Part 3.1 có 3 câu hỏi xếp chồng) — copy đủ cả 3, không gộp/không chọn 1 câu đại diện.

## Bước 0c — Trích tranh gốc (nếu Part cần)

- Chỉ làm bước này với Part cần tranh cảnh/thẻ vật (Part 1, xem B2 gốc).
- Copy ảnh đã cắt sẵn từ sách bản màu (nếu người dùng đã thả vào `Bài học/` — xem [../B3-thu-muc-bai-hoc-staging.md](../B3-thu-muc-bai-hoc-staging.md)) vào `Tranh goc/`.
- Nếu chưa có ảnh cắt sẵn: báo người dùng, KHÔNG tự crop/tự vẽ thay.

## Luật / Quy tắc

- Không tự sáng tác thêm câu hỏi/đáp án không có trong bảng kịch bản gốc.
- Không tự đổi cấu trúc Part/dòng con so với bản gốc.
- Nếu Part đang làm cần tranh mà chưa có ảnh cắt sẵn → dừng lại, báo người dùng, không tự thay bằng ảnh AI-generate (ảnh AI chỉ dùng cho scene KHÔNG có tranh gốc, xem [../B5-scene-anh-gen-va-audio-mp3.md](../B5-scene-anh-gen-va-audio-mp3.md)).
