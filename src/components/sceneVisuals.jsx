import { useRef } from "react";
import { useFitBoxSize } from "../lib/useFitBoxSize.js";

// Thành phần hiển thị THUẦN TUÝ dùng chung giữa SceneRunner.jsx (chạy bài thật cho học sinh)
// và ScenePreview.jsx (xem trước trực tiếp trong CMS "Tạo bài") — để màn soạn bài nhìn Y HỆT
// màn học sinh sẽ thấy, không phải 2 bộ giao diện khác nhau.
export const BEE = `${import.meta.env.BASE_URL}assets/img/mascot/bee.png`;
export const MIC_ICON = `${import.meta.env.BASE_URL}assets/img/icons/mic.png`;

// Tỉ lệ gốc ảnh Scene chuẩn của dự án (16:9, đổi từ 4:3 ngày 2026-08-15) — dùng làm mặc định
// cho SceneStage khi không truyền `ratio` riêng (vd CMS đo tỉ lệ thật của ảnh admin dán vào,
// có thể khác 16:9).
export const SCENE_RATIO = 16 / 9;

export function ExaminerLine({ text }) {
  return (
    <div className="examiner-line">
      <img className="examiner-bee" src={BEE} alt="Giám khảo" />
      <div className="sentence-text">{text}</div>
    </div>
  );
}

// Khung bọc ảnh Scene, giữ đúng tỉ lệ ảnh thật nhờ useFitBoxSize (ResizeObserver, KHÔNG dùng CSS
// aspect-ratio — xem docs/quy-trinh/LOI-DA-GAP.md mục 7) để toạ độ % không bao giờ lệch, dù ở
// màn học sinh hay màn soạn bài.
export function SceneStage({ ratio = SCENE_RATIO, extraClassName = "", onClick, innerRef, cursor, children }) {
  const stageRef = useRef(null);
  const size = useFitBoxSize(stageRef, ratio);
  return (
    <div ref={stageRef} className="part1-scene-stage">
      <div
        ref={innerRef}
        className={`part1-scene${extraClassName ? ` ${extraClassName}` : ""}`}
        style={{ ...(size ? { width: size.width, height: size.height } : undefined), cursor }}
        onClick={onClick}
      >
        {children}
      </div>
    </div>
  );
}
