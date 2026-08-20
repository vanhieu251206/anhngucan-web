# Speech Worker — proxy Groq Whisper API

Cloudflare Worker nhỏ, chỉ 1 việc: nhận audio từ web, gọi Groq Whisper API (giữ key bí mật), trả
lại chữ nhận diện được. Free tier Cloudflare Worker (100.000 request/ngày) + free tier Groq
(~8 giờ audio/ngày) — không cần thẻ tín dụng cho cả 2 dịch vụ.

Đây KHÔNG phải engine nhận diện giọng nói bắt buộc — nếu chưa deploy Worker này (hoặc `VITE_WORKER_URL`
để trống), app tự dùng Whisper chạy local trong trình duyệt (xem `src/lib/whisperSpeech.js`) làm
dự phòng. Deploy Worker này chỉ để CẢI THIỆN độ chính xác/tốc độ khi có mạng.

## Các bước deploy (làm 1 lần)

1. **Tạo tài khoản Groq** (miễn phí, không cần thẻ): vào [console.groq.com](https://console.groq.com),
   đăng ký, vào mục **API Keys** → tạo 1 key mới, copy lại (chỉ hiện 1 lần).
2. **Cài Node.js** nếu máy chưa có (dùng để chạy `wrangler`, công cụ deploy Cloudflare Worker).
3. Trong thư mục `worker/` này, chạy:
   ```
   npm install
   npx wrangler login
   ```
   (mở trình duyệt, đăng nhập/tạo tài khoản Cloudflare miễn phí nếu chưa có — cũng không cần thẻ
   tín dụng cho gói Workers free tier).
4. Lưu API key Groq vào Worker (KHÔNG ghi vào code, tránh lộ lên Git):
   ```
   npx wrangler secret put GROQ_API_KEY
   ```
   dán key Groq đã copy ở bước 1 vào khi được hỏi.
5. Deploy:
   ```
   npm run deploy
   ```
   Sau khi xong, terminal in ra 1 URL dạng `https://anhngucan-speech-worker.<tên>.workers.dev` —
   copy URL này.
6. Điền URL vừa copy vào biến môi trường `VITE_WORKER_URL` (`.env` khi test local, và GitHub
   Secrets `VITE_WORKER_URL` khi deploy thật — xem `.env.example` và `.github/workflows/deploy.yml`).

## Test lại sau khi sửa code Worker

```
npm run dev
```
sẽ chạy Worker ở `http://localhost:8787` để test cục bộ trước khi deploy thật (`npm run deploy`).

## Đổi domain app

Nếu deploy web ở domain khác `vanhieu251206.github.io`, sửa `ALLOWED_ORIGINS` trong `src/index.js`
rồi deploy lại.
