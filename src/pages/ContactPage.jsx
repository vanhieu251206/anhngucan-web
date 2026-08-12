export default function ContactPage() {
  return (
    <section className="section narrow">
      <h1 className="page-title">Liên hệ</h1>
      <p className="lead">
        Có góp ý hoặc muốn gửi bài học mới? Nhắn cho chúng mình qua thông tin
        bên dưới.
      </p>

      <div className="contact-grid">
        <div className="contact-card">
          <h3>Email</h3>
          <p>hello@anhngucan.vn</p>
        </div>
        <div className="contact-card">
          <h3>Thời gian hỗ trợ</h3>
          <p>Thứ 2 – Chủ nhật, 8:00 – 20:00</p>
        </div>
        <div className="contact-card">
          <h3>Dành cho giáo viên</h3>
          <p>Liên hệ để được hướng dẫn thêm bài học mới vào hệ thống.</p>
        </div>
      </div>
    </section>
  );
}
