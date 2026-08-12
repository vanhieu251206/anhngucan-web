# B2 — Part 1: tương tác click chọn ảnh (yêu cầu từ trung tâm)

> Ghi lại cách làm Part 1 cụ thể, do trung tâm mô tả. Khác hẳn Part 3/4 (vốn dùng ghi âm + nhận diện giọng nói) — Part 1 dùng **click chọn ảnh**, không dùng mic.

## 1. Nguyên liệu ảnh

- Có sẵn **tranh cắt từ sách bản màu** (`STARTER 1 (sách màu).pdf`, xem [B0-tong-quan.md](B0-tong-quan.md) mục 5) — dùng để cắt ra:
  - Ảnh **Scene** (tranh cảnh lớn, ví dụ cảnh cửa hàng thực phẩm trong Test 1 Part 1).
  - Ảnh từng **Object card** riêng lẻ (ví dụ: shell, book/pen...).

## 2. Kiểu vận hành tổng thể: từng câu một, giống Duolingo

- Bài học chạy **tuần tự từng câu hỏi một** (1 câu hiện ra → học sinh trả lời/tương tác → có phản hồi đúng/sai → mới chuyển sang câu tiếp theo), giống format bài học Duolingo — không hiện toàn bộ câu hỏi cùng lúc.
- Áp dụng chung cho cả luồng (Part 1 click ảnh, Part 3/4 nói qua mic): mỗi bước là 1 "màn hình câu hỏi" riêng biệt, có tiến trình (vd "Câu 2/5") như `SpeakingMode.jsx` hiện đang làm cho Part 3/4.

## 3. Cơ chế tương tác

1. App hiện **câu hỏi** (TTS đọc, lấy từ cột "Examiner says this" trong bảng gốc).
2. App hiện **ảnh** tương ứng với bước đó:
   - Nếu câu hỏi thuộc dạng "chỉ vào vật trong tranh cảnh" (vd *Where's the monkey?*, *Where are the oranges?*) → hiện **ảnh Scene**, học sinh **click vào đúng vị trí vật** được hỏi trên ảnh.
   - Nếu câu hỏi thuộc dạng "chọn thẻ vật" (vd *Which is the shell?*, *Which is the book/pen?*) → hiện **các ảnh thẻ vật (object cards)** dạng lựa chọn, học sinh **click chọn đúng thẻ ảnh** tương ứng.
3. App chấm đúng/sai theo: học sinh có click đúng vùng ảnh / đúng thẻ ảnh hay không (không dùng mic/giọng nói cho Part 1).

## 4. Khác biệt so với Part 3/4

| | Part 1 | Part 3/4 |
|---|---|---|
| Đầu vào học sinh | Click chọn ảnh | Nói qua mic (SpeechRecognition) |
| Cách chấm | Đúng/sai theo vùng ảnh hoặc thẻ ảnh được click | So khớp từ khoá trong câu nói |
| Cần ảnh | Có (ảnh Scene + ảnh Object card cắt từ sách màu) | Không bắt buộc |

## 5. Việc CẦN xác nhận thêm / còn thiếu để triển khai thật

- **Cách xác định "vùng đúng" trên ảnh Scene** khi học sinh click (toạ độ vùng bounding box cho từng vật, hay cách khác)? Cần trung tâm cung cấp thêm khi có ảnh thật.
- Với dạng "đặt thẻ vào vị trí" (vd *Put the shell between the watermelons*) — không chỉ chọn đúng thẻ mà còn phải **đặt đúng vị trí** trên ảnh Scene. Cách làm cụ thể (kéo thả hay click 2 bước: chọn thẻ → click vị trí?) — **chưa được mô tả, cần hỏi thêm khi tới bước đó**.
- Cấu trúc dữ liệu Part 1 (ảnh Scene, danh sách object card, vùng đúng, đáp án) khác hẳn schema `speaking` hiện tại trong `yleData.js` (vốn chỉ có `image/question/answer_keywords` cho luồng mic) — cần thiết kế field riêng, sẽ làm khi nội dung Part 1 được chốt đầy đủ.
- Component React hiện tại `SpeakingMode.jsx` chỉ xử lý luồng mic — Part 1 cần **component/luồng riêng** (click-to-select), chưa viết. Chỉ triển khai code khi được yêu cầu, không tự ý code trước.

## 6. Lịch sử

- 2026-08-12: Ghi lại mô tả ban đầu của trung tâm cho Part 1 — dùng tranh cắt từ sách màu, học sinh click chọn vật trong tranh cảnh hoặc chọn thẻ ảnh tương ứng, không dùng mic. Còn nhiều chi tiết kỹ thuật (vùng click, cách đặt thẻ vào vị trí) chưa được mô tả, sẽ hỏi thêm khi tới bước đó.
- 2026-08-12: Bổ sung mục 2 — toàn bài chạy tuần tự từng câu một, có phản hồi rồi mới sang câu tiếp, giống format Duolingo (áp dụng chung cho mọi Part, không riêng Part 1).
