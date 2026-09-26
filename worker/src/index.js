// Cloudflare Worker proxy cho AssemblyAI Speech-to-Text API — giữ ASSEMBLYAI_API_KEY bí mật phía
// server, trình duyệt học sinh không bao giờ thấy key. Free tier AssemblyAI: 185 giờ audio batch,
// không cần thẻ tín dụng (xem CLAUDE.md mục 2). Đã chuyển từ Groq sang AssemblyAI (2026-08-22) vì
// Groq tạm khoá nâng cấp gói trả phí (Developer tier) trong lúc giới hạn free 20 request/phút của
// Groq không đủ cho lớp học đông. AssemblyAI đắt hơn Groq ~4-5 lần mỗi giờ audio nhưng free tier
// (185 giờ) đủ dùng lâu dài ở quy mô ~100 học sinh, không cần thẻ tín dụng để bắt đầu.
//
// KHÔNG còn dự phòng Whisper local (đã bỏ trước đó) — nếu Worker/AssemblyAI lỗi, frontend
// (src/lib/pronunciationApi.js) tự thử lại vài lần rồi báo lỗi thẳng cho học sinh.
//
// CORS chỉ cho phép gọi từ domain GitHub Pages của app + localhost/LAN lúc test local (npm run
// dev -- --host, xem CLAUDE.md). Đổi/thêm origin nếu đổi domain deploy. CORS chỉ chặn được trình
// duyệt, không chặn được script gọi thẳng — nên /transcribe BẮT BUỘC Firebase ID token của tài khoản
// đã đăng nhập + giới hạn số lượt/phút theo tài khoản (audit bảo mật 2026-09-25: trước đó ai biết URL
// cũng đốt được hạn mức AssemblyAI, mà hết free tier là tốn tiền thật).
import { deleteStudent, deleteTeacher, firebaseProjectId, verifyIdToken } from "./admin.js";
import { startTest, submitTest } from "./submit.js";

// anhngucan.com: tên miền riêng của GitHub Pages (public/CNAME, từ 2026-09-18) — thiếu mục này làm ghi âm Speaking
// và xoá học sinh bị trình duyệt chặn CORS trên web thật (phát hiện 2026-09-25).
const ALLOWED_ORIGINS = ["https://anhngucan.com", "https://www.anhngucan.com", "https://vanhieu251206.github.io"];

// Vite tự bump cổng (5173, 5174, 5175...) nếu cổng trước đó đang bận (vd nhiều phiên dev server
// chạy song song) — chốt cứng 1 cổng từng gây lỗi CORS thật khi dev server không chạy đúng ở 5173
// (phát hiện 2026-08-23). Cho phép cả dải cổng dev quen dùng (5173-5179) thay vì chỉ đúng 1 cổng.
function isAllowedOrigin(origin) {
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/localhost:517[3-9]$/.test(origin) ||
    /^https:\/\/192\.168\.\d+\.\d+:517[3-9]$/.test(origin)
  );
}

const ASSEMBLYAI_UPLOAD_URL = "https://api.assemblyai.com/v2/upload";
const ASSEMBLYAI_TRANSCRIPT_URL = "https://api.assemblyai.com/v2/transcript";

// Audio ghi âm câu trả lời của trẻ nhỏ rất ngắn (thường vài giây) nên AssemblyAI thường xử lý
// xong trong vài giây khi ít người dùng cùng lúc — nhưng vẫn cần giới hạn để Worker không treo
// vô thời hạn nếu AssemblyAI chậm bất thường. Client (pronunciationApi.js) có timeout riêng dài
// hơn mốc này.
//
// NÂNG TỪ 25→45 (2026-08-23) sau load test thật: ở 50-100 học sinh bấm mic cùng lúc, AssemblyAI
// VẪN xử lý xong (request thành công đo được tới ~24-25s) nhưng Worker bỏ cuộc ở mốc 17.5s cũ —
// tức phần lớn lỗi 504 trước đây là Worker bỏ cuộc quá sớm, không phải AssemblyAI từ chối. Chờ
// dư dả để tận dụng đúng công suất AssemblyAI thay vì báo lỗi giả — không tốn thêm hạn mức free
// tier (chỉ đợi lâu hơn, không gọi thêm request). Cloudflare Worker free tier tính CPU time
// (không tính thời gian chờ I/O như polling này) nên kéo dài thời gian chờ không phát sinh phí.
const POLL_INTERVAL_MS = 700;
const MAX_POLL_ATTEMPTS = 45; // ~31.5 giây
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB — dư sức cho vài giây audio ghi âm trẻ nhỏ

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonError(headers, error, status, detail) {
  return new Response(JSON.stringify({ error, ...(detail ? { detail } : {}) }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function transcribeViaAssemblyAI(audioBlob, apiKey) {
  // 1. Upload audio thô lên AssemblyAI, nhận về upload_url tạm thời.
  const uploadRes = await fetch(ASSEMBLYAI_UPLOAD_URL, {
    method: "POST",
    headers: { authorization: apiKey },
    body: audioBlob,
  });
  if (!uploadRes.ok) {
    throw { status: uploadRes.status, error: "assemblyai-upload-error", detail: await uploadRes.text() };
  }
  const { upload_url } = await uploadRes.json();

  // 2. Tạo job phiên âm cho file vừa upload — chỉ tiếng Anh (dự án chỉ luyện tiếng Anh).
  // speech_models là danh sách ƯU TIÊN (không phải chạy song song): thử universal-3-5-pro trước
  // (model mới nhất, giá $0.21/giờ — đúng model đã tính giá), rớt xuống universal-2 ($0.15/giờ)
  // nếu universal-3-5-pro chưa khả dụng cho tài khoản. KHÔNG bỏ trống field này — nếu bỏ trống,
  // AssemblyAI tự mặc định dùng universal-3-pro (model CŨ hơn, không phải model đã lên kế hoạch).
  const createRes = await fetch(ASSEMBLYAI_TRANSCRIPT_URL, {
    method: "POST",
    headers: { authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_url: upload_url,
      language_code: "en",
      speech_models: ["universal-3-5-pro", "universal-2"],
    }),
  });
  if (!createRes.ok) {
    throw { status: createRes.status, error: "assemblyai-create-error", detail: await createRes.text() };
  }
  const { id } = await createRes.json();

  // 3. Poll cho tới khi có kết quả (AssemblyAI xử lý bất đồng bộ, không trả kết quả ngay).
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await fetch(`${ASSEMBLYAI_TRANSCRIPT_URL}/${id}`, {
      headers: { authorization: apiKey },
    });
    if (!pollRes.ok) {
      throw { status: pollRes.status, error: "assemblyai-poll-error", detail: await pollRes.text() };
    }
    const data = await pollRes.json();
    if (data.status === "completed") {
      return data.text || "";
    }
    if (data.status === "error") {
      throw { status: 502, error: "assemblyai-transcript-error", detail: data.error };
    }
    // status "queued" hoặc "processing" — thử lại vòng sau.
  }
  throw { status: 504, error: "assemblyai-timeout" };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Bắt đầu / nộp bài qua máy chủ (xem submit.js) — học sinh không tự ghi kết quả/số lượt vào Firestore nữa.
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && (path.endsWith("/test/start") || path.endsWith("/test/submit"))) {
      try {
        const handler = path.endsWith("/test/start") ? startTest : submitTest;
        return new Response(JSON.stringify(await handler(request, env)), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      } catch (err) {
        if (err && err.error) return jsonError(headers, err.error, err.status || 500);
        console.error(err);
        return jsonError(headers, "worker-exception", 500);
      }
    }

    // Xoá hẳn tài khoản học sinh (xem admin.js) — cần Firebase ID token của admin/giáo viên chính.
    if (request.method === "POST" && new URL(request.url).pathname.endsWith("/admin/delete-student")) {
      try {
        return new Response(JSON.stringify(await deleteStudent(request, env)), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      } catch (err) {
        if (err && err.error) return jsonError(headers, err.error, err.status || 500);
        console.error(err);
        return jsonError(headers, "worker-exception", 500);
      }
    }

    // Xoá hẳn tài khoản giáo viên (admin: mọi giáo viên; giáo viên chính: chỉ giáo viên phụ) — xem admin.js.
    if (request.method === "POST" && new URL(request.url).pathname.endsWith("/admin/delete-teacher")) {
      try {
        return new Response(JSON.stringify(await deleteTeacher(request, env)), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      } catch (err) {
        if (err && err.error) return jsonError(headers, err.error, err.status || 500);
        console.error(err);
        return jsonError(headers, "worker-exception", 500);
      }
    }

    if (request.method !== "POST" || !new URL(request.url).pathname.endsWith("/transcribe")) {
      return new Response("Not found", { status: 404, headers });
    }

    if (!env.ASSEMBLYAI_API_KEY) {
      return jsonError(headers, "worker-not-configured", 500);
    }

    try {
      const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const uid = await verifyIdToken(idToken, firebaseProjectId(env));
      // Binding TRANSCRIBE_LIMITER khai báo trong wrangler.toml — thiếu binding thì bỏ qua giới hạn thay vì chặn hẳn.
      if (env.TRANSCRIBE_LIMITER) {
        const { success } = await env.TRANSCRIBE_LIMITER.limit({ key: uid });
        if (!success) return jsonError(headers, "rate-limited", 429);
      }

      const incomingForm = await request.formData();
      const audio = incomingForm.get("audio");
      if (!audio) {
        return jsonError(headers, "missing-audio", 400);
      }
      // Câu trả lời của học sinh chỉ vài giây — chặn file bất thường lớn (lỗi client hoặc lạm
      // dụng endpoint không xác thực) để không tốn oan hạn mức free tier AssemblyAI (xem audit
      // Phase 4/mục 11, khuyến nghị P1 #5).
      if (audio.size > MAX_AUDIO_BYTES) {
        return jsonError(headers, "audio-too-large", 413);
      }

      const text = await transcribeViaAssemblyAI(audio, env.ASSEMBLYAI_API_KEY);
      return new Response(JSON.stringify({ text }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    } catch (err) {
      if (err && err.error) {
        if (err.detail) console.error(err.error, err.detail);
        return jsonError(headers, err.error, err.status || 500);
      }
      console.error(err);
      return jsonError(headers, "worker-exception", 500);
    }
  },
};
