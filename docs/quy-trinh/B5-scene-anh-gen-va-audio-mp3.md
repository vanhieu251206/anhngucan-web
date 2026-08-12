# B5 — Scene dùng ảnh AI-generate + audio TTS thật (mp3)

> Cập nhật cách làm "Scene" trong kịch bản (mở rộng [B1-cau-truc-kich-ban.md](B1-cau-truc-kich-ban.md)), áp dụng trước tiên cho đoạn chào hỏi mở đầu (Candidate enters / Hello / What's your name?).

## 1. Ảnh Scene: dùng ảnh AI-generate, không phải ảnh cắt từ sách

- Với những Scene **không có tranh gốc trong sách** (vd đoạn chào hỏi mở đầu — chỉ là mô tả hành động "Candidate enters", không phải tranh cảnh trong đề thi), dùng **ảnh do AI generate** thay vì ảnh cắt từ sách màu.
- Claude có nhiệm vụ **soạn prompt gen ảnh** (mô tả cảnh, style, tông màu khớp theme web — cam san hô/xanh ngọc/kem, hoạt hình trẻ em) để người dùng tự gen ảnh bằng công cụ họ chọn, rồi đưa ảnh về cho Claude dùng.
- Việc này **không thay thế** cách làm ảnh Scene có sẵn trong sách (Part 1 câu hỏi thật vẫn dùng ảnh cắt từ sách màu như B2/B3 đã chốt) — chỉ áp dụng cho các Scene phát sinh thêm (giới thiệu, chào hỏi...) không có sẵn tranh gốc.

## 2. Audio: dùng file mp3 thật, không dùng browser TTS (`speechSynthesis`)

- Với đoạn chào hỏi này, người dùng sẽ cung cấp **file mp3 giọng đọc thật** (TTS chất lượng cao đã tạo sẵn) cho câu nói của giám khảo, thay vì để app tự đọc bằng Web Speech API (`speechSynthesis`, chất lượng giọng máy tuỳ trình duyệt/thiết bị — xem `src/lib/speech.js`).
- Cần bổ sung field audio file (mp3) cho step kịch bản, phát bằng thẻ `<audio>` khi tới step đó, thay vì gọi `speak()`.
- **Chưa rõ phạm vi áp dụng**: chỉ riêng đoạn chào hỏi này dùng mp3 thật, hay toàn bộ câu hỏi Speaking (Part 1/3/4) sau này đều sẽ chuyển sang dùng mp3 thật thay vì browser TTS? → cần hỏi lại khi làm tới các câu hỏi khác, không tự suy diễn áp dụng rộng ra.

## 3. Nơi lưu file

- Ảnh gen: người dùng thả vào `Bài học/` (xem [B3](B3-thu-muc-bai-hoc-staging.md)) → Claude copy sang `public/assets/img/speaking/<series>/<level>/test<n>/part<n>/`.
- Audio mp3: người dùng thả vào `Bài học/`, đặt tên gợi ý `<series>-<level>-test<n>-part<n>-<ten-buoc>.mp3` (vd `starters-1-test1-part1-greeting.mp3`) → Claude copy sang `public/assets/audio/speaking/<series>/<level>/test<n>/part<n>/`.

## 4. Prompt gen ảnh đã soạn cho đoạn chào hỏi (Starters 1, Test 1)

```
Warm, friendly children's book illustration, flat cartoon style with soft rounded shapes.
A cheerful young Cambridge English examiner (smiling woman, casual friendly outfit) sitting
at a small table, warmly greeting a young child (7-8 years old) who has just walked into the
room. The examiner is waving hello with a welcoming smile. Bright, cozy classroom background
with soft natural light. Color palette: warm coral orange (#FF7A45), teal (#2FB6C4), cream
background (#FFFBF2), soft yellow accents. Simple, clean vector illustration style suitable
for a kids' language-learning app, no text in image, 4:3 landscape aspect ratio.
```

- Trạng thái: **đã đưa cho người dùng, chờ ảnh gen thật + file mp3** trước khi đưa vào code.

## 5. Lịch sử

- 2026-08-12: Ghi nhận yêu cầu mới — Scene không có tranh gốc trong sách thì dùng ảnh AI-generate (Claude soạn prompt), và ít nhất đoạn chào hỏi mở đầu sẽ dùng audio mp3 thật thay vì browser TTS. Đã soạn prompt gen ảnh cho đoạn chào hỏi Starters 1 Test 1, chờ người dùng gen ảnh + gửi mp3.
