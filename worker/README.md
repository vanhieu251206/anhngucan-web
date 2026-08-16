# anhngucan-worker

Cloudflare Worker nhỏ, làm "trạm trung chuyển" giấu key cho **1 việc duy nhất**:

- `POST /pronunciation` — nhận audio ghi âm của học sinh, gọi Azure AI Speech Pronunciation Assessment (giữ key bí mật, không lộ ra trình duyệt), trả về text nhận diện + điểm phát âm. Mở cho khách (học sinh), không cần đăng nhập.

(Việc upload ảnh cho CMS "Tạo bài" đã chuyển sang dùng **Cloudinary** trực tiếp từ client — xem `src/lib/cloudinaryUpload.js` ở project chính — không cần qua Worker nữa.)

Đây là ngoại lệ backend đã được xác nhận trong `CLAUDE.md` mục 2 — chỉ dùng cho việc proxy Azure Speech, không tự ý mở rộng thêm logic khác khi chưa hỏi lại.

## Cài đặt lần đầu

```bash
cd worker
npm install
npx wrangler login
```

## Chạy thử local

Tạo file `worker/.dev.vars` (không commit — đã có trong `.gitignore`):

```
AZURE_SPEECH_KEY=dan_key_that_vao_day
AZURE_SPEECH_REGION=eastasia
```

Rồi chạy:

```bash
npx wrangler dev
```

Test thử:

```bash
curl -X POST http://localhost:8787/pronunciation \
  -F "audio=@sample.webm;type=audio/webm" \
  -F "expectedText=Hello, my name is Anna"
```

## Deploy thật

1. Sửa `wrangler.toml`: điền đúng `ALLOWED_ORIGIN` (domain GitHub Pages thật).
2. Đưa secret vào Worker (chỉ cần làm lại khi đổi key):
   ```bash
   npx wrangler secret put AZURE_SPEECH_KEY
   npx wrangler secret put AZURE_SPEECH_REGION
   ```
3. Deploy:
   ```bash
   npx wrangler deploy
   ```
4. Copy URL Worker (dạng `https://anhngucan-worker.<subdomain>.workers.dev`), điền vào `VITE_WORKER_URL` ở GitHub repo secrets và file `.env` local của project chính.
