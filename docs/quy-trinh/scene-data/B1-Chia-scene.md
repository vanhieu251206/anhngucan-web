# B1 — Chia scene

> Bước 2 của quy trình chuẩn bị dữ liệu scene.
> Từ `kich-ban-goc.txt` (B0), chia thành danh sách scene — **áp bảng loại scene cố định dưới đây, KHÔNG tự phán đoán/sáng tạo cách nhóm ngoài bảng này.**

> **KHÔNG được tự ý sửa file quy trình này.** Chỉ sửa khi người dùng đã kiểm tra kết quả chạy quy trình, xác nhận đạt, và yêu cầu sửa cụ thể.

## Mục tiêu

Tạo file `scene-list.md` trong thư mục bài học, liệt kê đầy đủ từng scene (= 1 "câu hỏi" hiển thị tuần tự trên web, kiểu Duolingo — xem [../B2-part1-tuong-tac-click.md](../B2-part1-tuong-tac-click.md) mục 2) theo đúng thứ tự xuất hiện trong kịch bản gốc.

## Các loại scene

| Loại scene | Khi nào dùng | Nguồn |
|---|---|---|
| `Chao-hoi` | Duy nhất 1 scene mở đầu bài Speaking (Candidate enters / Hello / What's your name?) — chỉ xuất hiện ở Part đầu tiên của cả bài Speaking, không lặp lại ở mỗi Part. | Dòng "Candidate enters" đầu bảng kịch bản gốc. |
| `Canh-click` | Học sinh click vào đúng vật trong ảnh Scene lớn. Dùng cho các dòng "Point to X in Scene picture" có kèm câu hỏi dạng "Where's/Where are...?". | Part 1 (xem B2 gốc). |
| `The-chon` | Học sinh click chọn đúng thẻ ảnh trong nhiều lựa chọn. Dùng cho câu hỏi dạng "Which is...?". | Part 1. |
| `Cau-hoi-mic` | Học sinh trả lời bằng giọng nói (mic), app so khớp từ khoá. Gồm: TTS câu hỏi chính + gợi ý trả lời (cột 4) + TTS câu hỏi phụ (cột 5) + gợi ý trả lời phụ — đúng luồng đã chốt ở [../B1-cau-truc-kich-ban.md](../B1-cau-truc-kich-ban.md). | Part 3, Part 4. |

Mỗi **dòng con** trong bảng kịch bản gốc (vd mỗi câu hỏi riêng trong 1 ô "Examiner says this" có nhiều dòng) = 1 scene riêng, trừ khi B4-gốc (mục còn treo) đã xác nhận gộp — mặc định KHÔNG gộp, hỏi lại nếu chưa rõ.

## Cột trong `scene-list.md`

| STT | Loại scene | Part | Câu hỏi chính (TTS) | Gợi ý trả lời | Câu hỏi phụ (TTS) | Gợi ý trả lời phụ | Ảnh cần |
|---|---|---|---|---|---|---|---|

- **STT**: đánh số liên tục từ 1.
- **Loại scene**: theo bảng trên.
- **Part**: số Part đang thuộc về.
- **Câu hỏi chính / Gợi ý trả lời / Câu hỏi phụ / Gợi ý trả lời phụ**: copy nguyên văn từ `kich-ban-goc.txt`, đúng ánh xạ cột đã chốt ở [../B1-cau-truc-kich-ban.md](../B1-cau-truc-kich-ban.md) mục 1 — để trống nếu loại scene đó không có (vd `Canh-click`/`The-chon` không có "Gợi ý trả lời"/"Câu hỏi phụ").
- **Ảnh cần**: mô tả ngắn ảnh scene đó cần (vd "ảnh Scene cửa hàng thực phẩm, click vào khỉ" hoặc "3 thẻ: shell/book/pen") — dùng ở B2/B3.

## Luật / Quy tắc

- Giữ ĐÚNG thứ tự xuất hiện trong `kich-ban-goc.txt` — không đảo scene.
- Không tự bịa thêm scene ngoài những gì bảng kịch bản gốc có, trừ scene `Chao-hoi` (cố định, luôn là scene đầu tiên của cả bài).
- Không tự gộp nhiều dòng con thành 1 scene khi chưa được xác nhận.
- Sau khi tạo xong, đưa người dùng xem lại `scene-list.md` trước khi qua B2.
