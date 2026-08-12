# B1 — Cấu trúc kịch bản 1 bài Speaking (yêu cầu từ trung tâm)

> Ghi lại yêu cầu của trung tâm về cách trình bày 1 kịch bản Speaking trong app, dựa theo bảng gốc trong Answer Booklet (xem [B0-tong-quan.md](B0-tong-quan.md) mục 5).

## 1. Ánh xạ từ bảng gốc (Answer Booklet) sang luồng app

Bảng gốc mỗi Part có 5 cột: `Part | Examiner does this | Examiner says this | Minimum response expected | Back-up questions`.

Yêu cầu trung tâm: 1 bước (step) trong kịch bản app gồm:

| Thành phần app | Lấy từ cột nào | Vai trò |
|---|---|---|
| **Scene** | Cột 2 — "Examiner does this" | Bối cảnh/hành động của giám khảo tại bước này (mô tả tình huống, không phải câu nói) |
| **Câu hỏi chính (TTS)** | Cột 3 — "Examiner says this" | App đọc bằng TTS, là câu hỏi chính học sinh cần trả lời |
| **Gợi ý câu trả lời mẫu** | Cột 4 — "Minimum response expected" | Hiện lên cho học sinh dạng câu mẫu có chỗ trống `....` để học sinh tự điền/tự nói phần biến đổi (từ khoá đáp án thật) |
| **Câu hỏi phụ (TTS)** | Cột 5 — "Back-up questions" | Sau khi học sinh trả lời câu chính, app đọc tiếp câu hỏi phụ (dạng yes/no dễ hơn) |
| **Gợi ý trả lời câu phụ** | Suy ra từ câu hỏi phụ (yes/no) | Hiện gợi ý dạng `Yes, it's ....` / `No, it isn't` tương ứng |

## 2. Luồng 1 step (1 hàng trong bảng gốc)

```
1. Hiện Scene (mô tả bối cảnh, ví dụ ảnh/text mô tả — KHÔNG phải audio)
2. TTS đọc câu hỏi chính (cột 3)
3. Học sinh trả lời (ghi âm / nhận diện giọng nói)
   → App hiện gợi ý câu trả lời mẫu có chỗ trống: "It's a ...." (phần .... = từ học sinh tự nói)
4. TTS đọc câu hỏi phụ (cột 5, câu yes/no dễ hơn)
5. Học sinh trả lời lần 2
   → App hiện gợi ý câu trả lời mẫu cho câu phụ: "Yes, it's ...." / "No, it isn't"
6. Chuyển sang step tiếp theo
```

## 3. Ví dụ minh hoạ (dùng dữ liệu thật — Test 1, Starters 1, Part 3.1)

Từ bảng gốc:
- Examiner does this: *Show fish card.*
- Examiner says this: *What's this? / Do you eat fish? / What do you eat for breakfast?*
- Minimum response expected: *fish / yes-no / bread*
- Back-up questions: *Is it a fish? / Do you eat bread?*

→ Dựng thành step theo yêu cầu trên (ví dụ minh hoạ, **chưa phải bản chốt cuối cùng** — chờ xác nhận):

```
Scene: Giám khảo đưa ra thẻ hình con cá (fish card).
TTS (câu hỏi chính): "What's this?"
Gợi ý trả lời: "It's a ...." (học sinh tự nói: fish)
TTS (câu hỏi phụ): "Is it a fish?"
Gợi ý trả lời: "Yes, it's a ...." / "No, it isn't"
```

## 4. Việc CẦN xác nhận thêm trước khi áp dụng vào dữ liệu thật

- Mỗi hàng gốc (vd 3.1, 3.2, 3.3, 3.4) có TỚI 3 câu hỏi chính (cột 3 có 3 dòng: "What's this?" / "Do you eat fish?" / "What do you eat for breakfast?") chứ không chỉ 1 câu + 1 câu phụ. Cần hỏi rõ: mỗi dòng nhỏ trong cột 3 có phải là 1 step riêng (có gợi ý trả lời riêng), rồi câu hỏi phụ (cột 5) chỉ áp dụng cho dòng đầu tiên (What's this?) hay áp dụng chung/luân phiên cho cả 3?
- Định dạng chính xác của "gợi ý câu trả lời mẫu" (câu đầy đủ có `....` hay chỉ hiện từ khoá đáp án) — ví dụ ở trên là suy đoán minh hoạ, cần trung tâm xác nhận mẫu câu chuẩn (vd có luôn dùng "It's a ...." hay tuỳ loại câu hỏi: "It's ....", "There are ....", "I eat ....").
- Cấu trúc dữ liệu (`speaking` array trong `yleData.js`) hiện tại chưa có field cho `scene`, `sample_answer_template`, `followup_question`, `followup_sample_answer` — cần cập nhật schema mới cho khớp yêu cầu này (sẽ làm ở bước sau khi nội dung được chốt).

## 5. Lịch sử

- 2026-08-12: Ghi lại yêu cầu ban đầu từ trung tâm về cấu trúc kịch bản (Scene → TTS câu hỏi chính → gợi ý trả lời có `....` → TTS câu hỏi phụ → gợi ý trả lời câu phụ). Có ví dụ minh hoạ dùng dữ liệu Part 3.1 thật, nhưng CHƯA chốt — còn vướng câu hỏi ở mục 4.
