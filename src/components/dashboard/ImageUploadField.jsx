import { useRef, useState } from "react";
import { uploadToCloudinary } from "../../lib/cloudinaryUpload";
import { useAuth } from "../../lib/authContext.jsx";

// Dán URL có sẵn HOẶC bấm "Chọn file để upload" để đẩy thẳng lên Cloudinary (free, không thẻ) —
// thay cho Firebase Storage đã bỏ vì bắt buộc gói Blaze.
export default function ImageUploadField({ label, value, onChange }) {
  const { isAdmin } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadFile(file);
  }

  // Dán ảnh từ clipboard (Ctrl+V khi đang chọn ô này) — chỉ tài khoản admin — cùng đường upload Cloudinary như chọn file.
  function handlePaste(e) {
    if (!isAdmin) return;
    const item = Array.from(e.clipboardData?.items ?? []).find(it => it.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (!file) return;
    e.preventDefault();
    uploadFile(file);
  }

  async function uploadFile(file) {
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
    <div className="admin-upload-field" onPaste={handlePaste}>
      {label && <span className="admin-upload-label">{label}</span>}
      {value && <img src={value} alt="" className="admin-upload-preview-img" />}
      {isAdmin && (
        <div className="admin-paste-box" tabIndex={0} role="button" aria-label="Dán ảnh">
          {uploading ? "Đang tải lên..." : "📋 Bấm vào đây rồi Ctrl+V để dán ảnh"}
        </div>
      )}
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
