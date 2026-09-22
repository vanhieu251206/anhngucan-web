import { useState } from "react";
import { splitFramedImages } from "../../lib/imageSplitter.js";

// CMS "Tách ảnh" — tải lên 1 ảnh chụp cả trang (nhiều ảnh khung viền đen trên nền trắng), tự động
// cắt sát từng ảnh khung theo đúng thứ tự đọc trong ảnh gốc (trên→dưới, trái→phải), xem
// src/lib/imageSplitter.js. Kết quả đặt tên 1..N để tải về dùng thẳng với "Tải ảnh hàng loạt"
// ở CMS Luyện đề Listening.
function downloadResult(r) {
  const a = document.createElement("a");
  a.href = r.dataUrl;
  a.download = `${r.index}.png`;
  a.click();
}

export default function ImageSplitterPage() {
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setResults([]);
    setProcessing(true);
    try {
      setResults(await splitFramedImages(file));
    } catch (err) {
      setError(err.message || "Không xử lý được ảnh.");
    } finally {
      setProcessing(false);
    }
  }

  async function downloadAll() {
    for (const r of results) {
      downloadResult(r);
      await new Promise(res => setTimeout(res, 150));
    }
  }

  return (
    <div className="admin-card">
      <h2>Tách ảnh</h2>
      <div className="admin-form">
        <label className="admin-pill-btn" style={{ cursor: processing ? "wait" : "pointer" }}>
          {processing ? "Đang xử lý..." : "📷 Chọn ảnh trang"}
          <input type="file" accept="image/*" hidden disabled={processing} onChange={handleFile} />
        </label>
        {error && <p className="admin-error">{error}</p>}
      </div>

      {results.length > 0 && (
        <>
          <div className="admin-form" style={{ marginTop: 16, alignItems: "center", gap: 12 }}>
            <span className="admin-scene-count-badge">{results.length} ảnh</span>
            <button type="button" className="admin-btn-primary" onClick={downloadAll}>Tải tất cả</button>
          </div>
          <div className="img-splitter-grid">
            {results.map(r => (
              <div className="img-splitter-item" key={r.index}>
                <span className="img-splitter-num">{r.index}</span>
                <img src={r.dataUrl} alt={`Ảnh ${r.index}`} />
                <button type="button" className="admin-link-btn" onClick={() => downloadResult(r)}>Tải</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
