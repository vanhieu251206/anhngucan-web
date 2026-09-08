import { useRef, useState } from "react";
import { uploadToCloudinary } from "../../lib/cloudinaryUpload";

// Cùng cơ chế với ImageUploadField.jsx — dán URL có sẵn hoặc upload trực tiếp qua Cloudinary.
export default function AudioUploadField({ label, value, onChange }) {
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
    <div className="admin-upload-field admin-audio-upload-field">
      {label && <span className="admin-upload-label">{label}</span>}
      {value && <audio src={value} controls className="admin-upload-preview-audio" />}
      <div className="admin-audio-input-row">
        <input
          className="admin-input admin-audio-input"
          type="url"
          placeholder="Dán URL audio (.mp3...)"
          value={value ?? ""}
          onChange={e => onChange(e.target.value || null)}
        />
        <button
          type="button"
          className="admin-audio-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Chọn file để upload"
        >
          {uploading ? "…" : "📁 Chọn file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={handleFilePicked}
        />
      </div>
      {error && <span className="admin-upload-error">{error}</span>}
    </div>
  );
}
