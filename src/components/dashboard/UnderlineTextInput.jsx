import { useRef } from "react";

// Ô nhập 1 từ/cụm có thể gạch chân 1 phần: GV bôi đen (chọn) đoạn chữ trong ô rồi bấm nút "U" để bọc
// đoạn đó trong <u>...</u> — dùng cho dạng "pronunciation-underline" (Practice Test), nơi mỗi đáp án
// A/B/C/D cần gạch chân đúng chữ cái/âm tiết đang xét (VD ảnh đề: m_y_th → gạch chân "y"). Lưu trực
// tiếp chuỗi có tag <u> vào dữ liệu câu hỏi, hiển thị lại bằng UnderlineText.jsx (chỉ parse <u>, không
// dùng dangerouslySetInnerHTML nên an toàn).
export default function UnderlineTextInput({ value, onChange, placeholder }) {
  const ref = useRef(null);

  function toggleUnderline() {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start == null || end == null || start === end) return;
    const text = value ?? "";
    onChange(`${text.slice(0, start)}<u>${text.slice(start, end)}</u>${text.slice(end)}`);
  }

  return (
    <div className="admin-underline-input-row">
      <input
        ref={ref}
        className="admin-input"
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="admin-underline-btn"
        title="Bôi đen chữ cần gạch chân rồi bấm nút này"
        onMouseDown={e => e.preventDefault()}
        onClick={toggleUnderline}
      >
        <u>U</u>
      </button>
    </div>
  );
}
