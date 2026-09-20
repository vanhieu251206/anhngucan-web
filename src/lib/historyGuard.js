// Cờ toàn cục "không ghi lịch sử" cho tài khoản đặc biệt (role "tester") — làm được mọi dạng bài
// nhưng KHÔNG để lại dấu vết trong hệ thống (speakingSessions, speechLogs, attempts). AuthProvider
// bật/tắt cờ này theo role; mọi hàm ghi lịch sử trong lib/ đều kiểm tra `isHistoryDisabled()` trước
// khi ghi, nên không phải sửa từng nơi gọi (SceneRunner/ReadingRunner/DictationRunner...).
let disabled = false;

export function setHistoryDisabled(value) {
  disabled = Boolean(value);
}

export function isHistoryDisabled() {
  return disabled;
}
