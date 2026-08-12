# CLAUDE.md — App Học Tiếng Anh (dự án riêng)

> Đây là dự án **ứng dụng web/app học tiếng Anh**, đặt tại `D:\App Hoc Tieng Anh`, TÁCH BIỆT hoàn toàn khỏi dự án làm video/truyện tranh ở `D:\Project Tiếng Anh\` (không dùng chung cấu trúc, không dùng chung CLAUDE.md của dự án đó). Đọc file này trước khi làm việc trong thư mục này.

## 1. Mục tiêu dự án
Xây dựng một ứng dụng học tiếng Anh dạng **speaking** cho học sinh nhỏ tuổi, chứa các bài tập lấy nội dung từ sách giáo trình, gồm 3 dạng bài:
1. **Kéo thả đồ vật đơn giản** — kéo hình vào đúng ô tên gọi.
2. **Thẻ từ vựng (flashcard)** — bấm thẻ để xem nghĩa + nghe phát âm.
3. **Luyện nói** — học sinh đọc câu tiếng Anh theo kịch bản có sẵn của bài học, app chấm đúng/sai bằng nhận diện giọng nói (so khớp text, KHÔNG chấm ngữ điệu/độ chuẩn phát âm sâu).

## 2. Ràng buộc kỹ thuật đã chốt với người dùng
- **Không tốn phí duy trì.** Không dùng backend/server trả phí, không dùng API AI trả phí theo lượng dùng.
- **CHỐT CUỐI CÙNG (2026-08-12): KHÔNG đóng gói thành app/exe/ios gì cả.** Đây chỉ là một **website học tiếng Anh thuần túy**, chạy tốt trên mọi thiết bị (desktop, mobile, tablet) qua trình duyệt. Không Electron, không Capacitor/Cordova, không nộp App Store/Google Play, không PWA cài đặt — chỉ cần mở bằng trình duyệt là dùng được. KHÔNG tự ý đề xuất hay triển khai đóng gói trừ khi người dùng chủ động yêu cầu lại.
- **Responsive bắt buộc:** UI/CSS phải hoạt động tốt trên nhiều kích thước màn hình (điện thoại, tablet, desktop) vì mục tiêu là "dùng tốt trên mọi thiết bị" qua trình duyệt.
- **CHỐT (2026-08-12): Chuyển sang React (Vite) cho frontend.** Lý do: quy mô nhiều bài học/dạng bài, framework giúp dễ bảo trì/mở rộng hơn thuần JS. Build ra file tĩnh (HTML/CSS/JS) rồi deploy như cũ lên GitHub Pages — KHÔNG cần server chạy liên tục.
- **KHÔNG dùng backend nào chạy server thật (đã cân nhắc và loại bỏ Django REST Framework)** — lý do: mọi lựa chọn host backend miễn phí đều có giới hạn nặng (server tự ngủ, giới hạn CPU/băng thông) hoặc phải trả phí VPS để chạy ổn định 24/7, vi phạm ràng buộc "không tốn phí duy trì". Google Sheets (đọc qua API công khai, xem mục dưới) đóng vai trò "database" thay thế, không cần server.
- **Lưu ý về iOS/Safari:** `SpeechRecognition` (Web Speech API dùng cho luyện nói) hỗ trợ kém/không ổn định trên Safari iOS — cần kiểm tra thực tế, có thể phải có phương án dự phòng (vd ẩn/thông báo tính năng luyện nói không khả dụng) cho trình duyệt không hỗ trợ.
- **Chấm phát âm đã chọn:** so khớp đơn giản bằng Web Speech API (`SpeechRecognition`, cần Chrome + micro). Có thể cần mạng vì engine nhận diện của Chrome chạy qua Google — chấp nhận được, KHÔNG dùng dịch vụ AI phát âm chuyên dụng trả phí.
- **CHỐT (2026-08-12): Deploy online, KHÔNG chạy local nữa.** Website host trên **GitHub Pages** (miễn phí). Học sinh truy cập qua URL, không cần tải/cài gì.
- **CHỐT (2026-08-12): Dữ liệu bài học lấy từ Google Sheets**, KHÔNG nhúng cứng vào file JS nữa. Lý do: sẽ có rất nhiều bài học, và cần người không biết code (admin/giáo viên) thêm bài mới chỉ bằng cách nhập liệu vào Sheet — không phải sửa code, không phải deploy lại. Xem chi tiết cơ chế ở mục 4 và 7.

## 3. Cấu trúc thư mục
```
App Hoc Tieng Anh/
├── CLAUDE.md              # file này
├── index.html             # trang chính: màn hình loading → chọn bài học → chọn chế độ (vocab/dragdrop/speaking)
├── style.css               # giao diện, theme màu cam-xanh trẻ em
├── config.js                # chứa SHEET_ID của Google Sheet nguồn dữ liệu
├── app.js                   # toàn bộ logic UI 3 chế độ + Web Speech API
├── js/
│   └── sheet-loader.js     # đọc dữ liệu từ Google Sheets qua API gviz (fetch, không cần backend)
├── data/
│   └── lesson1.sample.js   # mẫu cấu trúc dữ liệu cũ (KHÔNG còn dùng, chỉ để tham khảo format khi tạo Sheet)
└── assets/
    ├── img/                 # ảnh minh họa từ vựng (chair.png, table.png, ...) — CHƯA có ảnh thật
    └── audio/               # (dự phòng, hiện dùng speechSynthesis phát âm thay vì file audio)
```

## 4. Cách thêm bài học mới (KHÔNG cần code)
Dữ liệu bài học nằm trong 1 Google Sheet dùng chung, gồm 4 tab (tên tab phải đúng chính xác):

| Tab | Cột bắt buộc |
|---|---|
| `Lessons` | `lesson_id`, `title`, `order` |
| `Vocab` | `lesson_id`, `word`, `meaning`, `image` |
| `DragDrop` | `lesson_id`, `item`, `target`, `image` |
| `Speaking` | `lesson_id`, `order`, `image`, `question`, `answer_keywords` |

**Chi tiết tab `Speaking` (dựa theo định dạng thi thật Cambridge YLE Starters, xem `Input/Starters_1.pdf`):**
- Mỗi dòng là 1 câu hỏi trong luồng hội thoại tuần tự (giống thi nói thật): app tự đọc `question` bằng giọng nói (TTS) như giám khảo hỏi, kèm ảnh `image` (Scene picture hoặc Object card) nếu có, học sinh **bấm giữ mic để trả lời**, thả ra để chấm.
- `answer_keywords`: các từ được chấp nhận là đúng, cách nhau bằng dấu phẩy (vd `phoning, talking`). Chấm đúng nếu câu nói **chứa** 1 trong các từ khóa (không cần khớp cả câu).
- **Để trống `answer_keywords`** nếu là câu hỏi mở/tự do (không có đáp án đúng cố định) — app sẽ không chấm đúng/sai, chỉ ghi nhận đã trả lời.
- App tự thêm 1 câu chào mở đầu cố định ("Hello! What's your name?", không cần đưa vào Sheet) trước khi vào các câu hỏi của bài, để mô phỏng đúng phần mở đầu bài thi thật.
- **Chỉ nên đưa vào Sheet các câu có đáp án tương đối cố định** (kiểu "What's this?", "What colour...?", "How many...?", "What's ... doing?") — lấy từ Part 2 và câu đầu Part 3 của đề thi mẫu. Không đưa các câu hỏi sở thích cá nhân hoàn toàn tự do (What's your favourite...? Who do you play with?...) vì không có cách chấm đúng/sai hợp lý.

- Thêm bài học mới = thêm 1 dòng vào tab `Lessons` (đặt `lesson_id` mới, vd `2`) + thêm các dòng tương ứng vào `Vocab`/`DragDrop`/`Speaking` có cùng `lesson_id` đó.
- Cột `image` ghi đường dẫn ảnh, vd `assets/img/chair.png` — ảnh cần được đưa vào thư mục `assets/img/` của repo (upload lên GitHub) thì mới hiển thị được.
- **Không cần sửa code, không cần deploy lại** — trang tự đọc Sheet mới nhất mỗi lần tải.
- Sheet phải để chế độ chia sẻ **"Anyone with the link" (Người có link đều xem được)** thì web mới đọc được qua API công khai (gviz), không cần thêm nhóm hay API key trả phí nào.
- `config.js` phải được set đúng `SHEET_ID` (lấy từ URL của Sheet) — mới nạp dữ liệu chính xác.

## 5. Trạng thái hiện tại (2026-08-12)
- Đã dựng xong khung 3 chế độ chơi (vocab/dragdrop/speaking) + màn hình chọn bài học nhiều bài.
- **`config.js` còn để `SHEET_ID` placeholder** — cần người dùng tạo Google Sheet thật theo cấu trúc ở mục 4, dán ID vào, rồi mới chạy được.
- Chưa deploy lên GitHub Pages — cần tạo repo GitHub, push code, bật GitHub Pages trong Settings > Pages.
- **Còn thiếu ảnh minh họa thật** trong `assets/img/` — hiện các thẻ/ô kéo thả sẽ ẩn ảnh nếu file không tồn tại (`onerror` ẩn ảnh, không vỡ giao diện).
- **Sẽ KHÔNG đóng gói thành .exe hay app gì cả** — xem mục 2, đã chốt lần cuối là chỉ làm website.
- Chưa kiểm tra/tối ưu responsive cho mobile/tablet — cần làm để đạt mục tiêu "dùng tốt trên mọi thiết bị".

## 6. Không tự ý làm gì khi chưa hỏi
- Khi đổi cấu trúc cột trong Sheet hoặc đổi nguồn dữ liệu nên xác nhận với người dùng trước.
- **Không đề xuất lại việc đóng gói thành app/exe/ios** (Electron, Capacitor, PWA cài đặt, v.v.) — đã bị loại bỏ hoàn toàn theo quyết định cuối cùng của người dùng ở mục 2.
- **Không đề xuất backend chạy server thật** (Django REST Framework, Node/Express, Firebase Functions trả phí, v.v.) — đã cân nhắc và loại bỏ vì không có cách host miễn phí ổn định 24/7. Google Sheets + GitHub Pages là giải pháp đã chốt.
- **Không tự ý đổi framework khác** (đã chốt React + Vite) trừ khi người dùng chủ động yêu cầu.

## 7. Hướng dẫn thiết lập (làm 1 lần)
**A. Tạo Google Sheet:**
1. Tạo 1 Google Sheet mới, tạo đúng 4 tab tên: `Lessons`, `Vocab`, `DragDrop`, `Speaking` với các cột như mục 4.
2. Nhập thử 1 bài học (copy nội dung từ `data/lesson1.sample.js` sang đúng cột).
3. Chia sẻ Sheet ở chế độ "Anyone with the link" → Viewer.
4. Copy Sheet ID từ URL, dán vào `config.js` (`SHEET_ID`).

**B. Deploy GitHub Pages:**
1. Tạo repo GitHub mới (public), push toàn bộ thư mục dự án lên.
2. Vào Settings → Pages → chọn branch `main`, thư mục `/ (root)` → Save.
3. Sau vài phút, GitHub cấp URL dạng `https://<username>.github.io/<ten-repo>/` — đây là link học sinh dùng để truy cập.
4. Mỗi khi thêm ảnh minh họa mới vào `assets/img/`, cần commit + push lại (vì ảnh là file tĩnh, không đọc qua Sheet được).
