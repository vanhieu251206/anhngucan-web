// Chính sách bảo mật (audit trước launch 2026-09-25) — web thu giọng nói + họ tên/lớp của trẻ em nên cần công bố
// rõ dữ liệu nào được thu, gửi cho ai, giữ bao lâu (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).
export default function PrivacyPage() {
  return (
    <section className="section privacy-page">
      <h1 className="page-title">Chính sách bảo mật</h1>
      <p className="lead">Cập nhật ngày 25/09/2026.</p>

      <h2>1. Dữ liệu chúng mình thu thập</h2>
      <ul>
        <li>Thông tin tài khoản do giáo viên tạo: họ tên, lớp, tên đăng nhập. Mật khẩu được mã hoá, giáo viên cũng không xem được.</li>
        <li>Bài làm: câu trả lời, số câu đúng, thời gian làm bài, số lượt đã làm.</li>
        <li>Giọng nói khi làm bài Speaking: đoạn ghi âm được gửi đi để chuyển thành chữ. Chúng mình chỉ lưu lại phần chữ, không lưu file âm thanh.</li>
      </ul>

      <h2>2. Mục đích sử dụng</h2>
      <p>Chỉ để học sinh làm bài, giáo viên chấm và theo dõi kết quả, và cải thiện độ chính xác khi nhận diện giọng nói của trẻ. Không dùng cho quảng cáo, không bán hay chia sẻ cho bên thứ ba vì mục đích thương mại.</p>

      <h2>3. Dịch vụ bên thứ ba xử lý dữ liệu</h2>
      <ul>
        <li>Google Firebase: đăng nhập và lưu dữ liệu bài học, kết quả.</li>
        <li>AssemblyAI (qua Cloudflare): chuyển giọng nói thành chữ.</li>
        <li>Cloudinary: lưu ảnh, âm thanh của bài học (không chứa dữ liệu học sinh).</li>
        <li>Google Analytics và Google reCAPTCHA: thống kê lượt truy cập ẩn danh và chống truy cập tự động. Không gửi tên hay tài khoản học sinh.</li>
      </ul>

      <h2>4. Thời gian lưu trữ</h2>
      <ul>
        <li>Kết quả bài làm chi tiết tự động bị xoá 48 giờ sau hạn nộp bài.</li>
        <li>Tài khoản học sinh được giữ đến khi giáo viên xoá.</li>
      </ul>

      <h2>5. Quyền của phụ huynh và học sinh</h2>
      <p>Phụ huynh có thể yêu cầu xem, sửa hoặc xoá dữ liệu của con bằng cách liên hệ giáo viên phụ trách lớp hoặc qua trang Liên hệ.</p>

      <h2>6. Bảo mật</h2>
      <p>Mọi kết nối đều được mã hoá (HTTPS). Chỉ giáo viên phụ trách và quản trị viên xem được kết quả của học sinh; học sinh không xem được dữ liệu của bạn khác.</p>
    </section>
  );
}
