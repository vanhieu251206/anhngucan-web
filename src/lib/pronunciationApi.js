// Engine nhận diện giọng nói CHÍNH: gọi Cloudflare Worker (worker/) proxy Groq Whisper API
// (large-v3-turbo, chính xác + nhanh hơn Whisper local đáng kể) — Worker giữ API key bí mật,
// trình duyệt không bao giờ thấy key. Free tier Groq (~8 giờ audio/ngày, không thẻ tín dụng) đủ
// dùng cho quy mô ~100 học sinh của dự án (xem CLAUDE.md mục 2).
//
// DỰ PHÒNG: nếu chưa deploy Worker (`VITE_WORKER_URL` trống) hoặc gọi lỗi (mất mạng, Worker lỗi,
// hết hạn mức free tier Groq trong ngày...), tự động rớt xuống Whisper chạy local trong trình
// duyệt (src/lib/whisperSpeech.js) — học sinh vẫn dùng được mic, chỉ độ chính xác giảm tạm thời
// thay vì báo lỗi hẳn. Đây là điểm khác với thiết kế trước đây (Azure Speech) — lúc đó KHÔNG có
// fallback, người dùng chủ động yêu cầu vậy để không phụ thuộc hoàn toàn vào dịch vụ ngoài.
import { transcribeBlob } from "./whisperSpeech.js";

const WORKER_URL = import.meta.env.VITE_WORKER_URL;

async function transcribeViaWorker(blob) {
  const form = new FormData();
  form.append("audio", blob, "audio.webm");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${WORKER_URL}/transcribe`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`worker-error-${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return (data.text || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

export async function assessPronunciation(blob, expectedText) {
  if (WORKER_URL) {
    try {
      const text = await transcribeViaWorker(blob);
      return { text, accuracyScore: null, debug: { device: "groq-worker" } };
    } catch {
      // Rớt xuống Whisper local — xem comment đầu file.
    }
  }

  const { text, debug } = await transcribeBlob(blob);
  return { text, accuracyScore: null, debug };
}
