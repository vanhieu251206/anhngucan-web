# B2 — Tạo prompt ảnh AI (cho scene không có tranh sách gốc)

> Bước 3 của quy trình chuẩn bị dữ liệu scene.
> Từ `scene-list.md` (B1), viết prompt ảnh AI cho các scene **không có tranh sẵn trong sách** — dùng khuôn cố định, chỉ thay phần nội dung, không tự sáng tạo bố cục/màu sắc khác đi giữa các bài (xem [../B5-scene-anh-gen-va-audio-mp3.md](../B5-scene-anh-gen-va-audio-mp3.md)).

> **KHÔNG được tự ý sửa file quy trình này.** Chỉ sửa khi người dùng đã kiểm tra kết quả chạy quy trình, xác nhận đạt, và yêu cầu sửa cụ thể.

## Khi nào cần gen ảnh AI (B2), khi nào KHÔNG

- Scene loại `Canh-click` / `The-chon` (Part 1): **dùng ảnh cắt từ sách bản màu** đã có ở `Tranh goc/` (B0) — KHÔNG gen ảnh AI cho các scene này. Bỏ qua B2 đối với các scene này, ghi chú trong `prompt-anh-ai.txt` là "dùng ảnh gốc, không cần gen" kèm tên file trong `Tranh goc/`.
- Scene loại `Chao-hoi`: KHÔNG có tranh gốc trong sách → **cần gen ảnh AI**, dùng khuôn dưới đây.
- Scene loại `Cau-hoi-mic` (Part 3/4): mặc định không có ảnh — chỉ hiện chữ + phát audio. Nếu người dùng yêu cầu thêm ảnh minh hoạ cho loại này, hỏi lại cách làm (chưa có khuôn cố định cho trường hợp này).

## Bảng màu & phong cách cố định (dùng xuyên suốt mọi ảnh gen cho web Speaking)

Khớp theme web hiện tại (`src/index.css`), không tự đổi giữa các bài:

| Thành phần | Giá trị |
|---|---|
| Cam chính | `#FF7A45` |
| Cam đậm | `#E85D2E` |
| Xanh ngọc | `#2FB6C4` |
| Vàng | `#FFC94A` |
| Nền kem | `#FFFBF2` |
| Phong cách | Flat cartoon / vector illustration, bo tròn, thân thiện trẻ em, không có chữ trong ảnh |
| Tỉ lệ | 4:3 (ảnh Scene lớn) hoặc 1:1 (ảnh thẻ vật đơn lẻ) — xem quyết định tỉ lệ đã chốt |

## Khuôn prompt — scene `Chao-hoi`

```
Warm, friendly children's book illustration, flat cartoon style with soft rounded shapes.
A cheerful young Cambridge English examiner (smiling woman, casual friendly outfit) sitting
at a small table, warmly greeting a young child (7-8 years old) who has just walked into the
room. The examiner is waving hello with a welcoming smile. Bright, cozy classroom background
with soft natural light. Color palette: warm coral orange (#FF7A45), teal (#2FB6C4), cream
background (#FFFBF2), soft yellow accents. Simple, clean vector illustration style suitable
for a kids' language-learning app, no text in image, 4:3 landscape aspect ratio.
```

- Đây là khuôn đã dùng cho scene chào hỏi Starters 1 Test 1 (xem [../B5-scene-anh-gen-va-audio-mp3.md](../B5-scene-anh-gen-va-audio-mp3.md) mục 4) — dùng lại y hệt cho scene `Chao-hoi` của MỌI bài khác (chỉ đổi khi người dùng yêu cầu đổi phong cách nhân vật/bối cảnh).

## Đầu ra

- File `prompt-anh-ai.txt` trong thư mục bài học — mỗi dòng là 1 prompt hoàn chỉnh của 1 scene cần gen, theo đúng thứ tự STT trong `scene-list.md`. Với scene dùng ảnh gốc (không gen), ghi dòng dạng `STT <n>: dùng ảnh gốc "<tên file trong Tranh goc/>", không cần gen`.

## Luật / Quy tắc

- CHỈ gen ảnh AI cho scene KHÔNG có tranh gốc trong sách — không tự ý gen ảnh AI thay thế tranh gốc có sẵn (vi phạm quyết định đã chốt: Part 1 dùng ảnh cắt từ sách màu).
- Không tự đổi bảng màu/phong cách giữa các bài khác nhau.
- Không nhắc tới logo trong prompt.
- Đưa người dùng xem prompt trước khi họ tự gen ảnh.
