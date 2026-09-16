import { useState, useEffect } from "react";

// Ô nhập danh sách cách nhau bằng dấu phẩy (word bank / đáp án chấp nhận nhiều cách viết) — giữ text
// gõ dở ở state cục bộ, CHỈ chuyển thành mảng (trim + bỏ phần tử rỗng) khi rời ô (onBlur). Nếu parse
// lại thành mảng ngay trên mỗi phím gõ thì dấu phẩy/khoảng trắng vừa gõ ở cuối bị "nuốt" mất do
// value hiển thị lại bị derive từ mảng đã lọc rỗng. Dùng chung cho KetPetPracticeTestStudio và
// KetPetVocabularyStudio.
export default function CommaListInput({ className = "admin-input", value, onChange, placeholder }) {
  const [text, setText] = useState((value ?? []).join(", "));
  useEffect(() => { setText((value ?? []).join(", ")); }, [value]);
  return (
    <input
      className={className}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => onChange(text.split(",").map(s => s.trim()).filter(Boolean))}
      placeholder={placeholder}
    />
  );
}
