import { pipeline, env } from "@xenova/transformers";

// Không dùng model local trong repo (nặng, có bản quyền riêng) — tải qua CDN của Hugging Face,
// trình duyệt tự cache lại (IndexedDB) nên chỉ tải 1 lần cho mỗi thiết bị.
env.allowLocalModels = false;

let transcriberPromise = null;

export function loadTranscriber(onProgress) {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      progress_callback: onProgress,
    });
  }
  return transcriberPromise;
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

export async function transcribeBlob(blob, onProgress) {
  const transcriber = await loadTranscriber(onProgress);
  const audio = await blobToFloat32Audio(blob);
  const result = await transcriber(audio);
  return (result.text || "").trim();
}

export function isRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}
