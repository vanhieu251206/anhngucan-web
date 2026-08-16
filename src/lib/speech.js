// Theo dõi audio đang phát để luôn dừng cái cũ trước khi phát cái mới — tránh chồng tiếng
// (đã gặp: React StrictMode ở môi trường dev chạy useEffect 2 lần, gọi playLine() 2 lần liên
// tiếp cho cùng 1 câu mà không cái nào bị huỷ, tiếng bị đè lên nhau).
let currentAudio = null;

export function isRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

export function stopCurrent() {
  if (currentAudio) {
    // Đánh dấu instance này bị chủ động dừng (không phải lỗi file) — để play().catch() của
    // chính nó không báo nhầm thành "thiếu audio" khi promise play() bị reject do pause().
    currentAudio.__stopped = true;
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
}

// CHỐT: dự án KHÔNG dùng giọng đọc máy (browser TTS) nữa — chỉ phát file audio thật do người
// dùng cung cấp. Thiếu file thì báo rõ ra console (và người dùng cần cung cấp bổ sung), KHÔNG
// được tự ý phát giọng máy thay thế.
export function playLine(text, { audioUrl, onEnd } = {}) {
  stopCurrent();

  if (!audioUrl) {
    console.warn(`[audio] Thiếu file audio cho câu: "${text}" — cần cung cấp file voice thật.`);
    onEnd?.();
    return;
  }

  let done = false;
  function finish() {
    if (done) return;
    done = true;
    if (currentAudio === audio) currentAudio = null;
    onEnd?.();
  }
  function missing(reason) {
    if (done || audio.__stopped) return; // bị chủ động dừng (scene đổi/StrictMode) — không phải lỗi thật
    console.warn(`[audio] Không phát được file audio cho câu: "${text}" (${audioUrl}) — ${reason}. Cần cung cấp/kiểm tra lại file voice thật.`);
    finish();
  }

  const audio = new Audio(audioUrl);
  currentAudio = audio;
  audio.onended = finish;
  audio.onerror = () => missing("file lỗi/không tải được");
  audio.play().catch(err => missing(err?.message || "không phát được"));

  // Timeout dự phòng, phòng khi audio không bắn onended (file lỗi im lặng...) — không để treo vĩnh viễn.
  setTimeout(finish, 15000);
}

export function normalize(str) {
  return str.toLowerCase().replace(/[.,!?]/g, "").trim();
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Chấm "gần đúng": trẻ nhỏ phát âm chưa chuẩn + Whisper nhận diện sai lệch 1-2 ký tự là bình
// thường (vd "yellow" nghe thành "yelo"/"jello") — so từng từ trong câu nói với từ khoá đáp án,
// chấp nhận nếu đủ gần (ngưỡng nới theo độ dài từ khoá) thay vì phải khớp tuyệt đối.
export function fuzzyIncludesWord(text, keyword) {
  const words = text.split(/\s+/).filter(Boolean);
  const threshold = keyword.length <= 4 ? 1 : keyword.length <= 7 ? 2 : 3;
  return words.some(w => levenshtein(w, keyword) <= threshold);
}
