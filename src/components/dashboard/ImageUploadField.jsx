import { useRef, useState } from "react";
import { uploadToCloudinary } from "../../lib/cloudinaryUpload";

// Dán URL có sẵn HOẶC bấm "Chọn file để upload" để đẩy thẳng lên Cloudinary (free, không thẻ) —
// thay cho Firebase Storage đã bỏ vì bắt buộc gói Blaze.
export default function ImageUploadField({ label, value, onChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (err) {
      setError(err.message || "Upload thất bại");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-upload-field">
      {label && <span className="admin-upload-label">{label}</span>}
      {value && <img src={value} alt="" className="admin-upload-preview-img" />}
      <input
        className="admin-input"
        type="url"
        placeholder="Dán URL ảnh (vd link GitHub Pages/imgur...)"
        value={value ?? ""}
        onChange={e => onChange(e.target.value || null)}
      />
      <div className="admin-upload-actions">
        <button
          type="button"
          className="admin-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Đang tải lên..." : "Chọn file để upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFilePicked}
        />
      </div>
      {error && <span className="admin-upload-error">{error}</span>}
    </div>
  );
}
