import { useUploadsPending } from "../../lib/cloudinaryUpload.js";

// Nút "＋ Chèn câu" đặt GIỮA các câu/nhóm trong trang soạn (2026-09-30) — soạn gần xong thấy thiếu 1 câu ở giữa thì
// chèn thẳng vào đúng chỗ, không phải xoá làm lại. Số thứ tự câu phía sau tự nhảy vì đánh số theo vị trí.
// as="li" khi đặt trong <ol>/<ul>.
// Khoá khi còn file đang tải lên: link ảnh/audio tải xong được ghi theo VỊ TRÍ câu, chèn câu lúc đó sẽ ghi nhầm câu.
export default function InsertRow({ label = "＋ Chèn câu vào đây", onClick, as: Tag = "div" }) {
  const uploading = useUploadsPending() > 0;
  return (
    <Tag className="admin-insert-row">
      <button type="button" className="admin-insert-btn" onClick={onClick} disabled={uploading} title={uploading ? "Đợi file tải xong" : undefined}>{label}</button>
    </Tag>
  );
}

export function insertAt(list, index, item) {
  const next = [...(list ?? [])];
  next.splice(index, 0, item);
  return next;
}

export function moveAt(list, index, dir) {
  const j = index + dir;
  if (j < 0 || j >= (list ?? []).length) return list;
  const next = [...list];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}
