// Gọi Cloudflare Worker (worker/) để chấm phát âm qua Azure AI Speech — Worker giữ key Azure
// bí mật, trình duyệt không bao giờ thấy key. Đây là engine nhận diện giọng nói DUY NHẤT của
// app (không còn Whisper WASM fallback) — nếu VITE_WORKER_URL chưa cấu hình hoặc request lỗi,
// nơi gọi báo lỗi rõ cho học sinh thay vì âm thầm rớt xuống engine khác.
const WORKER_URL = import.meta.env.VITE_WORKER_URL;

export async function assessPronunciation(blob, expectedText) {
  if (!WORKER_URL) throw new Error("worker-not-configured");

  const form = new FormData();
  form.append("audio", blob, "audio.webm");
  form.append("expectedText", expectedText || "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${WORKER_URL}/pronunciation`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`worker-error-${res.status}`);
    const data = await res.json();
    return {
      text: data.text || "",
      accuracyScore: data.accuracyScore ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
