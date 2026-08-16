# Mẫu điền dữ liệu Scene (Speaking)

File này để **điền tay trước** (soạn nội dung 1 bài Speaking) rồi mới đưa vào CMS "Tạo bài" hoặc
đưa cho Claude đưa thẳng vào code — không phải chỗ hệ thống đọc trực tiếp, chỉ là khung nháp.

Có **5 loại scene**, chọn đúng 1 loại cho mỗi câu, điền theo đúng khung dưới đây. Field nào không
dùng thì để trống hoặc xoá dòng, đừng đoán mò tên field khác — đúng tên khớp với CMS.

---

## 1. `mic` — Chào hỏi / câu hỏi mic

```
Loại: mic
Câu thoại giám khảo:
Audio câu thoại (URL, để trống nếu chưa có):
Gợi ý trả lời (answerTemplate, có chỗ trống dùng "...."):

--- Ảnh minh hoạ (chọn 1 trong 3, xoá 2 cái còn lại) ---
(a) Không ảnh
(b) Ảnh Scene + khoanh vùng:
    Ảnh Scene (URL):
(c) Thẻ đơn (Object card):
    id thẻ (vd: shell):
    Nhãn hiển thị (vd: shell):
    Ảnh thẻ (URL):

--- Cách chấm (chọn 1 trong 3, xoá 2 cái còn lại) ---
(a) Không chấm (hỏi mở, luôn qua)
(b) Yes/No:
    expectedYesNo (yes / no / either — "either" dùng cho câu hỏi thông tin cá nhân, cả 2 đều đúng):
(c) Từ khoá cụ thể:
    expectedKeyword (vd: fish):
```

---

## 2. `narration` — Huong-dan (lời dẫn, không cần trả lời)

```
Loại: narration
Câu thoại giám khảo:
Audio câu thoại (URL, để trống nếu chưa có):
Ảnh Scene (URL):

--- Tuỳ chọn thêm (chọn 1 trong 3, xoá 2 cái còn lại) ---
(a) Không có
(b) Khoanh vùng chỉ xem (highlight) — chọn toạ độ trong CMS, không cần điền gì ở đây
(c) Giám khảo làm mẫu đặt thẻ (demoCard):
    id thẻ (vd: shell):
    Nhãn hiển thị:
    Ảnh thẻ (URL):
    (vị trí đặt thẻ — chọn toạ độ trong CMS, không cần điền ở đây)
```

---

## 3. `scene-click` — Canh-click (bấm đúng vị trí trong ảnh)

```
Loại: scene-click
Câu thoại giám khảo:
Audio câu thoại (URL, để trống nếu chưa có):
Ảnh Scene (URL):

--- Vùng bấm đúng (target) ---
id (vd: monkey):
Nhãn hiển thị (vd: the monkey):
(toạ độ vùng bấm — chọn bằng cách kéo chuột trong CMS, không cần điền ở đây)
```

---

## 4. `card-select` — The-chon (chọn đúng 1 trong 4 thẻ)

```
Loại: card-select
Câu thoại giám khảo:
Audio câu thoại (URL, để trống nếu chưa có):

--- 4 thẻ lựa chọn (LUÔN đủ 4, không được thiếu) ---
Thẻ 1 — id / Nhãn hiển thị / Ảnh (URL):
Thẻ 2 — id / Nhãn hiển thị / Ảnh (URL):
Thẻ 3 — id / Nhãn hiển thị / Ảnh (URL):
Thẻ 4 — id / Nhãn hiển thị / Ảnh (URL):

Đáp án đúng (đúng id của 1 trong 4 thẻ trên):
```

---

## 5. `drag-drop` — Dat-vi-tri (kéo thẻ vào đúng vị trí trên ảnh)

```
Loại: drag-drop
Câu thoại giám khảo:
Audio câu thoại (URL, để trống nếu chưa có):
Ảnh Scene (URL):

--- Thẻ để kéo ---
id thẻ (vd: shell):
Nhãn hiển thị:
Ảnh thẻ (URL):

--- Vị trí thả đúng (target) ---
id (vd: watermelons):
Nhãn hiển thị (vd: between the watermelons):
(toạ độ vị trí thả — chọn bằng cách kéo chuột trong CMS, không cần điền ở đây)

--- Câu hỏi phụ (đọc thêm tại chỗ sau khi đúng, tuỳ chọn — để trống nếu không có) ---
Câu hỏi phụ + đáp án (vd: Between the watermelons.):
Audio câu hỏi phụ (URL):
```

---

## Ghi chú chung

- **Ảnh/Audio**: điền URL nếu đã có sẵn (vd đã upload qua Cloudinary), hoặc để trống rồi upload
  trực tiếp trong CMS sau (`ImageUploadField`/`AudioUploadField` có nút "Chọn file để upload").
- **Toạ độ vùng bấm/thả/khoanh vùng**: KHÔNG điền tay ở đây — luôn chọn bằng cách kéo chuột trực
  tiếp trên ảnh xem trước (preview) bên phải màn hình soạn bài trong CMS, để đảm bảo đúng % vị trí
  thật trên ảnh.
- Chi tiết quy trình soạn bài đầy đủ (chia scene, chuẩn bị ảnh...) xem `docs/quy-trinh/` (không đẩy
  lên GitHub).
