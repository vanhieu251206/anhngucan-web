// Đồng bộ vài lựa chọn điều hướng (trang hiện tại, bộ đề/cấp độ/loại bài đang chọn) vào query
// string trên URL — để F5/tải lại trang không bị bật về Trang chủ (chốt sau phản hồi người dùng
// 2026-08-17: app vốn điều hướng hoàn toàn bằng state trong bộ nhớ, không có router thật).
// Cố tình dùng thẳng History API + URLSearchParams thay vì thêm thư viện router (react-router...)
// — đủ dùng cho vài cấp điều hướng hiện có, không cần thêm dependency mới.

export function readParams() {
  return new URLSearchParams(window.location.search);
}

// Cập nhật một số key trong URL, GIỮ NGUYÊN các key khác không có trong `patch`. Giá trị
// null/undefined/"" thì xoá key đó khỏi URL (thay vì ghi chữ "null" vô nghĩa lên URL).
export function setParams(patch, { replace = false } = {}) {
  const usp = readParams();
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") usp.delete(key);
    else usp.set(key, String(value));
  });
  const query = usp.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

// Nhảy thẳng tới 1 trang với bộ tham số MỚI HOÀN TOÀN (vd bấm 1 bài trong chuông thông báo, AssignmentBell.jsx)
// — App.jsx nghe sự kiện "app:navigate" để đọc lại URL và dựng lại trang từ đầu (kể cả khi đang ở đúng trang đó).
export function navigateApp(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") usp.set(key, String(value));
  });
  const query = usp.toString();
  window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  window.dispatchEvent(new Event("app:navigate"));
}
