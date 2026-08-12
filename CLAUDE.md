# CLAUDE.md — App Học Tiếng Anh (dự án riêng)

> Đây là dự án **ứng dụng web/app học tiếng Anh**, đặt tại `D:\App Hoc Tieng Anh`, TÁCH BIỆT hoàn toàn khỏi dự án làm video/truyện tranh ở `D:\Project Tiếng Anh\` (không dùng chung cấu trúc, không dùng chung CLAUDE.md của dự án đó). Đọc file này trước khi làm việc trong thư mục này.

## 1. Mục tiêu dự án
Xây dựng một ứng dụng học tiếng Anh cho học sinh nhỏ tuổi, nội dung bám sát 3 bộ đề luyện thi **Cambridge YLE**: **Starters, Movers, Flyers**. Mỗi bộ có **4 cấp độ**, mỗi cấp độ gồm **2 dạng bài**:
1. **Listening** — nhúng video nghe có sẵn (không tự lưu trữ file video/audio, xem mục 2 về lý do).
2. **Speaking** — học sinh đọc câu tiếng Anh theo kịch bản của cấp độ đó, app chấm đúng/sai bằng nhận diện giọng nói (so khớp text, KHÔNG chấm ngữ điệu/độ chuẩn phát âm sâu).

**CHỐT (2026-08-12): Đã bỏ 2 dạng bài cũ "Kéo thả đồ vật" và "Thẻ từ vựng (flashcard)" theo chủ đề** (đồ vật/con vật/màu sắc) — component `VocabMode.jsx`, `DragDropMode.jsx` đã bị xoá. Cấu trúc nội dung giờ xoay quanh Starters/Movers/Flyers × 4 cấp × Listening/Speaking, không phải bài học theo chủ đề tự do nữa.

**Về bản quyền:** Sách giáo trình gốc (PDF trong `Input/`) và audio đi kèm có bản quyền — KHÔNG host trực tiếp file audio/video gốc của nhà xuất bản lên web public. Với Listening: dùng video nhúng qua YouTube ở chế độ **Không công khai (Unlisted)** thay vì Google Drive (Drive dễ bị chặn vượt quota băng thông khi nhiều người xem cùng lúc) và thay vì tự host file. Với nội dung câu hỏi Speaking: chỉ lấy phần **text** (câu hỏi mẫu dạng "What's this?", "What colour...?"...) để soạn kịch bản luyện nói, không phát lại audio gốc của sách.

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

## 3. Cấu trúc thư mục (React + Vite)
```
App Hoc Tieng Anh/
├── CLAUDE.md                   # file này
├── package.json                 # scripts: npm run dev / npm run build / npm run preview
├── vite.config.js                # base: './' để build chạy đúng dù deploy ở subpath nào của GitHub Pages
├── index.html                    # HTML gốc, chỉ chứa <div id="root"> + nạp src/main.jsx
├── src/
│   ├── main.jsx                  # điểm khởi chạy React
│   ├── App.jsx                   # router đơn giản theo state: home / lessons / about / contact
│   ├── index.css                 # giao diện, theme màu cam-xanh trẻ em, font Baloo 2 + Nunito
│   ├── config.js                  # chứa SHEET_ID của Google Sheet nguồn dữ liệu (chưa dùng lại — xem mục 4)
│   ├── lib/
│   │   ├── sheetLoader.js        # đọc dữ liệu từ Google Sheets qua API gviz — ĐANG THEO SCHEMA CŨ, cần viết lại theo mục 4 trước khi dùng
│   │   ├── yleData.js             # dữ liệu MẪU (mock) 3 bộ Starters/Movers/Flyers × 4 cấp, dùng tạm cho tới khi có Sheet thật
│   │   ├── mockData.js            # dữ liệu mẫu cho trang chủ (feature, testimonial)
│   │   └── speech.js              # helper dùng chung: speak() (TTS), normalize() (so khớp từ khóa)
│   ├── components/
│   │   ├── Header.jsx             # logo + top nav (Trang chủ/Bài học/Giới thiệu/Liên hệ)
│   │   ├── Footer.jsx
│   │   ├── Logo.jsx                # logo SVG "Anh Ngữ C.A.N"
│   │   ├── ListeningMode.jsx      # nhúng video YouTube (nocookie) theo cấp độ
│   │   └── SpeakingMode.jsx       # chế độ luyện nói (hội thoại tuần tự, bấm giữ mic)
│   └── pages/
│       ├── HomePage.jsx
│       ├── LessonsPage.jsx        # luồng: chọn bộ đề → chọn cấp → chọn Listening/Speaking → nội dung
│       ├── AboutPage.jsx
│       └── ContactPage.jsx
└── public/
    └── assets/
        └── img/                   # ảnh minh họa (hiện chưa dùng, dữ liệu mẫu dùng avatar SVG sinh động)
```

**Lưu ý:** `Input/` (chứa sách giáo trình PDF gốc, có bản quyền) đã được thêm vào `.gitignore` — KHÔNG đẩy lên GitHub, chỉ dùng tham khảo nội bộ khi soạn dữ liệu Sheet.

**Chạy thử cục bộ:** `npm install` rồi `npm run dev` (mở `http://localhost:5173`). Build ra file tĩnh để deploy: `npm run build` (kết quả nằm ở thư mục `dist/`, không commit vào Git).

## 4. Cách thêm bài học mới (KHÔNG cần code)
**CHỐT (2026-08-12): Schema Sheet cũ (`Lessons`/`Vocab`/`DragDrop`/`Speaking`) đã lỗi thời**, không còn khớp với cấu trúc nội dung Starters/Movers/Flyers × 4 cấp × Listening/Speaking (xem mục 1). `sheetLoader.js` hiện vẫn đọc theo schema cũ và **CHƯA được viết lại** — trang Bài học (`LessonsPage.jsx`) hiện tại dùng dữ liệu mẫu cố định trong `src/lib/yleData.js`, không đọc Sheet.

**Đề xuất schema mới (CHƯA CHỐT — cần xác nhận với người dùng trước khi triển khai thật):**

| Tab | Cột đề xuất |
|---|---|
| `Series` | `series_id` (starters/movers/flyers), `title`, `order` |
| `Levels` | `level_id`, `series_id`, `number` (1-4) |
| `Listening` | `level_id`, `video_id` (YouTube video ID, Unlisted), `title` |
| `Speaking` | `level_id`, `order`, `image`, `question`, `answer_keywords` |

Nguyên tắc cho tab `Speaking` giữ như cũ (dựa theo định dạng thi thật Cambridge YLE, xem `Input/`):
- Mỗi dòng là 1 câu hỏi trong luồng hội thoại tuần tự; app đọc `question` bằng TTS, học sinh bấm giữ mic để trả lời.
- `answer_keywords` cách nhau bằng dấu phẩy, để trống nếu là câu hỏi mở không có đáp án cố định.
- App tự thêm câu chào mở đầu cố định trước khi vào các câu hỏi của cấp độ đó.
- Chỉ đưa vào Sheet các câu có đáp án tương đối cố định (What's this? / What colour...? / How many...?), không đưa câu hỏi sở thích cá nhân hoàn toàn tự do.

Cột `video_id` chỉ cần phần ID trong link YouTube (vd link `https://youtu.be/M7lc1UVf-VE` → `video_id = M7lc1UVf-VE`), video nên để chế độ **Không công khai (Unlisted)**, không dùng Google Drive (xem mục 2).

**Việc còn lại trước khi dùng Sheet thật:** viết lại `sheetLoader.js` theo schema trên và nối vào `LessonsPage.jsx` thay cho `yleData.js` — sẽ làm khi người dùng xác nhận schema và tạo Sheet thật.

## 5. Trạng thái hiện tại (2026-08-12)
- Đã migrate xong từ HTML/CSS/JS thuần sang **React + Vite**, build test thành công.
- Đã redesign toàn bộ frontend: thương hiệu "Anh Ngữ C.A.N" (logo SVG), top nav (Trang chủ/Bài học/Giới thiệu/Liên hệ), theme màu cam san hô + font Baloo 2/Nunito, responsive (nav gập hamburger dưới 768px).
- **Cấu trúc nội dung đã đổi:** trang Bài học giờ đi theo luồng chọn bộ đề (Starters/Movers/Flyers) → chọn cấp (1-4) → Listening (nhúng video) hoặc Speaking (luyện nói tương tác, tái dùng `SpeakingMode.jsx` cũ). 2 dạng bài cũ (kéo thả, flashcard theo chủ đề) đã bị loại bỏ.
- **Toàn bộ nội dung hiện là dữ liệu mẫu** (`src/lib/yleData.js`, `src/lib/mockData.js`) — video Listening là video mẫu chưa phải nội dung thật, câu hỏi Speaking cũng là mẫu. `sheetLoader.js` và `src/config.js` (`SHEET_ID` placeholder) hiện **chưa được nối lại** vì schema Sheet cũ đã lỗi thời (xem mục 4) — cần chốt schema mới với người dùng rồi mới viết lại loader.
- Chưa deploy lên GitHub Pages — cần tạo repo GitHub, push code, bật GitHub Pages trong Settings > Pages (build ra `dist/` trước khi deploy, hoặc dùng GitHub Actions tự build — cần thống nhất cách nào khi tới bước deploy thật). *(Ghi chú: repo `anhngucan-web` trên GitHub đã được force-push code hiện tại, nhưng GitHub Pages chưa được bật.)*
- **Sẽ KHÔNG đóng gói thành .exe hay app gì cả** — xem mục 2, đã chốt lần cuối là chỉ làm website.
- Repo Git đã khởi tạo (`git init`), có commit mốc lưu bản HTML/CSS/JS thuần trước khi migrate sang React (có thể xem lại lịch sử nếu cần đối chiếu).

## 6. Không tự ý làm gì khi chưa hỏi
- Khi đổi cấu trúc cột trong Sheet hoặc đổi nguồn dữ liệu nên xác nhận với người dùng trước.
- **Không đề xuất lại việc đóng gói thành app/exe/ios** (Electron, Capacitor, PWA cài đặt, v.v.) — đã bị loại bỏ hoàn toàn theo quyết định cuối cùng của người dùng ở mục 2.
- **Không đề xuất backend chạy server thật** (Django REST Framework, Node/Express, Firebase Functions trả phí, v.v.) — đã cân nhắc và loại bỏ vì không có cách host miễn phí ổn định 24/7. Google Sheets + GitHub Pages là giải pháp đã chốt.
- **Không tự ý đổi framework khác** (đã chốt React + Vite) trừ khi người dùng chủ động yêu cầu.

## 7. Hướng dẫn thiết lập (làm 1 lần)
**A. Tạo Google Sheet:** *(TẠM HOÃN — schema ở mục 4 chưa chốt. Khi chốt xong, tạo Sheet theo 4 tab đề xuất ở mục 4, chia sẻ "Anyone with the link" → Viewer, dán Sheet ID vào `src/config.js`, rồi viết lại `sheetLoader.js`.)*

**B. Deploy GitHub Pages:**
1. Tạo repo GitHub mới (public), push toàn bộ thư mục dự án lên (trừ `node_modules`, `dist`, `Input` — đã có trong `.gitignore`).
2. Vì đây là project React (cần build), có 2 cách bật GitHub Pages:
   - **Cách đơn giản:** chạy `npm run build` cục bộ, rồi push riêng thư mục `dist/` lên nhánh `gh-pages` (dùng gói `gh-pages` hoặc thao tác thủ công), rồi chọn nhánh đó trong Settings → Pages.
   - **Cách tự động (khuyến nghị về sau):** dùng GitHub Actions để tự `npm run build` và deploy mỗi khi push — cần thiết lập file workflow riêng, sẽ làm khi tới bước deploy thật.
3. Sau vài phút, GitHub cấp URL dạng `https://<username>.github.io/<ten-repo>/` — đây là link học sinh dùng để truy cập.
4. Mỗi khi thêm ảnh minh họa mới vào `public/assets/img/`, cần build lại + deploy lại (vì ảnh là file tĩnh, không đọc qua Sheet được).
