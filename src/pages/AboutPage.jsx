const LEVELS = [
  { name: "Starters", cefr: "Pre A1", color: "#FF7A45", desc: "Bé làm quen từ vựng cơ bản, nghe hiểu và trả lời câu hỏi đơn giản." },
  { name: "Movers", cefr: "A1", color: "#2FB6C4", desc: "Nói về cuộc sống hằng ngày, đọc và viết câu ngắn." },
  { name: "Flyers", cefr: "A2", color: "#4CAF7D", desc: "Nối câu, kể chuyện ngắn, tự tin giao tiếp cơ bản." },
  { name: "KET · PET", cefr: "A2 · B1", color: "#FFC94A", desc: "Bước tiếp theo sau YLE: luyện đề Reading theo từng nhóm câu hỏi." },
  { name: "IELTS", cefr: "Học thuật", color: "#7C6FE0", desc: "Luyện Reading, Listening, Writing, Speaking, Dictation cho người học lớn hơn." },
];

const FEATURES = [
  { color: "#FF7A45", title: "Học qua trò chơi", text: "Kéo thả, chọn thẻ, bấm vào tranh — mỗi bài như một màn chơi nhỏ, bé học mà không thấy áp lực." },
  { color: "#2FB6C4", title: "Luyện nói với giám khảo ong", text: "Mô phỏng phần thi nói Cambridge YLE. Bé bấm giữ mic để trả lời, hệ thống nhận diện giọng nói và phản hồi ngay." },
  { color: "#4CAF7D", title: "Bám sát đề thi thật", text: "Cấu trúc bài Listening, Reading & Writing, Speaking theo đúng format Cambridge Starters, Movers, Flyers." },
  { color: "#FFC94A", title: "Chép chính tả & luyện nghe", text: "Bài Dictation và Listening giúp bé nghe kỹ, viết đúng chính tả và quen với giọng đọc chuẩn." },
  { color: "#EF5B5B", title: "Chấm và phản hồi tức thì", text: "Đúng sai hiện ngay sau mỗi câu, kèm lời khen để bé có thêm động lực làm tiếp." },
  { color: "#7C6FE0", title: "Chạy trên mọi thiết bị", text: "Điện thoại, máy tính bảng hay máy tính — chỉ cần trình duyệt, không cần cài đặt ứng dụng." },
];

const STEPS = [
  { title: "Chọn bộ đề", text: "Starters, Movers, Flyers, KET, PET hoặc IELTS." },
  { title: "Chọn kỹ năng", text: "Listening, Speaking, Reading & Writing hoặc Dictation." },
  { title: "Nhập mật khẩu lớp", text: "Giáo viên cung cấp mật khẩu để mở khoá bài học." },
  { title: "Làm bài & nhận phản hồi", text: "Làm từng bước, xem kết quả và luyện lại khi cần." },
];

const TIPS = [
  "Cho bé học ở nơi yên tĩnh, dùng tai nghe khi làm bài Listening.",
  "Khi luyện Speaking, cho phép trình duyệt dùng micro và nói rõ, gần micro.",
  "Mỗi ngày luyện 10–15 phút hiệu quả hơn học dồn một buổi dài.",
  "Nên mở bằng Chrome hoặc Safari; tránh mở trong trình duyệt của Zalo/Facebook vì có thể không ghi âm được.",
  "Ba mẹ nên ngồi cùng bé những buổi đầu, khen ngợi nỗ lực thay vì chỉ chú ý điểm số.",
];

const FAQS = [
  { q: "Anh Ngữ C.A.N có mất phí không?", a: "Học sinh dùng website hoàn toàn không mất phí. Bài học được khoá bằng mật khẩu do giáo viên cung cấp." },
  { q: "Bé cần chuẩn bị gì?", a: "Một thiết bị có trình duyệt và kết nối mạng. Với bài Speaking cần thêm micro và cho phép trình duyệt truy cập micro." },
  { q: "Vì sao không ghi âm được?", a: "Hãy mở trang bằng Chrome hoặc Safari (không dùng trình duyệt trong ứng dụng Zalo/Facebook) và kiểm tra quyền micro của trang." },
  { q: "Bài học lấy từ đâu?", a: "Nội dung do giáo viên biên soạn theo format đề luyện thi Cambridge; không phát lại audio gốc của nhà xuất bản." },
  { q: "Làm sao lấy mật khẩu lớp?", a: "Vui lòng liên hệ giáo viên hoặc gửi tin nhắn ở trang Liên hệ." },
];

const RESOURCES = [
  { label: "Cambridge English – Young Learners (chính thức)", href: "https://www.cambridgeenglish.org/qualifications-young-learners/" },
  { label: "British Council – Kids & Teens: trò chơi và bài hát", href: "https://learnenglishkids.britishcouncil.org/" },
  { label: "Cambridge – Sample tests Starters, Movers, Flyers", href: "https://www.cambridgeenglish.org/exams-and-tests/starters/preparation/" },
];

export default function AboutPage({ onNavigate }) {
  return (
    <section className="section about-page">
      <h1 className="page-title">Về Anh Ngữ C.A.N</h1>
      <p className="lead">
        Anh Ngữ C.A.N là website học tiếng Anh dành cho học sinh nhỏ tuổi, xây dựng nội dung bám sát
        đề luyện thi Cambridge, giúp bé học từ vựng, luyện nghe và luyện nói qua các trò chơi đơn
        giản, không gây áp lực.
      </p>

      <h2 className="about-heading">Điểm nổi bật</h2>
      <div className="feature-grid about-grid-3">
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title}>
            <span className="feature-dot" style={{ background: f.color }} />
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </div>

      <h2 className="about-heading">Các cấp độ trên website</h2>
      <div className="about-levels">
        {LEVELS.map((l) => (
          <div className="about-level" key={l.name} style={{ "--lv": l.color }}>
            <div className="about-level-head">
              <strong>{l.name}</strong>
              <span className="about-badge">{l.cefr}</span>
            </div>
            <p>{l.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="about-heading">Bắt đầu học như thế nào?</h2>
      <ol className="about-steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="about-step-num">{i + 1}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="about-heading">Lời khuyên cho phụ huynh</h2>
      <ul className="about-tips">
        {TIPS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <h2 className="about-heading">Câu hỏi thường gặp</h2>
      <div className="about-faq">
        {FAQS.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>

      <h2 className="about-heading">Tài liệu tham khảo</h2>
      <ul className="about-resources">
        {RESOURCES.map((r) => (
          <li key={r.href}>
            <a href={r.href} target="_blank" rel="noopener noreferrer">{r.label}</a>
          </li>
        ))}
      </ul>

      <div className="cta-banner cta-banner-inline">
        <h2>Khám phá bài học đầu tiên</h2>
        <button className="btn btn-primary" onClick={() => onNavigate("lessons")}>
          Bắt đầu học
        </button>
        <button className="btn about-cta-ghost" onClick={() => onNavigate("contact")}>
          Liên hệ giáo viên
        </button>
      </div>
    </section>
  );
}
