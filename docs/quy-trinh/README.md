# Thư mục quy trình soạn bài Speaking

Thư mục này chứa các file `.md` ghi lại quy trình soạn nội dung Speaking, phát triển dần theo từng bước khi làm việc thật với người dùng. Mỗi file là 1 bước/chủ đề cụ thể, đặt tên dạng `Bn-ten-buoc.md` (n = 0, 1, 2, ... theo thứ tự phát sinh).

**Nguyên tắc chung:** không tự suy diễn cách làm khi chưa có hướng dẫn — xem [B0-tong-quan.md](B0-tong-quan.md) mục 6.

## Mục lục

| File | Nội dung |
|---|---|
| [B0-tong-quan.md](B0-tong-quan.md) | Tổng quan: cấu trúc dữ liệu, nguyên tắc chọn câu hỏi, nguồn tài liệu `Input/`, quy tắc không tự suy diễn |
| [B1-cau-truc-kich-ban.md](B1-cau-truc-kich-ban.md) | Yêu cầu trung tâm: cấu trúc 1 step kịch bản (Scene → TTS câu hỏi chính → gợi ý trả lời có `....` → TTS câu hỏi phụ → gợi ý trả lời câu phụ) — **chưa chốt xong**, còn vài điểm cần xác nhận |
| [B2-part1-tuong-tac-click.md](B2-part1-tuong-tac-click.md) | Part 1 cụ thể: dùng ảnh cắt từ sách màu, học sinh **click chọn** vật/thẻ (không dùng mic); toàn bài chạy tuần tự từng câu kiểu Duolingo — **chưa chốt xong**, còn thiếu chi tiết kỹ thuật (vùng click, cách đặt thẻ vào vị trí) |
| [B3-thu-muc-bai-hoc-staging.md](B3-thu-muc-bai-hoc-staging.md) | Thư mục `Bài học/` ở gốc dự án: nơi người dùng thả dữ liệu thô, Claude copy sang đúng vị trí trong project (không dùng trực tiếp, không đẩy lên repo) |
| [B4-code-part1-khung-giao-dien.md](B4-code-part1-khung-giao-dien.md) | Đã code khung giao diện Part 1 (Test 1, Starters 1) với ảnh placeholder — `Part1Mode.jsx`, dữ liệu thật trong `yleData.js`, đã test qua Playwright |
| [B5-scene-anh-gen-va-audio-mp3.md](B5-scene-anh-gen-va-audio-mp3.md) | Scene không có tranh gốc trong sách (vd đoạn chào hỏi) dùng ảnh AI-generate (Claude soạn prompt) + audio mp3 thật thay browser TTS — đã soạn prompt cho đoạn chào hỏi, chờ ảnh + mp3 |
| [B6-nhan-dien-giong-noi-whisper-wasm.md](B6-nhan-dien-giong-noi-whisper-wasm.md) | Đổi từ `SpeechRecognition` trình duyệt sang Whisper-tiny chạy WASM trong trình duyệt (client-side, miễn phí) để Part 3/4 chạy được trên mọi nền tảng kể cả iOS — đã test kỹ thuật, chưa test giọng thật |

> Các file tiếp theo sẽ được thêm vào bảng này khi tạo, đặt tên dạng `Bn-ten-buoc.md`.

## Quy trình con: chuẩn bị dữ liệu scene

[`scene-data/`](scene-data/README.md) — quy trình chặt chẽ riêng (tham khảo `D:\Project Tiếng Anh\Video Listening\_QuyTrinh`) để chuẩn bị dữ liệu từng scene (kịch bản gốc → chia scene → prompt ảnh AI → đặt tên file → đưa vào code) cho 1 bài Speaking cụ thể, trước khi code thật.
