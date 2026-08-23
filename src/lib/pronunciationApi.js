// Engine nhận diện giọng nói: gọi Cloudflare Worker (worker/) proxy AssemblyAI Speech-to-Text API
// — Worker giữ API key bí mật, trình duyệt không bao giờ thấy key. Free tier AssemblyAI (185 giờ
// audio batch, không cần thẻ tín dụng) đủ dùng lâu dài cho quy mô ~100 học sinh (xem CLAUDE.md
// mục 2). Đã chuyển từ Groq sang AssemblyAI (2026-08-22) vì Groq tạm khoá nâng cấp gói trả phí và
// giới hạn free 20 request/phút không đủ cho lớp đông cùng lúc.
//
// AssemblyAI xử lý BẤT ĐỒNG BỘ (Worker phải poll kết quả) nên chậm hơn Groq đáng kể — timeout
// client dài hơn để chờ đủ thời gian Worker poll xong (xem POLL_INTERVAL_MS/MAX_POLL_ATTEMPTS
// trong worker/src/index.js).
//
// KHÔNG còn dự phòng Whisper local (đã bỏ theo yêu cầu người dùng) — nếu Worker chưa cấu hình
// hoặc gọi lỗi, tự thử lại 2 lần với lỗi tạm thời (mất mạng/timeout/Worker quá tải) trước khi báo
// lỗi thẳng cho học sinh.

const WORKER_URL = import.meta.env.VITE_WORKER_URL;

const MAX_ATTEMPTS = 3; // 1 lần gọi gốc + 2 lần thử lại
const RETRY_DELAY_MS = 1000;
// PHẢI dài hơn mốc chờ MAX_POLL_ATTEMPTS×POLL_INTERVAL_MS của Worker (~31.5s, xem
// worker/src/index.js) + thời gian upload/create trước khi vào vòng poll, nếu không client tự bỏ
// cuộc trước cả khi Worker kịp trả lỗi 504 rõ ràng — nâng cùng đợt với Worker sau load test thật
// 2026-08-23 (50-100 users đồng thời cho thấy request thành công có độ trễ tới ~24-25s).
const FETCH_TIMEOUT_MS = 40000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Lỗi TẠM THỜI (đáng thử lại): mất mạng (TypeError của fetch), hết timeout (AbortError), hoặc
// Worker/Groq báo lỗi phía server (5xx) hay quá tải (429). KHÔNG thử lại lỗi 4xx khác (audio hỏng,
// request sai định dạng...) vì thử lại cũng sẽ lỗi y hệt.
function isRetryableError(err) {
  if (err?.name === "AbortError") return true;
  if (err instanceof TypeError) return true; // fetch network failure
  const match = /^worker-error-(\d+)$/.exec(err?.message || "");
  if (match) {
    const status = Number(match[1]);
    return status === 429 || status >= 500;
  }
  return false;
}

async function transcribeViaWorker(blob) {
  const form = new FormData();
  form.append("audio", blob, "audio.webm");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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
  if (!WORKER_URL) {
    throw new Error("worker-not-configured");
  }

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const text = await transcribeViaWorker(blob);
      return { text, accuracyScore: null, debug: { device: "assemblyai-worker", attempt } };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isRetryableError(err)) {
        await sleep(RETRY_DELAY_MS * attempt); // 1s, 2s — nới dần
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

// Gộp lỗi kỹ thuật thành thông báo dễ hiểu cho học sinh/giáo viên — dùng chung ở mọi nơi gọi
// assessPronunciation() (SceneRunner.jsx, SpeakingMode.jsx) để nhất quán.
export function describePronunciationError(err) {
  const message = err?.message || "";
  if (message === "worker-not-configured") {
    return "Tính năng nhận diện giọng nói chưa được cấu hình, báo cho giáo viên nhé!";
  }
  if (err?.name === "AbortError" || err instanceof TypeError) {
    return "Mất kết nối mạng, kiểm tra Wi-Fi/4G rồi thử lại nhé!";
  }
  const match = /^worker-error-(\d+)$/.exec(message);
  if (match) {
    const status = Number(match[1]);
    if (status === 429 || status >= 500) {
      return "Hệ thống đang quá tải, đợi một chút rồi thử lại nhé!";
    }
  }
  return "Không nghe rõ, thử bấm mic nói lại lần nữa nhé!";
}
