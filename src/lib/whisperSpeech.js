import {
  AutoTokenizer,
  AutoProcessor,
  WhisperForConditionalGeneration,
  env,
  full,
} from "@huggingface/transformers";

// Model whisper-base.en TỰ HOST trong public/models/ (không tải qua CDN Hugging Face — tránh
// phụ thuộc tốc độ/khả năng truy cập CDN nước ngoài từ VN). ĐÃ THỬ small.en trước (chính xác
// hơn) nhưng decoder/encoder của small.en có file vượt quá giới hạn 100MB/file của GitHub (cần
// Git LFS — free tier chỉ 1GB băng thông/tháng, không đủ cho ~100 học sinh, xem CLAUDE.md mục 2)
// nên đổi xuống base.en để mọi file đều dưới 100MB, push thẳng lên repo bình thường.
// Dùng chung 1 bộ decoder quantized (int8) cho cả 2 nhánh thiết bị, chỉ khác encoder:
//  - encoder fp16 → dùng khi trình duyệt hỗ trợ WebGPU (chạy trên GPU máy/điện thoại, nhanh
//    hơn hẳn CPU — theo đúng cấu hình mẫu chính thức của Hugging Face cho Whisper + WebGPU, xem
//    transformers.js-examples/realtime-whisper-webgpu).
//  - encoder quantized (int8) → dùng khi KHÔNG có WebGPU (Safari cũ, webview trong app Zalo/FB,
//    Android đời thấp...), chạy CPU qua WASM — chậm hơn nhưng chạy được mọi nơi.
// Trình duyệt tự cache lại (Cache Storage của onnxruntime-web) nên chỉ tải 1 LẦN DUY NHẤT bộ
// đang dùng cho mỗi thiết bị, các lượt học sau gần như tức thì.
// allowLocalModels mặc định là false trong môi trường trình duyệt (xem @huggingface/transformers
// src/env.js) — PHẢI bật true vì đang tự host model local, không phải tải remote. Thiếu cờ này,
// bước "kiểm tra file có tồn tại" nội bộ của thư viện (get_file_metadata) luôn trả về false (bỏ
// qua kiểm tra local VÀ remote), khiến AutoTokenizer nhận danh sách file rỗng và crash với lỗi
// "undefined is not an object (evaluating '...tokenizer_class')" — đã gặp thực tế trên iPhone.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = `${import.meta.env.BASE_URL}models/`;

const MODEL_ID = "onnx-community/whisper-base.en";
const MAX_NEW_TOKENS = 64;

async function detectWebGpu() {
  if (typeof navigator === "undefined" || !navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

let piecesPromise = null;
let lastUsedDevice = null;

function loadPieces(onProgress) {
  if (!piecesPromise) {
    piecesPromise = (async () => {
      const useWebGpu = await detectWebGpu();
      lastUsedDevice = useWebGpu ? "webgpu" : "wasm";

      const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback: onProgress });
      const processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: onProgress });
      const model = await WhisperForConditionalGeneration.from_pretrained(MODEL_ID, {
        dtype: {
          encoder_model: useWebGpu ? "fp16" : "q8",
          decoder_model_merged: "q8",
        },
        device: useWebGpu ? "webgpu" : "wasm",
        progress_callback: onProgress,
      });

      if (useWebGpu) {
        // Chạy 1 lần với input rỗng để trình duyệt biên dịch sẵn shader WebGPU — tránh lần bấm
        // mic đầu tiên của học sinh bị "khựng" thêm vài giây do biên dịch shader lúc đó.
        await model.generate({ input_features: full([1, 80, 3000], 0.0), max_new_tokens: 1 });
      }

      return { tokenizer, processor, model };
    })().catch(err => {
      // Không cache lại lần tải LỖI — nếu không, mọi lần bấm mic sau sẽ lập tức fail theo lỗi
      // cũ mãi mãi (kể cả khi nguyên nhân chỉ là mạng chập chờn tạm thời lúc đó) thay vì được
      // thử tải lại. Chỉ cache khi tải THÀNH CÔNG.
      piecesPromise = null;
      throw err;
    });
  }
  return piecesPromise;
}

export function loadTranscriber(onProgress) {
  return loadPieces(onProgress);
}

async function blobToFloat32Audio(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  audioCtx.close();
  return rendered.getChannelData(0);
}

function withTimeout(promise, ms, message) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
  return Promise.race([promise, timeout]);
}

export async function transcribeBlob(blob, onProgress) {
  // Tách riêng thời gian chờ TẢI MODEL (có thể rất lâu ở lần đầu tiên trên mạng di động — model
  // ~90MB — nếu ModelPreloader chưa tải xong trước khi học sinh bấm mic) khỏi thời gian chờ NHẬN
  // DIỆN thực tế (nhanh, model đã sẵn trong bộ nhớ). Gộp chung 1 timeout ngắn trước đây khiến lần
  // bấm mic đầu tiên trên mạng chậm/4G dễ bị timeout oan dù model vẫn đang tải bình thường.
  const { tokenizer, processor, model } = await withTimeout(
    loadPieces(onProgress),
    120000,
    "model-load-timeout",
  );

  const work = (async () => {
    const audio = await blobToFloat32Audio(blob);
    // TẠM THỜI: đo biên độ lớn nhất của audio để phân biệt "ghi âm rỗng/im lặng thật" (biên độ
    // ~0, MediaRecorder không thu được gì) với "có tiếng nói nhưng Whisper nhận nhầm" (biên độ
    // bình thường) — đang debug lỗi Whisper trả về "..." dù đã nói rõ. Xoá debug object này sau
    // khi xác định xong nguyên nhân.
    let maxAbs = 0;
    for (let i = 0; i < audio.length; i++) {
      const v = Math.abs(audio[i]);
      if (v > maxAbs) maxAbs = v;
    }
    const inputs = await processor(audio);
    const outputs = await model.generate({ ...inputs, max_new_tokens: MAX_NEW_TOKENS });
    const [text] = tokenizer.batch_decode(outputs, { skip_special_tokens: true });
    return {
      text: (text || "").trim(),
      debug: {
        device: lastUsedDevice,
        blobBytes: blob.size,
        durationSec: Math.round((audio.length / 16000) * 100) / 100,
        maxAmplitude: Math.round(maxAbs * 1000) / 1000,
      },
    };
  })();

  // An toàn: đôi khi bị treo — không để nó chặn cả bài học, timeout thì coi như không nghe rõ.
  return withTimeout(work, 20000, "transcribe-timeout");
}

export function isRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}
