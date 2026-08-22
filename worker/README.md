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

Nếu deploy web ở domain khác `vanhieu251206.github.io`, sửa `ALLOWED_ORIGINS` trong `src/index.js`
rồi deploy lại.
