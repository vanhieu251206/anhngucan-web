# CLAUDE.md — App Học Tiếng Anh (dự án riêng)

> Đây là dự án **ứng dụng web/app học tiếng Anh**, đặt tại `D:\App Hoc Tieng Anh`, TÁCH BIỆT hoàn toàn khỏi dự án làm video/truyện tranh ở `D:\Project Tiếng Anh\` (không dùng chung cấu trúc, không dùng chung CLAUDE.md của dự án đó). Đọc file này trước khi làm việc trong thư mục này.
>
> **Quy trình soạn nội dung Speaking chi tiết nằm ở `docs/quy-trinh/`** (không đẩy lên GitHub, xem mục 8) — đọc `docs/quy-trinh/B0-Chia-scene.md` trở đi trước khi soạn/code 1 bài Speaking mới.

## 1. Mục tiêu dự án
Xây dựng một ứng dụng học tiếng Anh cho học sinh nhỏ tuổi, nội dung bám sát 3 bộ đề luyện thi **Cambridge YLE**: **Starters, Movers, Flyers**. Mỗi bộ có **4 cấp độ**, mỗi cấp độ gồm **2 dạng bài**:
1. **Listening** — nhúng video nghe có sẵn (không tự lưu trữ file video/audio, xem mục 2 về lý do).
2. **Speaking** — mô phỏng đúng bài thi nói thật của Cambridge YLE, chia thành nhiều **scene** tuần tự kiểu Duolingo (xem mục 4).

**Về bản quyền:** Sách giáo trình gốc (PDF trong `Input/`) có bản quyền — KHÔNG host trực tiếp file audio gốc của nhà xuất bản lên web public. Với Listening: dùng video nhúng qua YouTube ở chế độ **Không công khai (Unlisted)**. Với Speaking: chỉ lấy **text câu hỏi** + **tự cắt/phục hồi ảnh minh hoạ từ sách bản màu** (xem `docs/quy-trinh/`), không phát lại audio gốc của sách.

## 2. Ràng buộc kỹ thuật đã chốt với người dùng
- **Không tốn phí duy trì.** Không dùng backend/server trả phí, không dùng API AI trả phí theo lượng dùng.
- **KHÔNG đóng gói thành app/exe/ios gì cả.** Chỉ là **website học tiếng Anh thuần túy** chạy qua trình duyệt trên mọi thiết bị. Không Electron, không Capacitor, không PWA cài đặt. KHÔNG tự ý đề xuất lại đóng gói.
- **Responsive bắt buộc** trên mọi kích thước màn hình.
- **Frontend: React (Vite).** Build ra file tĩnh, deploy GitHub Pages qua GitHub Actions (`.github/workflows/deploy.yml`) — tự động build + deploy mỗi khi push lên `main`.
- **KHÔNG dùng backend chạy server thật** (đã cân nhắc và loại bỏ Django/Node/Express...) — lý do: không có cách host miễn phí ổn định 24/7.
- **Nhận diện giọng nói: đã đổi từ `SpeechRecognition` sang Whisper-tiny chạy WASM ngay trong trình duyệt** (`@xenova/transformers`, xem `src/lib/whisperSpeech.js`) — lý do: `SpeechRecognition` không chạy được trên Safari/iOS (mọi trình duyệt iOS đều dùng chung engine WebKit theo quy định Apple). Whisper WASM chạy client-side, miễn phí, nhất quán trên mọi nền tảng. Model tự tải qua CDN Hugging Face lần đầu vào web (xem `ModelPreloader.jsx`, hiện card loading góc màn hình), trình duyệt tự cache lại.
- **`getUserMedia` (ghi âm) cần HTTPS** (secure context) — dev server bật sẵn HTTPS tự ký qua `@vitejs/plugin-basic-ssl` (xem `vite.config.js`) để test mic được trên điện thoại qua LAN (`npm run dev -- --host`, dùng `https://<IP>:5173`, chấp nhận cảnh báo chứng chỉ tự ký). Deploy thật lên GitHub Pages vốn đã HTTPS.
- **CHỐT: Deploy online trên GitHub Pages** (miễn phí, đã bật). Repo: `vanhieu251206/anhngucan-web`.
- **Dữ liệu bài học hiện đang nhúng cứng trong `src/lib/yleData.js`** (chưa nối Google Sheets — xem mục 5).

## 3. Cấu trúc thư mục (React + Vite)
```
App Hoc Tieng Anh/
├── CLAUDE.md
├── package.json                  # scripts: npm run dev / npm run build / npm run preview
├── vite.config.js                 # base: './' (subpath GitHub Pages) + basicSsl() (HTTPS local cho mic)
├── index.html
├── .github/workflows/deploy.yml  # GitHub Actions: tự build + deploy lên GitHub Pages khi push main
├── src/
│   ├── main.jsx
│   ├── App.jsx                    # router theo state: home / lessons / about / contact
│   ├── index.css                  # theme cam san hô + xanh ngọc, font Baloo 2 + Nunito
│   ├── config.js                  # SHEET_ID placeholder (chưa dùng — xem mục 5)
│   ├── lib/
│   │   ├── sheetLoader.js         # đọc Google Sheets qua API gviz — SCHEMA CŨ, chưa viết lại/chưa dùng
│   │   ├── yleData.js             # dữ liệu bài học thật + mẫu (xem mục 5)
│   │   ├── mockData.js            # dữ liệu mẫu cho trang chủ
│   │   ├── speech.js              # speak() TTS (rate chậm + timeout dự phòng), normalize()
│   │   └── whisperSpeech.js       # nhận diện giọng nói Whisper WASM (loadTranscriber, transcribeBlob có timeout)
│   ├── components/
│   │   ├── Header.jsx / Footer.jsx / Logo.jsx
│   │   ├── ListeningMode.jsx      # nhúng video YouTube theo cấp độ
│   │   ├── SceneRunner.jsx        # chạy bài Speaking theo scene (xem mục 4) — component chính hiện dùng
│   │   ├── SpeakingMode.jsx       # luồng mic hỏi-đáp kiểu cũ, hiện dùng tạm cho Part 3/4 (còn là mock)
│   │   └── ModelPreloader.jsx     # tải model Whisper ngay khi vào web, hiện card loading góc màn hình
│   └── pages/
│       ├── HomePage.jsx / AboutPage.jsx / ContactPage.jsx
│       └── LessonsPage.jsx        # luồng: chọn bộ đề → chọn cấp → Listening/Speaking
├── public/assets/
│   ├── img/speaking/<series>/<level>/test<n>/part<n>/   # ảnh Scene + Object card từng bài Speaking
│   └── img/mascot/bee.png         # linh vật ong — đại diện GIÁM KHẢO, hiện cạnh mọi câu thoại giám khảo
├── docs/quy-trinh/                # quy trình soạn Speaking (B0 chia scene, B1 tạo ảnh, B2/B3 đưa vào code...)
│                                  # KHÔNG đẩy lên GitHub (gitignore) — chỉ hỗ trợ chuẩn bị dữ liệu nội bộ
└── Bài học/                       # thư mục staging: nơi thả ảnh/dữ liệu thô khi soạn 1 bài — KHÔNG đẩy lên GitHub
```

**Lưu ý:** `Input/` (sách giáo trình PDF gốc, có bản quyền) và `docs/` và `Bài học/` đều nằm trong `.gitignore` — không đẩy lên GitHub.

**Chạy thử cục bộ:** `npm install` rồi `npm run dev -- --host` (mở `https://localhost:5173`, chấp nhận cảnh báo chứng chỉ tự ký). Build: `npm run build` (ra `dist/`, không commit).

## 4. Cấu trúc bài Speaking: chia theo scene (không phải danh sách câu hỏi phẳng)

Mỗi bài Speaking (1 series + 1 cấp + 1 Test + 1 Part) được soạn theo quy trình ở `docs/quy-trinh/` (đọc trước khi soạn bài mới), chia thành danh sách **scene** chạy tuần tự kiểu Duolingo (từng scene 1, làm xong mới qua scene sau), gồm 5 loại (xử lý bởi `SceneRunner.jsx`):

| Loại scene | Cách hoạt động |
|---|---|
| `mic` (Chào hỏi / câu hỏi mic) | Hiện gợi ý mẫu câu trả lời (có chỗ trống `....`), học sinh bấm giữ mic → Whisper nhận diện → khen bằng TTS → tự chuyển scene. |
| `narration` (Huong-dan) | Lời dẫn/demo của giám khảo, không cần trả lời — đọc xong TTS + nghỉ 1 giây thì tự động chuyển scene. |
| `scene-click` (Canh-click) | Học sinh click đúng vật trong ảnh Scene lớn (ảnh cắt thật từ sách màu). |
| `card-select` (The-chon) | Học sinh chọn đúng thẻ trong 4 lựa chọn (luôn đủ 4, lấy từ đúng bộ Object card của Test đó). |
| `drag-drop` (Dat-vi-tri) | Học sinh kéo-thả thẻ vào đúng vị trí trên ảnh Scene. |

Mỗi scene đều hiện **linh vật ong** (`public/assets/img/mascot/bee.png`) cạnh câu thoại giám khảo — ong đại diện cho giám khảo trong toàn bộ luồng Speaking.

Đã hoàn chỉnh: **Starters 1 – Test 1 – Part 1** (11 scene, dữ liệu trong `yleData.js`). Các bài khác (Part 2/3/4, Test 2/3, cấp độ khác) làm dần theo cùng quy trình.

## 5. Cách thêm bài học mới

**Hiện tại (đang dùng):** sửa trực tiếp `src/lib/yleData.js`, theo đúng quy trình chia scene ở `docs/quy-trinh/B0-Chia-scene.md` → `B1-Chuan-bi-anh-va-am-thanh.md` → `B2-Dua-vao-code.md` → `B3-Code-scene.md`.

**Dự tính về sau (CHƯA triển khai):** nối Google Sheets làm nguồn dữ liệu để người không biết code (admin/giáo viên) thêm bài mới không cần sửa code. `sheetLoader.js` hiện vẫn theo schema cũ (lỗi thời, không khớp cấu trúc scene mới) — cần thiết kế lại schema Sheet cho khớp cấu trúc scene ở mục 4 rồi mới viết lại loader. CHỈ làm khi người dùng chủ động yêu cầu và xác nhận schema.

## 6. Trạng thái hiện tại (2026-08-13)
- React + Vite, đã deploy thật lên **GitHub Pages** qua GitHub Actions (push `main` là tự deploy).
- Listening: vẫn dùng video mẫu (`PLACEHOLDER_VIDEO_ID`), chưa có video thật.
- Speaking: **Starters 1 – Test 1 – Part 1 đã hoàn chỉnh** (11 scene, dữ liệu + ảnh thật, đã test kỹ). Part 2/3/4 và các Test/cấp khác vẫn là dữ liệu mẫu (`SpeakingMode.jsx` + mock trong `yleData.js`).
- Đã đổi nhận diện giọng nói sang Whisper WASM client-side (không dùng `SpeechRecognition` nữa) để chạy được trên iOS.
- Đã có linh vật ong đại diện giám khảo, hiện cạnh mọi câu thoại trong Speaking.
- Chưa nối Google Sheets — dữ liệu vẫn nhúng cứng trong code.

## 7. Không tự ý làm gì khi chưa hỏi
- Khi đổi cấu trúc dữ liệu Speaking (loại scene, schema Sheet sau này...) cần xác nhận với người dùng trước.
- **Không đề xuất lại đóng gói app/exe/ios** — đã loại bỏ hoàn toàn.
- **Không đề xuất backend chạy server thật.**
- **Không tự ý đổi framework** (đã chốt React + Vite) trừ khi được yêu cầu.
- Khi soạn bài Speaking mới: theo đúng `docs/quy-trinh/`, không tự suy diễn cơ chế tương tác mới khi chưa được chốt (xem `docs/quy-trinh/LOI-DA-GAP.md` để tránh lặp lỗi cũ).

## 8. Ghi chú về `docs/` và `Bài học/`
- `docs/quy-trinh/` chứa toàn bộ quy trình soạn bài Speaking (chia scene, tạo ảnh, đưa vào code, lỗi đã gặp...) — chỉ hỗ trợ nội bộ, **không đẩy lên GitHub**.
- `Bài học/<tên-bài>/` là thư mục **staging tạm** — nơi người dùng thả ảnh/dữ liệu thô khi soạn 1 bài (kịch bản gốc, ảnh cắt từ sách, ảnh AI-gen...). Claude xử lý xong thì copy vào đúng chỗ trong project (`public/assets/...`, `yleData.js`). Thư mục này cũng **không đẩy lên GitHub**.
- Cả 2 thư mục này đều nằm trong `.gitignore`.
