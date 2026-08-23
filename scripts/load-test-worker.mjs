// Load test đơn giản cho Cloudflare Worker /transcribe (proxy AssemblyAI) — xem AUDIT 2026-08-23,
// mục P0 "chưa load-test đường Speech-to-text". Mô phỏng N học sinh bấm mic gần như cùng lúc
// bằng cách bắn N request đồng thời tới Worker, đo tỉ lệ lỗi + độ trễ p50/p95.
//
// Cách dùng:
//   node scripts/load-test-worker.mjs <WORKER_URL> <SAMPLE_AUDIO_PATH> [CONCURRENCY]
//
// Ví dụ:
//   node scripts/load-test-worker.mjs https://anhngucan-speech-worker.xxx.workers.dev/transcribe ./sample.webm 50
//
// SAMPLE_AUDIO_PATH: 1 file audio ngắn (~3-5 giây, định dạng webm/mp3/wav đều được — AssemblyAI
// tự nhận diện) — có thể tự ghi âm 1 câu mẫu bằng điện thoại rồi copy vào máy để test.
//
// LƯU Ý: script này gọi THẬT tới AssemblyAI qua Worker — mỗi lần chạy tốn hạn mức free tier
// (185 giờ audio) tương ứng với tổng thời lượng audio × số request. Với file mẫu 5 giây × 50
// request ≈ 4 phút audio, không đáng kể so với 185 giờ — nhưng đừng chạy lặp lại nhiều lần liên
// tục không cần thiết.

import { readFile } from "node:fs/promises";

const [, , workerUrl, audioPath, concurrencyArg] = process.argv;

if (!workerUrl || !audioPath) {
  console.error("Cách dùng: node scripts/load-test-worker.mjs <WORKER_URL> <SAMPLE_AUDIO_PATH> [CONCURRENCY]");
  process.exit(1);
}

const concurrency = Number(concurrencyArg) || 20;

async function sendOne(audioBuffer, index) {
  const form = new FormData();
  form.append("audio", new Blob([audioBuffer]), "sample.webm");

  const start = Date.now();
  try {
    const res = await fetch(workerUrl, { method: "POST", body: form });
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    return { index, ok: res.ok, status: res.status, elapsed, error: res.ok ? null : body.error };
  } catch (err) {
    return { index, ok: false, status: 0, elapsed: Date.now() - start, error: String(err) };
  }
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return sortedArr[idx];
}

const audioBuffer = await readFile(audioPath);

console.log(`Bắn ${concurrency} request đồng thời tới ${workerUrl} ...`);
const startAll = Date.now();
const results = await Promise.all(
  Array.from({ length: concurrency }, (_, i) => sendOne(audioBuffer, i))
);
const totalElapsed = Date.now() - startAll;

const ok = results.filter(r => r.ok);
const failed = results.filter(r => !r.ok);
const latencies = ok.map(r => r.elapsed).sort((a, b) => a - b);

console.log("\n=== KẾT QUẢ ===");
console.log(`Tổng thời gian chạy cả batch: ${(totalElapsed / 1000).toFixed(1)}s`);
console.log(`Thành công: ${ok.length}/${concurrency}`);
console.log(`Thất bại:   ${failed.length}/${concurrency}`);
if (latencies.length) {
  console.log(`Độ trễ p50: ${percentile(latencies, 50)}ms`);
  console.log(`Độ trễ p95: ${percentile(latencies, 95)}ms`);
  console.log(`Độ trễ max: ${latencies[latencies.length - 1]}ms`);
}
if (failed.length) {
  console.log("\nChi tiết lỗi (tối đa 10 dòng đầu):");
  for (const r of failed.slice(0, 10)) {
    console.log(`  #${r.index}: status=${r.status} error=${r.error}`);
  }
}

console.log(
  failed.length === 0
    ? "\n✅ Tất cả request thành công — Worker/AssemblyAI chịu được mức tải này."
    : `\n⚠️ Có ${failed.length} request thất bại — cân nhắc giảm số học sinh bấm mic cùng lúc hoặc kiểm tra hạn mức concurrency AssemblyAI.`
);
