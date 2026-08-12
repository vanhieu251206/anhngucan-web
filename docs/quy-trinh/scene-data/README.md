# Quy trình chuẩn bị dữ liệu scene cho bài Speaking

> Tham khảo cấu trúc từ `D:\Project Tiếng Anh\Video Listening\_QuyTrinh` (quy trình chặt chẽ: mỗi bước có đầu vào/đầu ra rõ, khuôn cố định, khoá không tự sửa), làm lại riêng cho việc chuẩn bị dữ liệu từng scene bài **Speaking** trên web (khác Video Listening: đầu ra là dữ liệu hiển thị/tương tác trên web, không phải video).

> **KHÔNG được tự ý sửa các file quy trình `B0`-`B4` trong thư mục này.** Chỉ sửa khi người dùng đã kiểm tra kết quả chạy quy trình, xác nhận đạt, và yêu cầu sửa cụ thể.

Đây là quy trình **con**, chuyên để chuẩn bị dữ liệu 1 bài (1 Test, 1 Part) trước khi đưa vào code web. Các quyết định/quy ước chung của cả dự án Speaking vẫn nằm ở [../README.md](../README.md) (B0-B5 gốc) — quy trình này CHỈ chi tiết hoá cách làm ra dữ liệu scene, dựa trên các quyết định đã chốt ở đó (đặc biệt [B1-cau-truc-kich-ban.md](../B1-cau-truc-kich-ban.md), [B2-part1-tuong-tac-click.md](../B2-part1-tuong-tac-click.md)).

## Mục lục

| File | Nội dung |
|---|---|
| [B0-Trich-xuat-kich-ban-goc.md](B0-Trich-xuat-kich-ban-goc.md) | Trích nguyên văn bảng kịch bản Speaking (Answer Booklet) + tranh minh hoạ (nếu có) vào thư mục bài học |
| [B1-Chia-scene.md](B1-Chia-scene.md) | Chia kịch bản gốc thành danh sách scene theo loại cố định, xuất `scene-list.md` |
| [B2-Tao-prompt-anh-ai.md](B2-Tao-prompt-anh-ai.md) | Với scene không có tranh sách gốc → viết prompt gen ảnh AI theo khuôn cố định |
| [B3-Chuan-bi-file-va-dat-ten.md](B3-Chuan-bi-file-va-dat-ten.md) | Đổi tên ảnh/audio đã có theo STT scene, xếp vào đúng thư mục |
| [B4-Dua-vao-code.md](B4-Dua-vao-code.md) | Đưa `scene-list.md` + file đã đặt tên vào `yleData.js`/component web |

## Thư mục làm việc cho mỗi bài

Mỗi bài (1 series + 1 level + 1 test + 1 part) có 1 thư mục con trong `Bài học/` (xem [../B3-thu-muc-bai-hoc-staging.md](../B3-thu-muc-bai-hoc-staging.md)):

```
Bài học/
└── <series>-<level>-test<n>-part<n>/     ví dụ: starters-1-test1-part1/
    ├── kich-ban-goc.txt        (B0)
    ├── scene-list.md            (B1)
    ├── prompt-anh-ai.txt        (B2)
    ├── Anh scene/               (B2/B3 — ảnh gen hoặc ảnh cắt từ sách màu)
    └── Audio scene/             (B3 — mp3 nếu có, theo B5 quy trình gốc)
```
