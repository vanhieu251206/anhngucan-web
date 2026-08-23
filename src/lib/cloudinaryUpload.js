// Upload ảnh/audio trực tiếp từ trình duyệt lên Cloudinary (free tier, KHÔNG cần thẻ thanh toán —
// thay cho Firebase Storage đã bỏ vì bắt buộc gói Blaze). Dùng "unsigned upload preset" nên
// KHÔNG cần API secret ở client (an toàn để lộ cloud name + preset name công khai, đúng cách
// Cloudinary khuyến nghị cho use-case upload từ trình duyệt không qua server).
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Chỉ admin/teacher dùng CMS này, nhưng preset "unsigned" nghĩa là bất kỳ ai biết cloud name +
// preset (lộ công khai trong bundle JS, đúng thiết kế) đều gọi thẳng được Cloudinary API mà
// không qua UI này — chặn cứng type/size ở phía Cloudinary Console (Upload preset → giới hạn
// định dạng/kích thước) mới thật sự an toàn. Check ở đây chỉ để chặn sớm lỗi gõ nhầm/kéo nhầm
// file trong CMS, giảm bớt request thừa tốn băng thông free tier — KHÔNG phải access control.
const MAX_FILE_SIZE_MB = 20;
const ALLOWED_TYPE_PREFIXES = ["image/", "audio/"];

// resource_type "auto" — Cloudinary tự nhận diện ảnh/audio/video, dùng chung 1 endpoint cho
// cả ImageUploadField lẫn AudioUploadField, không cần phân biệt.
export async function uploadToCloudinary(file) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Chưa cấu hình VITE_CLOUDINARY_CLOUD_NAME/VITE_CLOUDINARY_UPLOAD_PRESET trong .env");
  }
  if (!ALLOWED_TYPE_PREFIXES.some(prefix => file.type.startsWith(prefix))) {
    throw new Error("Chỉ chấp nhận file ảnh hoặc audio");
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File quá lớn (tối đa ${MAX_FILE_SIZE_MB}MB)`);
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Upload Cloudinary thất bại");
  const data = await res.json();
  return data.secure_url;
}
