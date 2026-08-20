// Cloudflare Worker proxy cho Groq Whisper API (speech-to-text) — giữ GROQ_API_KEY bí mật phía
// server, trình duyệt học sinh không bao giờ thấy key. Đây là dịch vụ BaaS free tier (không cần
// thẻ tín dụng), xem CLAUDE.md mục 2. Free tier Groq: ~8 giờ audio/ngày, 20 request/phút — nếu
// vượt mức hoặc lỗi, frontend (src/lib/pronunciationApi.js) tự rớt xuống Whisper chạy local.
//
// CORS chỉ cho phép gọi từ domain GitHub Pages của app + localhost/LAN lúc test local (npm run
// dev -- --host, xem CLAUDE.md). Đổi/thêm origin nếu đổi domain deploy. Không có xác thực người
// gọi (học sinh là khách ẩn danh) — rủi ro bị lạm dụng đã được chấp nhận tương tự cơ chế mật khẩu
// hash client-side, giảm nhẹ bằng giới hạn CORS này.
const ALLOWED_ORIGINS = [
  "https://vanhieu251206.github.io",
  "https://localhost:5173",
];

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin) || /^https:\/\/192\.168\.\d+\.\d+:5173$/.test(origin);
}

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST" || !new URL(request.url).pathname.endsWith("/transcribe")) {
      return new Response("Not found", { status: 404, headers });
    }

    if (!env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "worker-not-configured" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    try {
      const incomingForm = await request.formData();
      const audio = incomingForm.get("audio");
      if (!audio) {
        return new Response(JSON.stringify({ error: "missing-audio" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const groqForm = new FormData();
      groqForm.append("file", audio, "audio.webm");
      groqForm.append("model", MODEL);
      groqForm.append("language", "en");
      groqForm.append("response_format", "json");

      const groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: groqForm,
      });

      if (!groqRes.ok) {
        const detail = await groqRes.text();
        return new Response(JSON.stringify({ error: "groq-error", detail }), {
          status: groqRes.status,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const data = await groqRes.json();
      return new Response(JSON.stringify({ text: data.text || "" }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "worker-exception", detail: String(err) }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  },
};
