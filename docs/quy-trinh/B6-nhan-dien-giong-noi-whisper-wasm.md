# B6 — Đổi sang nhận diện giọng nói chạy trong trình duyệt (Whisper WASM)

> Thay thế `SpeechRecognition` của trình duyệt (chỉ hoạt động tốt trên Chrome, không chạy được trên Safari/iOS — xem CLAUDE.md mục 2) bằng mô hình Whisper-tiny chạy ngay trong trình duyệt qua WASM, để Part 3/4 (luyện nói qua mic) chạy nhất quán trên MỌI nền tảng.

## Lý do & ràng buộc

- Dự án đã chốt: không backend, không API AI trả phí theo lượng dùng (CLAUDE.md mục 2).
- `window.SpeechRecognition`/`webkitSpeechRecognition` dựa vào engine của trình duyệt — trên iOS, MỌI trình duyệt (kể cả "Chrome") đều bắt buộc dùng chung WebKit của Safari (quy định Apple), mà Safari hỗ trợ tính năng này rất kém.
- Giải pháp: chạy mô hình nhận diện giọng nói **hoàn toàn ở phía client** bằng WASM (không qua server, không mất phí theo lượt) — dùng thư viện `@xenova/transformers` (transformers.js) với model `Xenova/whisper-tiny.en`.

## Thay đổi đã làm

- Cài `@xenova/transformers` (`npm install @xenova/transformers`).
- `src/lib/whisperSpeech.js` (mới):
  - `loadTranscriber(onProgress)` — tải & cache pipeline `automatic-speech-recognition` (model tải qua CDN Hugging Face, trình duyệt tự cache lại bằng Cache API/IndexedDB, chỉ tải lần đầu mỗi thiết bị).
  - `transcribeBlob(blob)` — decode audio Blob (ghi từ `MediaRecorder`) thành Float32Array 16kHz mono rồi chạy qua model, trả về text.
  - `isRecordingSupported()` — kiểm tra `getUserMedia` + `MediaRecorder` (hỗ trợ tốt trên Safari iOS, khác với `SpeechRecognition`).
- `src/components/SpeakingMode.jsx`:
  - Bỏ hẳn `SpeechRecognition` — giữ mic bằng `MediaRecorder` ghi âm khi bấm giữ, thả tay thì dừng ghi và gửi đi nhận diện qua `transcribeBlob`.
  - Thêm trạng thái "Đang tải mô hình..." (lần đầu vào bài) và "Đang nhận diện..." (sau khi thả tay, đợi model xử lý).
  - Logic so khớp từ khoá (`answer_keywords`) giữ nguyên như cũ, chỉ đổi nguồn lấy text nói.

## Đã kiểm tra

- Build (`npm run build`) thành công — có cảnh báo bundle to hơn (~1MB do `onnxruntime-web`) và cảnh báo `eval` từ chính thư viện `onnxruntime-web`, không phải lỗi.
- Test bằng Playwright (Chromium headless, giả lập mic bằng `--use-fake-device-for-media-stream`): model Whisper-tiny.en tải thành công, pipeline ghi âm → decode → nhận diện chạy hết không lỗi console, hiện đúng luồng "Đang tải mô hình" → "Đang nhận diện" → kết quả.
- **Chưa test bằng giọng nói thật của trẻ em** (test tự động chỉ dùng audio giả lập/tiếng bíp) — cần người dùng tự thử trên điện thoại thật (đặc biệt iPhone) để đánh giá độ chính xác nhận diện thực tế trước khi coi là ổn định.

## Việc còn theo dõi / rủi ro đã biết

- **Tải model lần đầu khá nặng** (model tiny.en ~40-75MB) — lần đầu vào bài trên mạng chậm có thể mất vài chục giây, cần thông báo rõ cho học sinh/phụ huynh (đã có dòng "Đang tải mô hình...").
- **Độ chính xác với giọng trẻ em nói tiếng Anh chưa được kiểm chứng thực tế** — whisper-tiny là model nhỏ nhất, ưu tiên tốc độ hơn độ chính xác; nếu nhận diện sai nhiều cần cân nhắc đổi sang `whisper-base` (chính xác hơn nhưng nặng hơn) — CHƯA tự ý đổi, cần thử nghiệm thực tế trước.
- Máy/điện thoại cũ có thể xử lý chậm (vài giây) mỗi lần nhận diện — chấp nhận được ở mức thử nghiệm, cần theo dõi phản hồi thực tế.
- Phụ thuộc mạng để tải model lần đầu (giống việc `SpeechRecognition` cũ cũng cần mạng qua Google) — không vi phạm ràng buộc "không tốn phí duy trì" vì CDN Hugging Face miễn phí, không tính theo lượt dùng.

## Lịch sử

- 2026-08-12: Thử nghiệm & triển khai đổi sang Whisper WASM chạy client-side thay `SpeechRecognition`, theo yêu cầu "chạy tốt trên mọi nền tảng". Đã test kỹ thuật qua Playwright, CHƯA test giọng nói thật.
