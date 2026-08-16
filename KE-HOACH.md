# Kế hoạch phát triển — App Học Tiếng Anh

> File tổng hợp các giai đoạn (phase) phát triển tính năng phân quyền/quản trị của web, tách riêng khỏi `CLAUDE.md` (chứa ràng buộc kỹ thuật + cấu trúc code) để dễ theo dõi tiến độ theo thời gian. Cập nhật file này mỗi khi bắt đầu/hoàn thành 1 phase mới.

## Mục tiêu MVP

**MVP (Minimum Viable Product) của dự án** = 1 website học tiếng Anh cho trẻ nhỏ, bám sát cấu trúc đề thi Cambridge YLE (Starters/Movers/Flyers), chạy hoàn toàn miễn phí, không cần cài đặt gì, gồm:

1. **Listening** — nhúng video nghe có sẵn theo từng cấp độ.
2. **Speaking** — mô phỏng đúng bài thi nói thật, chạy theo scene tuần tự kiểu Duolingo, chấm điểm bằng nhận diện giọng nói (Whisper WASM, client-side, miễn phí).
3. **Có kiểm soát truy cập cơ bản** — không public hoàn toàn tự do, giáo viên có thể khoá/mở nội dung, có tài khoản quản trị riêng.

MVP coi là **đạt** khi có ít nhất 1 bộ đề (Starters 1) đầy đủ Test 1, chạy mượt trên điện thoại, và có cơ chế khoá nội dung cơ bản — **đã đạt tại Phase 1** (xem bên dưới). Các phase sau là mở rộng, không phải điều kiện MVP.

## Nguyên tắc chung (không đổi qua các phase)

- Không backend tự vận hành, không API AI trả phí theo lượng dùng (xem `CLAUDE.md` mục 2).
- Ngoại lệ duy nhất đã chấp nhận: **Firebase Auth + Firestore, gói Spark (miễn phí)** — không dùng Cloud Functions, không nâng lên gói Blaze.
- **KHÔNG dùng Firebase Storage** (phát hiện ở Phase 2: Google giờ bắt buộc gói Blaze/thẻ thanh toán mới bật được Storage, kể cả khi dùng trong hạn mức miễn phí) — thay bằng **Cloudinary (free tier, không cần thẻ thanh toán)**: ảnh/audio trong CMS nhận **dán URL có sẵn HOẶC upload trực tiếp qua Cloudinary** (`src/lib/cloudinaryUpload.js`, unsigned upload preset — không cần server/API secret ở client).
- Không đóng gói app/exe/APK — luôn là website thuần chạy trình duyệt.
- Mỗi phase mới phải xác nhận với người dùng trước khi code (không tự ý mở rộng phạm vi).

---

## Phase 1 — Đăng nhập admin/teacher + khoá bài học (✅ Đã xong — 2026-08-13/14)

**Mục tiêu:** có nền tảng phân quyền cơ bản, khoá được nội dung thật.

- Đăng nhập **admin**/**teacher** qua Firebase Auth (email/password), tài khoản tạo thủ công qua Firebase Console.
- **guest** (= học sinh, không cần tài khoản) phải nhập đúng **1 mật khẩu chung** mới xem được bài học (Listening + Speaking).
- Mật khẩu chung lưu dạng hash SHA-256 trong Firestore, đổi được ngay trong app (màn Cài đặt, chỉ admin/teacher vào được).
- Admin/teacher tự động bỏ qua màn khoá.

**Trạng thái:** đã code xong, đã test qua trên local + đã deploy lên GitHub Pages. Đã có 1 project Firebase (`fbase-test`, gói Spark) + 1 tài khoản admin thật.

---

## Phase 1.5 — Dashboard quản trị riêng biệt + admin tự tạo tài khoản giáo viên (✅ Đã xong — 2026-08-14)

**Mục tiêu:** admin/teacher đăng nhập vào có khu vực quản trị riêng (không lẫn giao diện học sinh), và admin tạo được tài khoản teacher ngay trong app.

- Đăng nhập admin/teacher → điều hướng vào `dashboard` (layout riêng biệt hoàn toàn, không dùng `Header`/`Footer` công khai, tông màu riêng — sidebar sáng, không phải cam/xanh ngọc của web học sinh).
- Sidebar theo role: **admin** thấy "Tổng quan"/"Tạo bài"/"Cấu hình tài khoản giáo viên"; **teacher** chỉ thấy "Kết quả học sinh".
- "Tổng quan"/"Tạo bài"/"Kết quả học sinh" hiện là **placeholder** (chờ Phase 2/3).
- **"Cấu hình tài khoản giáo viên" đã làm THẬT**: admin xem danh sách + tự tạo tài khoản teacher mới ngay trong app (`src/lib/adminUsers.js`, dùng kỹ thuật Firebase App phụ để không bị đá khỏi phiên đăng nhập admin) — không cần vào Firebase Console tạo tay nữa.
- Đã cập nhật lại Firestore Rules để admin đọc/ghi được `users/{uid}` (trước đó Phase 1 khoá cứng, giờ mở có kiểm soát qua hàm `isAdmin()` trong rules).

**Trạng thái:** đã code + test xong trên local (tạo teacher không làm mất phiên admin, teacher đăng nhập chỉ thấy đúng 1 mục sidebar).

---

## Phase 2 — Soạn bài không cần code (CMS) (✅ Đã xong — 2026-08-14)

**Mục tiêu:** admin tự thêm/sửa bài học (Listening + Speaking, nhiều Test/cấp) qua giao diện web, không cần Claude sửa code mỗi lần.

- **Schema Firestore mới:** `lessons/{seriesId}-{level}` (chứa `listening: {videoId,title}`) + subcollection `tests/{testId}` (mỗi Test 1 doc riêng, chứa `scenes: [...]` đúng contract `SceneRunner.jsx`).
- **`LessonsPage.jsx`** (phía học sinh) đọc Firestore trước, KHÔNG có thì tự dùng lại dữ liệu hardcode cũ (`yleData.js`, Starters 1 Test 1) làm "Test 1" mặc định — không cần migrate ép buộc, nội dung cũ vẫn chạy y nguyên.
- **`CreateLessonPage.jsx`** (dashboard admin): wizard chọn bộ đề → cấp → Listening (form videoId+title) / Speaking (danh sách Test, mỗi Test có `SceneListBuilder` kiểu Canva — thêm/sửa/xoá/nhân bản/sắp xếp lại scene, chọn 1 trong 5 template loại scene, `CoordinatePicker` chọn toạ độ % bằng kéo chuột trực tiếp trên ảnh thay vì đo tay).
- **Đổi hướng giữa chừng:** dự tính ban đầu dùng Firebase Storage để admin upload ảnh/audio trực tiếp — phát hiện Storage giờ bắt buộc gói Blaze (thẻ thanh toán), trái với ràng buộc dự án → tạm thời bỏ Storage, chỉ nhận dán URL ảnh/audio có sẵn.
- **Bổ sung 2026-08-15:** tích hợp **Cloudinary** (free, không thẻ) để bù lại việc mất upload trực tiếp — `ImageUploadField`/`AudioUploadField` giờ có thêm nút "Chọn file để upload" gọi `uploadToCloudinary()` (`src/lib/cloudinaryUpload.js`, dùng unsigned upload preset, không cần backend), tự điền URL trả về vào field; ô dán URL thủ công vẫn giữ nguyên làm lựa chọn thay thế.
- Chỉ **admin** ghi được bài học (teacher chưa có quyền soạn bài, chỉ xem "Kết quả học sinh" ở Phase 3).

**Trạng thái:** đã code xong, build sạch. Cần publish lại Firestore Rules (thêm khối `lessons`) rồi test trên local trước khi push.

---

## Phase 3 — Theo dõi tiến độ học sinh (⏳ Chưa làm)

**Mục tiêu:** giáo viên xem được học sinh nào đã học bài nào, làm đúng/sai bao nhiêu. Đã có sẵn mục "Kết quả học sinh" trong sidebar teacher (placeholder) từ Phase 1.5, chỉ cần làm phần nội dung thật.

**Vấn đề cần giải quyết trước khi code (chưa chốt):**
- Học sinh hiện là "guest" ẩn danh (chỉ cần mật khẩu chung, không có tài khoản/định danh riêng) — cần quyết định cách nhận diện từng em: thêm tài khoản học sinh thật (phức tạp hơn), hay chỉ cần nhập tên/mã lớp mỗi lần vào học (đơn giản hơn, không cần mật khẩu riêng).
- Thiết kế schema Firestore lưu kết quả học (theo học sinh + theo scene/bài + đúng/sai/số lần thử).
- Giao diện dashboard cho teacher xem tổng hợp.
- Cân nhắc quota đọc/ghi Firestore free tier khi số lượng học sinh tăng (mỗi scene hoàn thành có thể là 1 lần ghi).

**Điều kiện bắt đầu:** người dùng chủ động yêu cầu, và cần chốt xong câu hỏi "học sinh được nhận diện như thế nào" trước khi thiết kế schema.

---

## Backlog / ý tưởng chưa lên phase (chưa cam kết thời điểm làm)

- Soạn tiếp Test 2, Test 3 (Starters 1) và các cấp độ khác của Starters — theo đúng quy trình B0→B3 trong `docs/quy-trinh/`, độc lập với 3 phase phân quyền ở trên, có thể làm xen kẽ bất cứ lúc nào.
- Movers, Flyers (bộ đề khác).
- Nối Google Sheets làm nguồn dữ liệu — theo `CLAUDE.md` mục 5, có thể sẽ được thay thế hẳn bởi CMS ở Phase 2 thay vì làm riêng.
- Nâng cấp độ chính xác nhận diện giọng nói (đổi Whisper-tiny → whisper-base) nếu thấy cần, đánh đổi tốc độ tải/chạy trên máy yếu.

## Lịch sử

- 2026-08-14: Tạo file, ghi lại Phase 1 đã hoàn thành + phác thảo Phase 2/3 dựa trên trao đổi với người dùng khi làm tính năng phân quyền.
- 2026-08-14: Thêm Phase 1.5 (dashboard quản trị riêng biệt + admin tự tạo tài khoản giáo viên trong app) — đã code + test xong.
- 2026-08-14: Làm Phase 2 (CMS "Tạo bài") — phát hiện giữa chừng Firebase Storage giờ bắt buộc gói Blaze, phải đổi hướng bỏ Storage, chuyển field ảnh/audio sang nhận URL dán tay thay vì upload trực tiếp. Cập nhật nguyên tắc chung ghi rõ KHÔNG dùng Storage.
