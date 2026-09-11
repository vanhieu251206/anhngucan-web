import { useState } from "react";
import { createWorker } from "tesseract.js";

// Nút "Tải ảnh trang sách (OCR)" — nhận diện chữ trong ảnh ngay trong trình duyệt (tesseract.js,
// chạy hoàn toàn client-side, không gửi ảnh lên Cloudinary/server nào, không cần API key trả phí —
// đúng tinh thần "không tốn phí duy trì" của dự án, xem CLAUDE.md mục 2). Ảnh chỉ tồn tại tạm trong
// bộ nhớ trình duyệt lúc xử lý rồi bỏ, không lưu lại ở đâu. Trả chữ nhận diện được ra ngoài qua
// `onText` để nơi gọi tự tách đoạn văn/câu hỏi — giáo viên luôn xem lại/sửa trước khi Xuất bản.
export default function OcrImportPanel({ label, onText }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress(0);
    let worker;
    try {
      worker = await createWorker("eng", 1, {
        logger: m => {
          if (m.status === "recognizing text") setProgress(Math.round((m.progress ?? 0) * 100));
        },
      });
      const { data } = await worker.recognize(file);
      onText(data.text ?? "");
    } catch (err) {
      setError(err.message || "Nhận diện chữ thất bại — thử lại với ảnh rõ nét/thẳng hơn.");
    } finally {
      if (worker) await worker.terminate();
      setBusy(false);
    }
  }

  return (
    <div className="admin-ocr-panel">
      <label className={`admin-btn-secondary admin-ocr-btn${busy ? " is-busy" : ""}`}>
        {busy ? `Đang nhận diện chữ... ${progress}%` : label ?? "📷 Tải ảnh trang sách (OCR)"}
        <input type="file" accept="image/*" hidden onChange={handleFile} disabled={busy} />
      </label>
      {error && <p className="admin-upload-error">{error}</p>}
    </div>
  );
}
