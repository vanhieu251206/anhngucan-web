// Chấm điểm Reading & Writing (Starters/Movers/Flyers) — module THUẦN (không React/Firebase/Vite) để dùng CHUNG
// cho trình duyệt (ReadingRunner.jsx, Preview CMS) LẪN Cloudflare Worker chấm bài phía máy chủ (worker/src/submit.js,
// chốt 2026-09-25: học sinh không còn tự chấm/gửi điểm). Sửa quy tắc chấm ở đây là áp dụng cho cả hai nơi.

export function normalizeAnswer(s) {
  return (s ?? "").trim().toLowerCase();
}

// Đáp án đúng có thể có NHIỀU cách viết như sách đáp án — giáo viên nhập cách nhau bằng dấu "|"
// (vd "a red hat|red hat"). Học sinh viết đúng MỘT trong các cách là được điểm; bỏ trống thì luôn sai.
export function answerMatches(value, correct) {
  const v = normalizeAnswer(value);
  if (!v) return false;
  return String(correct ?? "").split("|").some(a => normalizeAnswer(a) === v);
}

export function splitGapfillText(text) {
  return (text ?? "").split("___");
}

// Tổng điểm của 1 câu — mặc định 1 nếu giáo viên chưa nhập (dữ liệu cũ trước khi có tính năng
// điểm số, hoặc lỡ để trống/nhập số âm) cũng rơi vào trường hợp này, tránh câu 0 điểm ngoài ý muốn.
export function questionPoints(question) {
  const n = Number(question.points);
  return n > 0 ? n : 1;
}

// Điểm của TỪNG chỗ trống trong câu gapfill — tổng điểm câu chia đều cho số chỗ trống.
export function gapPoints(question, blankCount) {
  if (!blankCount) return 0;
  return questionPoints(question) / blankCount;
}

// Điểm THẬT SỰ dùng để chấm 1 câu — Part có `partPoints` thì chia đều cho các câu (bỏ qua điểm riêng từng câu);
// câu "free-writing" luôn 0 điểm và không tính vào mẫu số. `isFlyers` (cả 3 series từ 2026-09-06): mỗi Question
// (kể cả từng chỗ trống gapfill) đúng 1 điểm.
export function effectiveQuestionPoints(part, question, isFlyers) {
  if (question.type === "free-writing") return 0;
  if (isFlyers) return 1;
  const gradedCount = (part.questions ?? []).filter(q => q.type !== "free-writing").length;
  if (part.partPoints != null && gradedCount > 0) return part.partPoints / gradedCount;
  return questionPoints(question);
}

// Số chỗ trống THẬT (không tính chỗ trống ví dụ `firstGapIsExample`) của 1 câu gapfill. Đề học sinh tải về đã
// tách đáp án (lib/grading/answerKeys.js) nhưng GIỮ độ dài mảng `answers` (phần tử rỗng) nên vẫn đếm đúng.
export function gapfillBlankCount(question) {
  const offset = question.firstGapIsExample ? 1 : 0;
  return Math.max((question.answers ?? []).length - offset, 0);
}

// Xáo chữ cái THẬT MẠNH: lặp tới khi không còn chữ nào đứng đúng vị trí gốc (derangement), tối đa 30 lần thử.
export function scrambleWord(word) {
  const chars = word.split("");
  if (chars.length < 2) return word;
  let attempt = [...chars];
  for (let tries = 0; tries < 30; tries++) {
    for (let i = attempt.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [attempt[i], attempt[j]] = [attempt[j], attempt[i]];
    }
    if (attempt.every((c, i) => c !== chars[i])) break;
  }
  return attempt.join("");
}

// Cả 3 series (Starters/Movers/Flyers) chấm/đánh số theo từng chỗ trống (xem effectiveQuestionPoints).
export function isFlyersStyle(seriesId) {
  return seriesId === "flyers" || seriesId === "movers" || seriesId === "starters";
}

// Gộp mọi câu hỏi của mọi Part thành 1 danh sách phẳng, đánh số "Question N." liên tục xuyên suốt Test. Kiểu
// Flyers: mỗi chỗ trống THẬT của 1 câu gapfill tách thành 1 phần tử riêng (`gapIndex` = vị trí trong answers).
export function flattenQuestions(parts, isFlyers) {
  const flat = [];
  let n = 1;
  parts.forEach((part, partIndex) => {
    (part.questions ?? []).forEach((q, qIndex) => {
      if (isFlyers && q.type === "gapfill") {
        const offset = q.firstGapIsExample ? 1 : 0;
        const answers = q.answers ?? [];
        for (let gapIndex = offset; gapIndex < answers.length; gapIndex++) {
          flat.push({ question: q, part, partIndex, qIndex, gapIndex, qNumber: n });
          n += 1;
        }
      } else {
        flat.push({ question: q, part, partIndex, qIndex, gapIndex: null, qNumber: n });
        n += 1;
      }
    });
  });
  return flat;
}

// Chấm TOÀN BỘ bài. answers[partIndex][qIndex] = giá trị học sinh trả lời. Trả về dữ liệu THUẦN (không JSX) —
// ReadingRunner tự dựng thêm nhãn hiển thị cho màn tổng kết của giáo viên.
export function gradeReading(parts, answers, seriesId) {
  const isFlyers = isFlyersStyle(seriesId);
  const flat = flattenQuestions(parts, isFlyers);
  let earnedPoints = 0;
  let totalPoints = 0;
  const items = flat.map(({ question, part, partIndex, qIndex, qNumber, gapIndex }) => {
    const value = answers?.[partIndex]?.[qIndex];
    const qPoints = effectiveQuestionPoints(part, question, isFlyers);
    totalPoints += qPoints;
    const base = {
      qNumber, partIndex, qIndex, gapIndex, type: question.type, total: qPoints,
      prompt: question.text ?? question.prompt ?? "",
    };

    if (question.type === "gapfill" && gapIndex != null) {
      const correct = question.answers?.[gapIndex];
      const isCorrect = answerMatches(value?.[gapIndex], correct);
      const earned = isCorrect ? qPoints : 0;
      earnedPoints += earned;
      return { ...base, isCorrect, earned, studentAnswer: value?.[gapIndex]?.trim() || "(để trống)", correctAnswer: correct };
    }

    if (question.type === "yesno") {
      const isCorrect = value != null && value === question.answer;
      const earned = isCorrect ? qPoints : 0;
      earnedPoints += earned;
      return {
        ...base, isCorrect, earned,
        studentAnswer: value ? (value === "yes" ? "Yes" : "No") : "(chưa trả lời)",
        correctAnswer: question.answer === "yes" ? "Yes" : "No",
      };
    }

    if (question.type === "gapfill") {
      // Chỗ trống ví dụ (`firstGapIsExample`) không tính điểm — offset +1 khi đọc value[].
      const offset = question.firstGapIsExample ? 1 : 0;
      const gapAnswers = (question.answers ?? []).slice(offset);
      const perGap = gapAnswers.length ? qPoints / gapAnswers.length : 0;
      let gapEarned = 0;
      const blanks = gapAnswers.map((a, gi) => {
        const ok = answerMatches(value?.[gi + offset], a);
        if (ok) gapEarned += perGap;
        return { correct: ok, studentAnswer: value?.[gi + offset]?.trim() || "(để trống)", correctAnswer: a };
      });
      earnedPoints += gapEarned;
      return {
        ...base,
        isCorrect: gapAnswers.length > 0 && blanks.every(b => b.correct),
        earned: Math.round(gapEarned * 100) / 100,
        blanks,
      };
    }

    if (question.type === "short-answer" || question.type === "word-bank") {
      const isCorrect = answerMatches(value, question.answer);
      const earned = isCorrect ? qPoints : 0;
      earnedPoints += earned;
      return { ...base, isCorrect, earned, studentAnswer: (value ?? "").trim() || "(chưa trả lời)", correctAnswer: question.answer };
    }

    if (question.type === "multiple-choice") {
      const options = question.options ?? [];
      const isCorrect = value != null && value === question.answerIndex;
      const earned = isCorrect ? qPoints : 0;
      earnedPoints += earned;
      return {
        ...base, isCorrect, earned,
        studentAnswer: value !== undefined && value !== null ? options[value] ?? "(chưa trả lời)" : "(chưa trả lời)",
        correctAnswer: options[question.answerIndex] ?? "",
      };
    }

    if (question.type === "free-writing") {
      // Không có đáp án đúng/sai — chỉ ghi lại nội dung học sinh viết, không cộng điểm.
      return { ...base, ungraded: true, studentAnswer: (value ?? "").trim() || "(chưa viết)" };
    }

    // word-scramble
    const built = (Array.isArray(value) ? value : []).join("");
    const isCorrect = !!built && normalizeAnswer(built) === normalizeAnswer(question.answer);
    const earned = isCorrect ? qPoints : 0;
    earnedPoints += earned;
    return { ...base, isCorrect, earned, studentAnswer: built || "(chưa trả lời)", correctAnswer: (question.answer ?? "").toUpperCase() };
  });

  return { items, earnedPoints: Math.round(earnedPoints * 100) / 100, totalPoints };
}
