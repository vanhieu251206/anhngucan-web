export default function AboutPage({ onNavigate }) {
  return (
    <section className="section">
      <h1 className="page-title">Về Anh Ngữ C.A.N</h1>
      <p className="lead">
        Anh Ngữ C.A.N là website học tiếng Anh dành cho học sinh nhỏ tuổi, xây
        dựng nội dung bám sát sách giáo trình, giúp bé học từ vựng và luyện
        nói qua các trò chơi đơn giản, không gây áp lực.
      </p>

      <div className="feature-grid">
        <div className="feature-card">
          <span className="feature-dot" style={{ background: "#FF7A45" }} />
          <h3>Học qua trò chơi</h3>
          <p>Kéo thả và lật thẻ giúp bé ghi nhớ từ vựng một cách tự nhiên.</p>
        </div>
        <div className="feature-card">
          <span className="feature-dot" style={{ background: "#2FB6C4" }} />
          <h3>Luyện nói thực tế</h3>
          <p>Mô phỏng phần thi nói Cambridge YLE Starters, chấm đúng/sai tức thì.</p>
        </div>
        <div className="feature-card">
          <span className="feature-dot" style={{ background: "#4CAF7D" }} />
          <h3>Miễn phí, dùng ngay</h3>
          <p>Không cần tải app, không tốn phí — mở trình duyệt là học được.</p>
        </div>
      </div>

      <div className="cta-banner cta-banner-inline">
        <h2>Khám phá bài học đầu tiên</h2>
        <button className="btn btn-primary" onClick={() => onNavigate("lessons")}>
          Bắt đầu học
        </button>
      </div>
    </section>
  );
}
