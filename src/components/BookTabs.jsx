// Tab đánh dấu unit ở mép sách (giống sách flipbook thật: mỗi unit 1 tab màu theo màu unit, gắn vào
// trang đầu unit). Tab của unit đã lật qua (page <= trang đang mở) nằm mép TRÁI, unit phía sau nằm
// mép PHẢI; vị trí dọc cố định theo thứ tự tab nên lật trang tab chỉ đổi bên chứ không nhảy chỗ.
// Tab thò ra từ SAU sách, rê chuột vào thì trượt ra thêm. Dùng chung cho BookReader.jsx (học sinh)
// và KidsBookTabsEditor.jsx (xem trước trong CMS).
// rect: vùng sách đang hiện (toạ độ theo phần tử cha position:relative); size: bề ngang phần thò ra.
export function tabTextColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? "#1f2540" : "#fff";
}

export default function BookTabs({ tabs, rect, currentPage, size = 26, onJump }) {
  if (!rect || !tabs?.length) return null;
  const sorted = [...tabs].sort((a, b) => a.page - b.page);
  const pad = rect.height * 0.02;
  const slotH = Math.min((rect.height - pad * 2) / sorted.length, rect.height / 8);
  const hidden = 14; // phần nằm khuất sau mép sách

  return sorted.map((t, i) => {
    const left = t.page <= currentPage;
    const style = {
      top: rect.top + pad + i * slotH,
      height: slotH - 2,
      width: size + hidden,
      left: left ? rect.left - size : rect.left + rect.width - hidden,
      background: t.color || "#F2A93B",
      color: tabTextColor(t.color),
      "--tab-hover-shift": `${left ? -Math.round(size * 0.5) : Math.round(size * 0.5)}px`,
      fontSize: Math.max(10, Math.min(size * 0.5, slotH * 0.4)),
    };
    return (
      <button
        type="button"
        key={`${t.page}-${i}`}
        className={`book-tab ${left ? "is-left" : "is-right"}`}
        style={style}
        title={`${t.label} — trang ${t.page + 1}`}
        onClick={() => onJump?.(t.page)}
      >
        <span>{t.label}</span>
      </button>
    );
  });
}
