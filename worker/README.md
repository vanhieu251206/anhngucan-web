# Speech Worker — proxy AssemblyAI Speech-to-Text API

Cloudflare Worker nhỏ, chỉ 1 việc: nhận audio từ web, gọi AssemblyAI Speech-to-Text API (giữ key
bí mật), trả lại chữ nhận diện được. Free tier Cloudflare Worker (100.000 request/ngày) + free
tier AssemblyAI (185 giờ audio batch) — không cần thẻ tín dụng cho cả 2 dịch vụ.

Đã chuyển từ Groq sang AssemblyAI (2026-08-22): Groq tạm khoá nâng cấp gói trả phí (Developer
tier) và giới hạn free 20 request/phút không đủ khi nhiều học sinh cùng luyện Speaking một lúc.
AssemblyAI đắt hơn Groq ~4-5 lần mỗi giờ audio khi trả phí, nhưng free tier 185 giờ đủ dùng lâu
dài ở quy mô ~100 học sinh, và không cần thẻ tín dụng để bắt đầu.

**KHÔNG còn dự phòng Whisper local** (đã bỏ khỏi code) — nếu Worker này chưa deploy/cấu hình
(`VITE_WORKER_URL` để trống) hoặc gọi lỗi, tính năng ghi âm sẽ báo lỗi thẳng cho học sinh thay vì
tự chuyển sang engine khác (xem `src/lib/pronunciationApi.js`).

## Các bước deploy (làm 1 lần)

1. **Tạo tài khoản AssemblyAI** (free tier 185 giờ audio, không cần thẻ): vào
   [assemblyai.com](https://www.assemblyai.com), đăng ký, vào Dashboard → **API Keys**, copy key.
2. **Cài Node.js** nếu máy chưa có (dùng để chạy `wrangler`, công cụ deploy Cloudflare Worker).
3. Trong thư mục `worker/` này, chạy:
   ```
   npm install
   npx wrangler login
   ```
   (mở trình duyệt, đăng nhập/tạo tài khoản Cloudflare miễn phí nếu chưa có — cũng không cần thẻ
   tín dụng cho gói Workers free tier).
4. Lưu API key AssemblyAI vào Worker (KHÔNG ghi vào code, tránh lộ lên Git):
   ```
   npx wrangler secret put ASSEMBLYAI_API_KEY
   ```
   dán key AssemblyAI đã copy ở bước 1 vào khi được hỏi.
5. Deploy:
   ```
   npm run deploy
   ```
   Sau khi xong, terminal in ra 1 URL dạng `https://anhngucan-speech-worker.<tên>.workers.dev` —
   copy URL này.
6. Điền URL vừa copy vào biến môi trường `VITE_WORKER_URL` (`.env` khi test local, và GitHub
   Secrets `VITE_WORKER_URL` khi deploy thật — xem `.env.example` và `.github/workflows/deploy.yml`).

**Lưu ý nếu trước đây đã deploy bản dùng Groq:** cần chạy lại bước 4 với key MỚI
(`ASSEMBLYAI_API_KEY` thay vì `GROQ_API_KEY`) rồi deploy lại (bước 5) — secret cũ `GROQ_API_KEY`
không còn được code dùng tới nữa, có thể xoá bằng `npx wrangler secret delete GROQ_API_KEY` (không
bắt buộc, chỉ để dọn dẹp).

## Test lại sau khi sửa code Worker

```
npm run dev
```
sẽ chạy Worker ở `http://localhost:8787` để test cục bộ trước khi deploy thật (`npm run deploy`).

## Đổi domain app

Web chạy ở `anhngucan.com` (tên miền riêng) + `vanhieu251206.github.io`. Đổi/thêm domain thì sửa `ALLOWED_ORIGINS` trong `src/index.js`
rồi deploy lại.

## Xoá hẳn tài khoản học sinh (`/admin/delete-student`, thêm 2026-09-25)

Nút "Xoá" học sinh trong Dashboard gọi Worker này để xoá CẢ tài khoản đăng nhập (Firebase Auth) lẫn hồ sơ
(Firestore) — trình duyệt không tự xoá được tài khoản Auth của người khác, còn Cloud Functions cần gói Blaze.
Chỉ admin + giáo viên chính gọi được (Worker tự kiểm tra), chỉ xoá được tài khoản `@hocsinh.local`.
Code ở `src/admin.js`. Cần thêm khoá service account (làm 1 lần):

1. Firebase Console → ⚙ **Project settings** → tab **Service accounts** → **Generate new private key** → tải
   file `.json` về. **Lưu file này NGOÀI thư mục dự án** (không để lọt lên GitHub — khoá có toàn quyền project).
2. Trong thư mục `worker/`, chạy (PowerShell, thay đường dẫn file vừa tải):
   ```
   Get-Content "C:\duong-dan\key.json" -Raw | npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
   ```
3. `npm run deploy`
4. Xoá file `.json` trên máy (khoá đã nằm trên Cloudflare), hoặc cất nơi an toàn.

## Bảo vệ `/transcribe` (thêm 2026-09-25)

`/transcribe` BẮT BUỘC Firebase ID token của tài khoản đã đăng nhập (header `Authorization: Bearer ...`, web tự
gửi — `src/lib/pronunciationApi.js`) và giới hạn mỗi tài khoản 20 lượt/phút (binding `TRANSCRIBE_LIMITER` trong
`wrangler.toml`). Xác minh token dùng project id lấy từ secret `FIREBASE_SERVICE_ACCOUNT` (mục trên) — **phải có
secret này thì ghi âm mới chạy**. Sửa xong nhớ `npm run deploy` lại, và deploy Worker TRƯỚC hoặc CÙNG LÚC với web
(Worker cũ vẫn chạy được với web mới, nhưng web cũ sẽ bị Worker mới từ chối vì không gửi token).

## Nộp bài qua máy chủ (`/test/start`, `/test/submit`, thêm 2026-09-25)

Học sinh không còn tự ghi kết quả/số lượt vào Firestore: web gọi `/test/start` khi vào bài (ghi giờ bắt đầu) và
`/test/submit` khi nộp. Worker kiểm tra lớp, lần mở bài, hạn chót, số lượt, thời gian làm bài, tự chấm bằng code
dùng chung `../src/lib/grading/*` (wrangler tự đóng gói), rồi ghi `testResults` + cộng `attempts`. Dùng cùng secret
`FIREBASE_SERVICE_ACCOUNT` như mục trên. Code ở `src/submit.js` + `src/firestore.js` (Firestore REST).
