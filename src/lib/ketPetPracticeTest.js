// Chấm điểm Practice Test KET/PET — mỗi Test (1-4) của 1 Unit là danh sách NHÓM CÂU HỎI theo thứ tự
// I, II, III... (đổi từ danh sách câu hỏi phẳng sang nhóm, chốt người dùng 2026-09-16): GV tạo 1 nhóm,
// CHỌN DẠNG cho cả nhóm (trắc nghiệm/điền từ/tự luận), nhập hướng dẫn làm bài + đoạn văn dùng chung
// (nếu có) + tổng điểm của nhóm, rồi bấm "+ Thêm câu" nhiều lần — mỗi câu thêm vào LUÔN theo đúng dạng
// của nhóm (không tự chọn dạng riêng từng câu nữa). Điểm mỗi câu trong nhóm = tổng điểm nhóm / số câu.
export const GROUP_TYPES = [
  { key: "multiple-choice", label: "Trắc nghiệm (chọn đáp án / điền từ đoạn văn / đọc hiểu)" },
  { key: "pronunciation-underline", label: "Trắc nghiệm phát âm (gạch chân chữ cái, bôi đen + bấm nút U)" },
  { key: "fill-blank", label: "Điền từ / Chia dạng đúng của từ (đáp án ngắn, có thể kèm gợi ý)" },
  { key: "word-bank", label: "Điền từ trong khung từ cho sẵn (word box)" },
  { key: "split-reading", label: "Đọc hiểu chia đôi màn hình (đoạn văn trái — câu hỏi phải, trộn được nhiều dạng con)" },
  { key: "open-ended", label: "Tự luận (viết câu / đặt câu hỏi — có gợi ý sẵn, chấm theo đáp án)" },
  { key: "true-false-table", label: "Bảng đúng/sai (True/False) nhiều câu" },
  { key: "free-response", label: "Tự luận không chấm (trả lời về bản thân — giáo viên tự đọc)" },
];

// Dạng con CHỌN RIÊNG CHO TỪNG CÂU bên trong 1 nhóm "split-reading" (khác các nhóm khác — cả nhóm
// chỉ có 1 dạng chung, còn nhóm này cho trộn dạng con mỗi câu, chốt người dùng 2026-09-17: nhóm dạng
// đọc hiểu tách đôi màn hình như bài thi thật — có thể vừa có câu điền chỗ trống vừa có câu trắc
// nghiệm trong CÙNG 1 đoạn văn).
export const SPLIT_QUESTION_TYPES = [
  { key: "fill-blank", label: "Điền / viết câu trả lời (có dòng kẻ)" },
  { key: "multiple-choice", label: "Trắc nghiệm A/B/C/D" },
];

// Chuẩn hoá DÙNG CHUNG cho mọi câu trả lời gõ chữ của KET/PET (điền từ, khung từ, xáo từ, nghe viết, tự luận — cả
// Practice Test lẫn Vocabulary, chốt 2026-10-02): bỏ qua hoa/thường, dấu câu, khoảng trắng thừa, nháy cong/thẳng
// (bàn phím điện thoại hay tự gõ ’). Ngoài ra máy KHÔNG tự đoán gì — cách viết khác (favourite/favorite, is not/isn't)
// chỉ đúng khi giáo viên liệt kê, ngăn bằng "|".
function normalizeSentence(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[.,!?;:"“”()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFillBlankCorrect(userAnswer, acceptedAnswers) {
  const normalized = normalizeSentence(userAnswer);
  if (!normalized) return false;
  return (acceptedAnswers ?? []).some(a => normalizeSentence(a) === normalized);
}

// Câu điền từ có NHIỀU Ô TRỐNG (tuỳ chọn, 2026-10-08): `q.blanks` = danh sách đáp án từng ô theo thứ tự trong câu
// (mỗi ô 1 chuỗi, nhiều cách viết ngăn bằng "|"). Có `blanks` → học sinh thấy mỗi chỗ trống 1 ô riêng, câu trả lời
// là MẢNG chuỗi, đúng hết các ô mới tính đúng câu. Không có `blanks` → 1 ô như cũ (`acceptedAnswers`).
// Đề học sinh tải về không có `blanks` (đã tách sang answerKeys), chỉ còn `blankCount`.
export function blankCount(q) {
  return Array.isArray(q?.blanks) ? q.blanks.length : Number(q?.blankCount) || 0;
}

export function isBlanksCorrect(userAnswer, blanks) {
  const typed = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
  return blanks.length > 0 && blanks.every((b, i) => isFillBlankCorrect(typed[i], String(b ?? "").split("|")));
}

// Tự luận (chấm điểm từ 2026-09-27): câu = { prompt, hint, sampleAnswer }. `hint` là vài từ cô cho sẵn, hiện ở đầu chỗ
// học sinh viết (học sinh viết tiếp phần còn lại). `sampleAnswer` = đáp án, nhiều cách viết ngăn bằng "|". Chấp nhận
// cả khi học sinh chỉ viết phần sau gợi ý lẫn chép lại cả câu.

export function openEndedFullAnswer(hint, userAnswer) {
  return [hint, userAnswer].map(s => String(s ?? "").trim()).filter(Boolean).join(" ");
}

export function isOpenEndedCorrect(userAnswer, hint, sampleAnswer) {
  const own = normalizeSentence(userAnswer);
  if (!own) return false;
  const candidates = new Set([own, normalizeSentence(openEndedFullAnswer(hint, userAnswer))]);
  return String(sampleAnswer ?? "")
    .split("|")
    .map(normalizeSentence)
    .filter(Boolean)
    .some(a => candidates.has(a));
}

// 1 câu hỏi trong nhóm "split-reading" — có field `type` RIÊNG (khác các nhóm khác) vì mỗi câu tự
// chọn dạng con (điền chỗ trống / trắc nghiệm), xem SPLIT_QUESTION_TYPES.
export function blankSplitQuestion(subType = "fill-blank") {
  if (subType === "multiple-choice") return { type: "multiple-choice", text: "", options: ["", "", "", ""], answerIndex: 0 };
  return { type: "fill-blank", text: "", acceptedAnswers: [] };
}

// Nhóm "free-response": câu = { prompt, hint, after? } — `after` là câu thoại hiện ngay SAU ô trả lời (VD lời đáp
// kết thúc hội thoại "Linda: That sounds nice!").
// 1 câu hỏi TRONG 1 nhóm — không có field `type`/`points` riêng, thừa hưởng từ nhóm cha (TRỪ nhóm
// "split-reading", xem blankSplitQuestion ở trên). `hint` (fill-blank) là gợi ý tuỳ chọn hiện cạnh
// chỗ trống, ví dụ chia dạng từ: "(USE)" → đáp án "USEFUL".
export function blankGroupQuestion(type) {
  if (type === "multiple-choice") return { text: "", options: ["", "", "", ""], answerIndex: 0 };
  if (type === "pronunciation-underline") return { options: ["", "", "", ""], answerIndex: 0 };
  if (type === "fill-blank") return { text: "", hint: "", acceptedAnswers: [] };
  if (type === "word-bank") return { text: "", answer: "" };
  if (type === "split-reading") return blankSplitQuestion("fill-blank");
  if (type === "true-false-table") return { text: "", answer: true };
  if (type === "free-response") return { prompt: "", hint: "" };
  return { prompt: "", hint: "", sampleAnswer: "" };
}

// `wordBank`: danh sách từ cho sẵn dùng chung cả nhóm (chỉ dùng cho type "word-bank"). `passage` của
// nhóm "split-reading" là đoạn văn hiện BÊN TRÁI màn hình chia đôi (KetPetPracticeTestQuiz.jsx).
export function blankGroup(type = "multiple-choice") {
  return {
    type,
    instruction: "",
    passage: "",
    wordBank: type === "word-bank" ? [] : undefined,
    totalPoints: type === "free-response" ? 0 : 1,
    questions: [],
  };
}

// Số La Mã cho tiêu đề nhóm (I, II, III...) — đủ dùng cho số nhóm thực tế trong 1 đề (không quá 20).
export function toRoman(n) {
  const table = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let num = n;
  let out = "";
  for (const [value, symbol] of table) {
    while (num >= value) {
      out += symbol;
      num -= value;
    }
  }
  return out || String(n);
}

// Trình bày giống sách (tuỳ chọn, thêm 2026-10-01 — chủ yếu do nhập từ file .txt, lib/ketPetTextImport.js):
// - `label`: nhãn đầu mục. Chưa có field (đề cũ / nhóm tạo tay) → số La Mã "I. hướng dẫn"; có (kể cả rỗng) → hiện
//   "label: hướng dẫn" đúng như sách ("Exercise 7: Rewrite..."), rỗng cả hai thì không hiện đầu mục (nhóm nối tiếp
//   của mục con thứ 2 trở đi trong cùng 1 Exercise).
// - `section`: tiêu đề lớn trên nhóm ("C. PRACTICE"). `subtitle`: mục con dưới đầu mục ("1. Suggestion").
// - `task`: dòng hướng dẫn nằm SAU đoạn văn ("Write TRUE or FALSE..."). `startNumber`: số của câu đầu (mặc định 1).
// - `image` (2026-10-08): ảnh của NHÓM hiện dưới đoạn văn (khung từ điển, bảng biểu...); mỗi CÂU cũng có `image`
//   riêng (biển báo, tranh) hiện ngay trên nội dung câu. Đều là URL, tuỳ chọn, dùng được với mọi dạng nhóm.
export function groupHeading(g, gi) {
  if (g.label == null) return `${toRoman(gi + 1)}. ${g.instruction}`;
  return [g.label, g.instruction].map(s => String(s ?? "").trim()).filter(Boolean).join(": ");
}

export function questionNumber(g, qi) {
  return (Number(g.startNumber) || 1) + qi;
}

// answers: { "gi-qi": string | number } — number (answerIndex) cho multiple-choice, string cho
// fill-blank/open-ended, boolean cho true-false-table. Nhóm tự luận cũ có totalPoints = 0 vẫn chấm Đúng/Sai
// nhưng không cộng điểm. Nhóm "free-response" không chấm điểm (results = null).
export function gradePracticeTestGroups(groups, answers) {
  let correct = 0;
  let total = 0;
  const results = groups.map((g, gi) => {
    const count = g.questions.length;
    if (g.type === "free-response" || count === 0) {
      return g.questions.map(() => null);
    }
    const perQuestion = (Number(g.totalPoints) || 0) / count;
    return g.questions.map((q, qi) => {
      const userAnswer = answers?.[`${gi}-${qi}`];
      // "split-reading": mỗi câu tự chọn dạng con qua `q.type` (xem SPLIT_QUESTION_TYPES), khác các
      // nhóm khác dùng chung `g.type` cho cả nhóm.
      const effectiveType = g.type === "split-reading" ? q.type : g.type;
      let isCorrect = false;
      if (effectiveType === "multiple-choice" || effectiveType === "pronunciation-underline") {
        isCorrect = userAnswer != null && userAnswer === q.answerIndex;
      } else if (effectiveType === "fill-blank") {
        isCorrect = Array.isArray(q.blanks) ? isBlanksCorrect(userAnswer, q.blanks) : isFillBlankCorrect(userAnswer, q.acceptedAnswers);
      } else if (effectiveType === "word-bank") {
        isCorrect = isFillBlankCorrect(userAnswer, [q.answer]);
      } else if (effectiveType === "open-ended") {
        isCorrect = isOpenEndedCorrect(userAnswer, q.hint, q.sampleAnswer);
      } else if (effectiveType === "true-false-table") {
        isCorrect = userAnswer != null && userAnswer === q.answer;
      }
      total += perQuestion;
      if (isCorrect) correct += perQuestion;
      return isCorrect;
    });
  });
  return { correct, total, results };
}
