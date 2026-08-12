# B3 — Chuẩn bị file & đặt tên

> Bước 4 của quy trình chuẩn bị dữ liệu scene.
> Sau khi có ảnh (gen từ B2 hoặc cắt sẵn từ B0) + audio mp3 (nếu có), đổi tên và xếp vào đúng thư mục theo STT scene.

> **KHÔNG được tự ý sửa file quy trình này.** Chỉ sửa khi người dùng đã kiểm tra kết quả chạy quy trình, xác nhận đạt, và yêu cầu sửa cụ thể.

## Đầu vào

- `scene-list.md` (B1) — lấy STT scene.
- Ảnh gen AI (người dùng thả vào `Bài học/<bài>/` sau khi gen theo `prompt-anh-ai.txt` ở B2) hoặc ảnh gốc trong `Tranh goc/` (B0).
- Audio mp3 (nếu người dùng cung cấp, xem [../B5-scene-anh-gen-va-audio-mp3.md](../B5-scene-anh-gen-va-audio-mp3.md)).

## Đầu ra

```
Bài học/<bài>/
├── Anh scene/
│   ├── 001.jpg   ← khớp STT scene 1
│   ├── 002.jpg
│   └── ...
└── Audio scene/
    ├── 001.mp3   ← chỉ scene có audio thật cung cấp
    └── ...
```

## Cách làm

1. Đổi tên file ảnh/audio theo **STT scene**, 3 chữ số: `001`, `002`... khớp đúng cột STT trong `scene-list.md`.
2. Nếu công cụ gen ảnh tự tạo thư mục con chứa ảnh (thường gặp) → lấy ảnh ra khỏi thư mục con, đổi tên, xoá thư mục con rỗng — chỉ giữ đúng các file đã đặt tên trong `Anh scene/`.
3. Với scene dùng ảnh gốc cắt từ sách màu (Part 1) — copy (không di chuyển) từ `Tranh goc/` sang `Anh scene/`, đổi tên theo STT tương ứng, giữ nguyên bản gốc trong `Tranh goc/`.
4. Ảnh `card-select` có nhiều lựa chọn trong 1 scene (vd 3 thẻ) → đặt tên `<STT>-a.jpg`, `<STT>-b.jpg`, `<STT>-c.jpg` (a = đáp án đúng theo `target`/`correctId` trong dữ liệu, thứ tự còn lại tuỳ ý).

## Kiểm tra bắt buộc trước khi qua B4

- Đối chiếu từng ảnh với đúng scene trong `scene-list.md` — đúng nội dung, đúng Part, không lấy nhầm ảnh của scene khác.
- Với scene `Canh-click`: xác nhận ảnh Scene lớn có thể nhìn rõ vật cần click (không bị mờ/cắt mất vật đó).
- Không còn sót file trung gian (bản test, thư mục con rỗng...) trong `Anh scene/`/`Audio scene/`.

## Luật / Quy tắc

- Đổi tên theo đúng STT — không tự đánh số lại theo thứ tự khác.
- Không tự nén/resize/chỉnh sửa nội dung ảnh trừ khi cần thiết và đã báo trước.
- Không xoá ảnh gốc trong `Tranh goc/` khi copy sang `Anh scene/`.
