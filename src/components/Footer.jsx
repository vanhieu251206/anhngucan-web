import Logo from "./Logo.jsx";

export default function Footer({ onNavigate }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <Logo size={32} />
          <p>Học tiếng Anh vui vẻ mỗi ngày cho các bạn nhỏ.</p>
        </div>

        <div className="footer-links">
          <div>
            <h4>Điều hướng</h4>
            <button onClick={() => onNavigate("home")}>Trang chủ</button>
            <button onClick={() => onNavigate("lessons")}>Bài học</button>
            <button onClick={() => onNavigate("about")}>Giới thiệu</button>
            <button onClick={() => onNavigate("contact")}>Liên hệ</button>
          </div>
          <div>
            <h4>Liên hệ</h4>
            <p>hello@anhngucan.vn</p>
            <p>Thứ 2 – Chủ nhật, 8:00 – 20:00</p>
          </div>
        </div>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} Anh Ngữ C.A.N. Học mà chơi, chơi mà học.</p>
      <p className="footer-legal-row">
        <span>Nội dung bám sát khung Cambridge YLE</span>
        <span aria-hidden="true">·</span>
        <span>Starters · Movers · Flyers</span>
      </p>
    </footer>
  );
}
