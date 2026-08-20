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
- **NGOẠI LỆ đã xác nhận (2026-08-13): dùng Firebase Auth + Firestore (gói Spark — miễn phí) cho đăng nhập admin/teacher + khoá bài học bằng mật khẩu chung.** Đây là dịch vụ BaaS (Backend-as-a-Service) có sẵn, KHÔNG phải tự vận hành server — vẫn giữ đúng tinh thần "không backend trả phí". **TUYỆT ĐỐI KHÔNG dùng Cloud Functions** (cần nâng lên gói Blaze, phải nhập thẻ tín dụng) — mọi logic (kiểm tra mật khẩu, phân quyền) đều làm ở client + Firestore Security Rules. Vì không có backend, mật khẩu chung được lưu dưới dạng **hash SHA-256** trong Firestore (không lưu plaintext), so khớp bằng Web Crypto API ngay trên trình duyệt (`src/lib/lessonAccess.js`) — đây là đánh đổi bảo mật đã được người dùng xác nhận chấp nhận (đủ dùng cho nội dung ít nhạy cảm như bài học tiếng Anh trẻ em, KHÔNG phải bảo mật cấp production thật). Không tự ý "nâng cấp" cơ chế này thành có server/Cloud Functions khi chưa hỏi lại người dùng. Chi tiết kiến trúc: `src/lib/firebase.js`, `src/lib/authContext.jsx`, `src/lib/lessonAccess.js`, `src/components/PasswordGate.jsx`, `src/pages/LoginPage.jsx`, `src/pages/SettingsPage.jsx`. Cấu hình qua biến môi trường `VITE_FIREBASE_*` (xem `.env.example`, GitHub Actions secrets trong `.github/workflows/deploy.yml`).
- **TUYỆT ĐỐI KHÔNG dùng Firebase Storage** (phát hiện 2026-08-14 khi làm CMS "Tạo bài"): Google giờ bắt buộc nâng lên gói Blaze (nhập thẻ thanh toán) mới bật được Storage, kể cả khi dùng trong hạn mức miễn phí — trái ràng buộc "không cần thẻ thanh toán" của dự án. **Đã tích hợp Cloudinary thay thế (2026-08-15):** free tier, không cần thẻ thanh toán, dùng "unsigned upload preset" nên client gọi thẳng Cloudinary API mà không cần backend/API secret (`src/lib/cloudinaryUpload.js`, hàm `uploadToCloudinary()`). Ảnh/audio trong CMS (`src/pages/dashboard/CreateLessonPage.jsx`) giờ nhận **dán URL có sẵn HOẶC bấm "Chọn file để upload"** (`ImageUploadField`/`AudioUploadField` có cả ô URL lẫn nút upload trực tiếp qua Cloudinary, tự điền URL trả về). Cấu hình qua `VITE_CLOUDINARY_CLOUD_NAME`/`VITE_CLOUDINARY_UPLOAD_PRESET` (xem `.env.example`, GitHub Actions secrets). Người dùng cần tự tạo tài khoản Cloudinary + upload preset (Signing Mode = Unsigned) trên Cloudinary Console — Claude không tự làm được bước này. Không tự ý thử lại tích hợp Firebase Storage khi chưa hỏi lại người dùng.
- **Vai trò hiện có:** `admin`/`teacher` (tài khoản thật, đăng nhập qua Firebase Auth, tạo/gán role thủ công qua Firebase Console — chưa có màn tự quản lý tài khoản trong app) và `guest` (= học sinh, không cần tài khoản, chỉ cần nhập đúng mật khẩu chung để mở khoá bài học trong phiên trình duyệt đó). Đây mới là **Phase 1** (chỉ đăng nhập + khoá nội dung) — soạn bài không cần code (CMS) và theo dõi tiến độ học sinh là các phase sau, CHƯA làm.
- **Nhận diện giọng nói: dùng DUY NHẤT Whisper (model `base.en`) chạy client-side qua `@huggingface/transformers` (v3)** (đổi lại 2026-08-20 — đã thử Azure AI Speech qua Cloudflare Worker nhưng Azure bắt buộc thẻ tín dụng/ghi nợ quốc tế để xác minh tài khoản kể cả free tier, người dùng không có thẻ nên quay lại giải pháp mã nguồn mở/miễn phí hoàn toàn). Từng thử `small.en` (chính xác hơn) nhưng file decoder/encoder của nó vượt giới hạn 100MB/file của GitHub — cần Git LFS, mà free tier LFS chỉ 1GB băng thông/tháng, không đủ cho quy mô ~100 học sinh (chỉ vài lượt tải là hết quota, app sẽ không nhận diện được nữa tới tháng sau) — nên đổi xuống **`base.en`** để mọi file đều dưới 100MB, push thẳng lên repo bình thường, không cần LFS. **File model TỰ HOST trong `public/models/onnx-community/whisper-base.en/onnx/`** (KHÔNG tải qua CDN Hugging Face — tránh phụ thuộc tốc độ/khả năng truy cập CDN nước ngoài từ VN), `src/lib/whisperSpeech.js` tự chọn theo thiết bị (`navigator.gpu`), dùng chung 1 file decoder cho cả 2 nhánh:
  - **WebGPU** (`encoder_model_fp16.onnx`, ~41MB) — chạy trên GPU máy/điện thoại qua trình duyệt, nhanh hơn CPU. Dùng khi trình duyệt hỗ trợ WebGPU (đa số máy tính/điện thoại đời 2023+, Chrome/Edge, Safari 18+/iOS 18+).
  - **WASM/CPU** (`encoder_model_quantized.onnx`, ~23MB) — fallback khi không có WebGPU (Safari cũ, webview trong app Zalo/FB, Android đời thấp...), chậm hơn nhưng chạy được mọi nơi.
  - **`decoder_model_merged_quantized.onnx`** (~54MB) — dùng chung cho cả 2 nhánh.
  Tổng ~117MB trong repo — không tốn phí và không cần Git LFS (GitHub Pages free hosting không có billing, chỉ có soft limit ~1GB repo/~100GB băng thông/tháng; với ~100 học sinh × ~40-55MB/lượt tải đầu ≈ 4-5.5GB tổng, vẫn dưới xa mức khuyến nghị). Trình duyệt tự cache lại bộ đang dùng sau lần tải đầu (Cache Storage của onnxruntime-web) nên chỉ tải 1 LẦN DUY NHẤT mỗi thiết bị, các lượt học sau gần như tức thì — `src/components/ModelPreloader.jsx` được nhúng ở mọi trang chính trong `App.jsx` để bắt đầu tải/preload ngầm (kèm "warm up" biên dịch shader WebGPU) ngay khi mở web, tránh học sinh phải đợi khi bấm mic lần đầu trong bài Speaking. Frontend gọi qua `src/lib/pronunciationApi.js` (hàm `assessPronunciation()`, chỉ trả `{ text, accuracyScore: null }` — Whisper không có điểm accuracy chuẩn hoá, nơi gọi tự so khớp từ khoá bằng `fuzzyIncludesWord()` trong `src/lib/speech.js`), dùng trong `src/components/SceneRunner.jsx` và `src/components/SpeakingMode.jsx`. Hoàn toàn miễn phí, không tài khoản, không thẻ tín dụng, không server nào nhận audio của học sinh (100% chạy trong trình duyệt). **Không tự ý đổi sang Azure, Git LFS, hay dịch vụ trả phí/cần thẻ tín dụng nào khác khi chưa hỏi lại người dùng** — nếu muốn cải thiện độ chính xác thêm, cân nhắc đổi cỡ model nhưng phải kiểm tra dung lượng file từng cái vẫn dưới 100MB (giới hạn cứng của GitHub không LFS) trước khi đổi. `SpeechRecognition` (Web Speech API trình duyệt) đã bị loại bỏ hoàn toàn khỏi dự án vì không chạy được trên Safari/iOS.
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
├── .github/workflows/deploy.yml  # GitHub Actions: tự build + deploy lên GitHub Pages khi push main (bơm sẵn secrets VITE_FIREBASE_*/VITE_CLOUDINARY_*/VITE_WORKER_URL)
├── .env.example                   # mẫu biến môi trường (Firebase/Cloudinary) — copy thành .env (gitignore), điền giá trị thật
├── src/
│   ├── main.jsx                   # bọc <App/> bằng <AuthProvider> (src/lib/authContext.jsx)
│   ├── App.jsx                    # router theo state: home / lessons / about / contact / login / settings
│   ├── index.css                  # theme cam san hô + xanh ngọc, font Baloo 2 + Nunito
│   ├── config.js                  # SHEET_ID placeholder (chưa dùng — xem mục 5)
│   ├── lib/
│   │   ├── sheetLoader.js         # đọc Google Sheets qua API gviz — SCHEMA CŨ, chưa viết lại/chưa dùng
│   │   ├── yleData.js             # dữ liệu bài học thật + mẫu (xem mục 5)
│   │   ├── mockData.js            # dữ liệu mẫu cho trang chủ
│   │   ├── speech.js              # playLine() phát audio thật, normalize(), fuzzyIncludesWord() so khớp gần đúng, isRecordingSupported()
│   │   ├── whisperSpeech.js       # transcribeBlob()/loadTranscriber() — chạy Whisper small.en qua @huggingface/transformers, tự chọn WebGPU/WASM, model tự host trong public/models/
│   │   ├── pronunciationApi.js    # assessPronunciation() gọi whisperSpeech.transcribeBlob() — engine nhận diện giọng nói DUY NHẤT, không fallback
│   │   ├── firebase.js            # khởi tạo Firebase app 1 lần, export auth/db (xem mục 2 — ngoại lệ backend)
│   │   ├── authContext.jsx        # AuthProvider + useAuth() — user/role (admin/teacher/guest)/isStaff/logout()
│   │   ├── lessonAccess.js        # hash mật khẩu (SHA-256), khoá/mở khoá bài học theo phiên (sessionStorage)
│   │   ├── adminLessons.js / lessons.js  # CRUD bài học qua Firestore (CMS "Tạo bài", xem mục 5/6)
│   │   └── cloudinaryUpload.js    # upload ảnh/audio thẳng lên Cloudinary (unsigned preset, không cần backend) — thay Firebase Storage
│   ├── components/
│   │   ├── Header.jsx / Footer.jsx / Logo.jsx
│   │   ├── ListeningMode.jsx      # nhúng video YouTube theo cấp độ
│   │   ├── ModelPreloader.jsx     # preload ngầm model Whisper ngay khi mở web, nhúng ở mọi trang chính trong App.jsx
│   │   ├── SceneRunner.jsx        # chạy bài Speaking theo scene (xem mục 4) — component chính hiện dùng
│   │   ├── SpeakingMode.jsx       # luồng mic hỏi-đáp kiểu cũ, hiện dùng tạm cho Part 3/4 (còn là mock)
│   │   ├── PasswordGate.jsx       # màn nhập mật khẩu chung, hiện thay nội dung bài học khi guest chưa unlock
│   │   └── dashboard/ImageUploadField.jsx / AudioUploadField.jsx  # dán URL HOẶC upload trực tiếp qua Cloudinary
│   └── pages/
│       ├── HomePage.jsx / AboutPage.jsx / ContactPage.jsx
│       ├── LoginPage.jsx          # đăng nhập admin/teacher (email/password qua Firebase Auth)
│       ├── SettingsPage.jsx       # chỉ admin/teacher — đổi mật khẩu chung mở khoá bài học
│       └── LessonsPage.jsx        # luồng: chọn bộ đề → chọn cấp → Listening/Speaking (khoá bằng PasswordGate nếu guest chưa unlock)
├── public/assets/
│   ├── img/speaking/<series>/<level>/test<n>/part<n>/   # ảnh Scene + Object card từng bài Speaking
│   └── img/mascot/bee.png         # linh vật ong — đại diện GIÁM KHẢO, hiện cạnh mọi câu thoại giám khảo
├── public/models/onnx-community/whisper-base.en/   # model Whisper tự host, encoder fp16 (WebGPU) + quantized (WASM) + decoder chung, ~117MB — xem mục 2
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
- **Nhận diện giọng nói (2026-08-20): Whisper `base.en` client-side qua `@huggingface/transformers`, tự chọn WebGPU (nhanh) hoặc WASM/CPU (fallback), model tự host trong `public/models/` (~117MB, không cần Git LFS)** (không dùng `SpeechRecognition` để chạy được trên iOS; đã thử Azure Speech qua Cloudflare Worker nhưng bị chặn vì Azure bắt buộc thẻ tín dụng; cũng đã thử `small.en` nhưng file vượt giới hạn 100MB của GitHub và Git LFS free tier không đủ băng thông cho quy mô ~100 học sinh — xem mục 2). Cần deploy thật lên GitHub Pages để test kỹ trên điện thoại thật (đặc biệt thiết bị fallback WASM, có thể transcribe chậm hơn máy tính có WebGPU).
- Đã có linh vật ong đại diện giám khảo, hiện cạnh mọi câu thoại trong Speaking.
- Chưa nối Google Sheets — dữ liệu vẫn nhúng cứng trong code.
- **Đã xong Phase 1 phân quyền (2026-08-13):** đăng nhập admin/teacher qua Firebase Auth + khoá toàn bộ bài học (Listening/Speaking) bằng 1 mật khẩu chung cho guest/học sinh — xem mục 2 (ngoại lệ Firebase) và mục 3 (các file `firebase.js`/`authContext.jsx`/`lessonAccess.js`/`PasswordGate.jsx`/`LoginPage.jsx`/`SettingsPage.jsx`). Cần người dùng tự làm thao tác tay trên Firebase Console (tạo project, bật Email/Password, tạo tài khoản admin đầu tiên, thêm GitHub Secrets...) trước khi tính năng chạy được thật — Claude không tự làm được các bước này.
- **Phase 2 (soạn bài không cần code/CMS) và Phase 3 (theo dõi tiến độ học sinh) CHƯA làm** — chỉ làm khi người dùng chủ động yêu cầu tiếp.

## 7. Không tự ý làm gì khi chưa hỏi
- Khi đổi cấu trúc dữ liệu Speaking (loại scene, schema Sheet sau này...) cần xác nhận với người dùng trước.
- **Không đề xuất lại đóng gói app/exe/ios** — đã loại bỏ hoàn toàn.
- **Không đề xuất backend chạy server thật** (Firebase Auth+Firestore là ngoại lệ BaaS đã xác nhận riêng, xem mục 2 — không phải giấy phép để thêm backend/server khác).
- **Không tự ý đổi framework** (đã chốt React + Vite) trừ khi được yêu cầu.
- Khi soạn bài Speaking mới: theo đúng `docs/quy-trinh/`, không tự suy diễn cơ chế tương tác mới khi chưa được chốt (xem `docs/quy-trinh/LOI-DA-GAP.md` để tránh lặp lỗi cũ).
- **Không tự ý thêm Cloud Functions/nâng gói Firebase lên Blaze** — chỉ dùng Auth + Firestore trên gói Spark (free). Không tự ý "nâng cấp" cơ chế mật khẩu hash client-side thành có server, trừ khi người dùng chủ động yêu cầu.
- **Không tự ý làm Phase 2 (CMS soạn bài) hay Phase 3 (theo dõi tiến độ học sinh)** khi chưa được yêu cầu — 2 phase này đã cố tình hoãn lại sau Phase 1 phân quyền, xem mục 6.

## 8. Ghi chú về `docs/` và `Bài học/`
- `docs/quy-trinh/` chứa toàn bộ quy trình soạn bài Speaking (chia scene, tạo ảnh, đưa vào code, lỗi đã gặp...) — chỉ hỗ trợ nội bộ, **không đẩy lên GitHub**.
- `Bài học/<tên-bài>/` là thư mục **staging tạm** — nơi người dùng thả ảnh/dữ liệu thô khi soạn 1 bài (kịch bản gốc, ảnh cắt từ sách, ảnh AI-gen...). Claude xử lý xong thì copy vào đúng chỗ trong project (`public/assets/...`, `yleData.js`). Thư mục này cũng **không đẩy lên GitHub**.
- Cả 2 thư mục này đều nằm trong `.gitignore`.
