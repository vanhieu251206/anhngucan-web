// Engine nhận diện giọng nói DUY NHẤT của app: Whisper (small.en) chạy hoàn toàn client-side
// qua @xenova/transformers, model tự host trong public/models/ (xem src/lib/whisperSpeech.js).
// Miễn phí 100%, không cần tài khoản/thẻ tín dụng, không có server nào nhận được audio của học
// sinh. Đổi lại: không có điểm accuracyScore chuẩn hoá — nơi gọi tự so khớp từ khoá
// bằng fuzzyIncludesWord() (src/lib/speech.js) trên text trả về.
import { transcribeBlob } from "./whisperSpeech.js";

export async function assessPronunciation(blob, expectedText) {
  const text = await transcribeBlob(blob);
  return { text, accuracyScore: null };
}
