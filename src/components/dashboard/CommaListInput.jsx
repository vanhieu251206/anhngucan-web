import { useState, useEffect } from "react";

// Ô nhập danh sách — giữ text gõ dở ở state cục bộ, CHỈ chuyển thành mảng (trim + bỏ phần tử rỗng) khi rời ô
// (onBlur). Nếu parse lại thành mảng ngay trên mỗi phím gõ thì dấu ngăn/khoảng trắng vừa gõ ở cuối bị "nuốt" mất
// do value hiển thị lại bị derive từ mảng đã lọc rỗng. Dùng chung cho KetPetPracticeTestStudio và
// KetPetVocabularyStudio. `separator`: "," cho danh sách từ (khung từ, cột, từ xáo trộn); "|" cho ĐÁP ÁN nhiều
// cách viết (chốt 2026-10-02: mọi ô đáp án trên web đều ngăn bằng "|", dấu phẩy thuộc về câu trả lời).
export default function CommaListInput({ className = "admin-input", value, onChange, placeholder, separator = "," }) {
  const joiner = separator === "|" ? " | " : ", ";
  const [text, setText] = useState((value ?? []).join(joiner));
  useEffect(() => { setText((value ?? []).join(joiner)); }, [value, joiner]);
  return (
    <input
      className={className}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => onChange(text.split(separator).map(s => s.trim()).filter(Boolean))}
      placeholder={placeholder}
    />
  );
}
