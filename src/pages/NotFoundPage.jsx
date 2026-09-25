const MASCOT_IMG = `${import.meta.env.BASE_URL}assets/img/mascot/co-can.png`;

// Trang 404 cho ?page=... không tồn tại (trước đây chỉ hiện Header + trang trắng). Đường dẫn sai hẳn (vd /abc) do
// GitHub Pages trả public/404.html.
export default function NotFoundPage({ onNavigate }) {
  return (
    <section className="section not-found-page">
      <img src={MASCOT_IMG} alt="Cô Cần" className="not-found-mascot" />
      <h1 className="page-title">Không tìm thấy trang</h1>
      <p className="lead">Trang này không tồn tại hoặc đã được chuyển đi.</p>
      <button className="btn btn-primary" onClick={() => onNavigate("home")}>Về trang chủ</button>
    </section>
  );
}
