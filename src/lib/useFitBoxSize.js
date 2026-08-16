import { useLayoutEffect, useState } from "react";

// Tính kích thước khung ảnh theo ĐÚNG tỉ lệ `ratio` (width/height) truyền vào, luôn vừa khít cả
// chiều rộng lẫn chiều cao đang có (không tràn, không cần cuộn) — đo bằng ResizeObserver trên
// khung cha thay vì dùng CSS aspect-ratio, vì aspect-ratio kết hợp flexbox khi thiếu chỗ theo
// chiều dọc từng chỉ co HEIGHT mà giữ nguyên width, làm ảnh bị bóp méo/lệch hẳn khỏi toạ độ %
// của highlight/hotspot (bug đã gặp thật, xem lịch sử docs/quy-trinh/B3-Code-scene.md,
// docs/quy-trinh/LOI-DA-GAP.md mục 7). Tách ra dùng chung giữa SceneRunner.jsx (chạy bài cho học
// sinh) và CoordinatePicker.jsx (chọn toạ độ trong CMS) — CÙNG 1 cơ chế đo để toạ độ % vẽ ra
// trong CMS khớp chính xác 100% với vị trí hiển thị thật lúc học sinh làm bài.
export function useFitBoxSize(stageRef, ratio) {
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || !ratio) return;
    function measure() {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      let boxW = w;
      let boxH = boxW / ratio;
      if (boxH > h) {
        boxH = h;
        boxW = boxH * ratio;
      }
      setSize({ width: boxW, height: boxH });
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);
  return size;
}
