// Icon audio đặt trên trang sách — thanh phát kim loại kiểu "nút vặn" (play tròn + rãnh trượt sọc
// chéo + núm kim loại viền xanh lá theo tiến trình + loa tròn), phục chế theo đúng mẫu người dùng
// gửi (skin nút nghe flipbook cũ) — chốt 2026-09-23. Tự tính kích thước bằng PIXEL từ `pageWidth`
// (không dùng % lồng trong flex — từng bị vỡ hình do CSS % kết hợp aspect-ratio không ổn định giữa
// các trình duyệt, lỗi thực tế gặp phải).
function PlayIcon({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d="M7 4.5v15l13-7.5z" fill="#555b66" />
    </svg>
  );
}
function PauseIcon({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <rect x="5" y="4" width="5" height="16" fill="#555b66" />
      <rect x="14" y="4" width="5" height="16" fill="#555b66" />
    </svg>
  );
}
function SpeakerIcon({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="#555b66" />
      <path
        d="M16.5 8.5a5 5 0 0 1 0 7 M18.7 6.3a8 8 0 0 1 0 11.4"
        fill="none"
        stroke="#555b66"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SoundMarkWidget({ x, y, pageWidth, playing, progress = 0, onToggle, badge, empty }) {
  const width = Math.round(Math.min(210, Math.max(110, pageWidth * 0.26)));
  const height = Math.round(width / 5.4); // thanh thấp, gọn hơn hẳn bản trước
  const knob = Math.round(height * 0.8); // nút play/loa nhỏ hơn hẳn chiều cao thanh, nằm lọt bên trong
  const thumb = Math.round(height * 0.66);
  const iconSize = Math.round(knob * 0.46);
  const padX = Math.round(height * 0.14);

  return (
    <button
      type="button"
      className={`sound-mark-widget${empty ? " is-empty" : ""}`}
      style={{ left: `${x}%`, top: `${y}%`, width, height, gap: padX, padding: `0 ${padX}px` }}
      onClick={onToggle}
    >
      {badge != null && <span className="sound-mark-badge">{badge}</span>}
      <span className="sound-mark-play" style={{ width: knob, height: knob }}>
        {playing ? <PauseIcon size={iconSize} /> : <PlayIcon size={iconSize} />}
      </span>
      <span className="sound-mark-track">
        <span
          className={`sound-mark-thumb${playing ? " is-active" : ""}`}
          style={{ width: thumb, height: thumb, left: `${Math.round(progress * 100)}%` }}
        />
      </span>
      <span className="sound-mark-speaker" style={{ width: knob, height: knob }}>
        <SpeakerIcon size={iconSize * 0.85} />
      </span>
    </button>
  );
}
