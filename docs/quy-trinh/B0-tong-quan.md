# Quy trình soạn bài Speaking (Cambridge YLE)

> File quy tắc dùng để soạn nội dung Speaking từng cấp độ (Starters/Movers/Flyers × 1-4). Cập nhật file này mỗi khi có quy tắc mới được chốt trong lúc làm việc với người dùng. Không tự ý đổi quy tắc đã chốt — hỏi lại nếu có mâu thuẫn.

## 1. Cấu trúc dữ liệu 1 bài Speaking

Mỗi cấp độ (`level`) có 1 mảng `speaking`, mỗi phần tử là 1 câu hỏi trong luồng hội thoại tuần tự:

```js
{
  image: "",              // URL ảnh minh hoạ (nếu có), để trống nếu không cần ảnh
  question: "What's this?",       // câu hỏi app đọc bằng TTS
  answer_keywords: "pen, pencil", // các từ khoá đáp án đúng, cách nhau bằng dấu phẩy
}
```

- App tự động thêm câu chào mở đầu cố định (`Hello! What's your name?`, không chấm điểm) trước khi vào các câu trong mảng — **không** đưa câu chào vào dữ liệu Sheet/mock.
- `answer_keywords` để trống (`""`) nếu là câu hỏi mở, không có đáp án cố định → app chỉ ghi nhận "Cảm ơn bạn đã trả lời!", không chấm đúng/sai.
- Cách chấm: so khớp **chứa từ khoá** (không phân biệt hoa thường, đã qua `normalize()`), đúng nếu câu học sinh nói chứa ít nhất 1 từ khoá trong danh sách.

## 2. Nguyên tắc chọn câu hỏi (đã chốt trong CLAUDE.md mục 4)

1. Chỉ đưa vào các câu có đáp án **tương đối cố định**, đúng theo định dạng đề thi thật Cambridge YLE — ví dụ: `What's this?`, `What colour is it?`, `How many ... are there?`, `Is it a ...?`, `Where is/are ...?`.
2. **Không** đưa câu hỏi sở thích cá nhân hoàn toàn tự do (ví dụ "What's your favourite food?") vì không thể chấm bằng so khớp từ khoá.
3. Nội dung câu hỏi chỉ lấy **phần text mẫu** từ sách gốc trong `Input/` (tham khảo cấu trúc câu hỏi thi thật) — **không** phát lại audio gốc có bản quyền của sách.
4. Độ khó/từ vựng câu hỏi phải đúng cấp độ tương ứng (Starters dễ nhất, Flyers khó nhất) và bám theo chủ đề/từ vựng chính thức của cấp đó trong khung Cambridge YLE.
5. Số lượng câu hỏi mỗi cấp: theo mẫu hiện tại là 3 câu (có thể điều chỉnh nếu người dùng yêu cầu khác khi soạn thật).

## 3. Quy trình từng bước khi soạn 1 bài Speaking thật

Khi người dùng cung cấp thông tin cho 1 cấp độ cụ thể (ví dụ Starters cấp 1), làm theo thứ tự:

1. **Xác định series + cấp độ**: series nào (starters/movers/flyers), số cấp (1-4).
2. **Nhận danh sách câu hỏi từ người dùng** (hoặc soạn dựa theo `Input/` nếu người dùng yêu cầu và cung cấp file/trang cụ thể) — mỗi câu gồm: text câu hỏi, ảnh minh hoạ (nếu có), danh sách từ khoá đáp án đúng.
3. **Chuẩn hoá `answer_keywords`**: liệt kê đầy đủ các cách trả lời hợp lệ mà học sinh nhỏ tuổi có thể nói (đồng nghĩa, số ít/số nhiều, cách nói tắt) để so khớp không bị chấm sai oan. Ví dụ: câu hỏi màu → `"red, blue, green, yellow, orange, pink, purple, brown, black, white"` (chỉ liệt kê màu thực sự xuất hiện trong đáp án đúng của câu đó, không liệt kê thừa).
4. **Kiểm tra độ khó/từ vựng** khớp với cấp độ (không dùng từ vượt cấp).
5. **Cập nhật vào đúng vị trí dữ liệu**:
   - Hiện tại (dữ liệu mẫu): sửa trực tiếp trong `src/lib/yleData.js`, thay object `speaking` tương ứng của `level.number` và `seriesId` đúng.
   - Sau này (khi đã nối Google Sheets thật theo schema mục 4 CLAUDE.md): thêm dòng vào tab `Speaking` với cột `level_id, order, image, question, answer_keywords`.
6. **Không sửa** `SpeakingMode.jsx` hay logic chấm trừ khi người dùng yêu cầu thay đổi cách chấm/luồng hội thoại — chỉ thao tác trên dữ liệu.
7. **Xác nhận lại với người dùng** danh sách câu hỏi + từ khoá trước khi coi là chốt, vì đây là nội dung học thuật cần chính xác.

## 4. Việc KHÔNG làm khi soạn Speaking

- Không tự bịa câu hỏi ngoài định dạng đề thi thật Cambridge YLE.
- Không nhúng/host audio gốc có bản quyền của sách.
- Không đổi cấu trúc field (`image/question/answer_keywords`) trừ khi người dùng chủ động yêu cầu đổi schema.
- Không tự thêm bớt số câu hỏi mỗi cấp nếu người dùng chưa nói rõ số lượng mong muốn cho bài đó.

## 5. Nguồn tài liệu gốc (`Input/`)

- Mỗi cấp độ có 2 file PDF: bản màu (`... (sách màu).pdf`) và bản không màu (vd `Starters_1.pdf`, là **Answer Booklet**). **Dùng bản không màu (Answer Booklet)** để lấy dữ liệu Speaking — KHÔNG dùng bản màu.
- Mỗi quyển Answer Booklet có **3 Test** (Test 1, Test 2, Test 3), mỗi Test có đủ 4 phần Speaking (kịch bản Examiner/candidate) kèm đáp án mẫu.
- **Làm Test 1 trước**, Test 2/3 làm sau khi được yêu cầu — không tự làm trước cả 3 test khi chưa được yêu cầu.
- Phần "Speaking" của Answer Booklet là **bảng kịch bản Examiner** (cột: Part | Examiner does this | Examiner says this | Minimum response expected | Back-up questions) — đây là nguồn chính xác để lấy câu hỏi + đáp án mẫu, KHÔNG phải tự bịa.
- Part 1 & 2 của đề thi thật dựa vào **tranh cảnh (scene picture) có bản quyền** của sách — không có ảnh này trong tay và không được host ảnh gốc (xem CLAUDE.md mục 1, 2). Part 3 (4 object cards) & Part 4 (câu hỏi cá nhân) không phụ thuộc tranh cảnh.

## 6. QUY TẮC QUAN TRỌNG NHẤT: không tự suy diễn

**Người dùng sẽ mô tả cách làm cho TỪNG PHẦN cụ thể (Part 1/2/3/4) trước khi soạn** — vì cách xử lý Part 1&2 (thiếu ảnh scene picture bản quyền) chưa được chốt và người dùng muốn tự quyết định cách làm, không để AI tự suy diễn/tự chọn phương án thay.

- Khi đọc xong 1 Test trong Answer Booklet, **chỉ trích xuất/ghi lại nội dung gốc** (câu hỏi, đáp án mẫu) — KHÔNG tự chuyển đổi thành dữ liệu `speaking` trong `yleData.js` khi chưa có hướng dẫn cụ thể cho từng phần.
- Nếu thiếu thông tin để quyết định (vd thiếu ảnh, thiếu quy tắc chuyển đổi phần nào đó), **hỏi lại hoặc chờ hướng dẫn**, không tự chọn phương án mặc định.
- Ghi lại vào file này ngay khi người dùng chốt cách làm cho 1 phần, để áp dụng nhất quán cho các cấp độ/test sau.

## 7. Lịch sử cập nhật quy trình

- 2026-08-12: Tạo file quy trình lần đầu, dựa theo cấu trúc dữ liệu thực tế trong `yleData.js`/`SpeakingMode.jsx` và schema đề xuất ở CLAUDE.md mục 4.
- 2026-08-12: Bổ sung mục 5 (nguồn tài liệu `Input/`, dùng bản Answer Booklet không màu, mỗi quyển 3 Test, làm Test 1 trước) và mục 6 (quy tắc không tự suy diễn — người dùng sẽ mô tả cách làm từng Part cụ thể, đặc biệt là cách xử lý Part 1&2 thiếu ảnh scene picture bản quyền).
