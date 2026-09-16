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
  { key: "open-ended", label: "Tự luận (viết câu / đặt câu hỏi — chỉ hiện đáp án mẫu, không chấm điểm)" },
];

// Dạng con CHỌN RIÊNG CHO TỪNG CÂU bên trong 1 nhóm "split-reading" (khác các nhóm khác — cả nhóm
// chỉ có 1 dạng chung, còn nhóm này cho trộn dạng con mỗi câu, chốt người dùng 2026-09-17: nhóm dạng
// đọc hiểu tách đôi màn hình như bài thi thật — có thể vừa có câu điền chỗ trống vừa có câu trắc
// nghiệm trong CÙNG 1 đoạn văn).
export const SPLIT_QUESTION_TYPES = [
  { key: "fill-blank", label: "Điền / viết câu trả lời (có dòng kẻ)" },
  { key: "multiple-choice", label: "Trắc nghiệm A/B/C/D" },
];

function normalize(str) {
  return (str ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isFillBlankCorrect(userAnswer, acceptedAnswers) {
  const normalized = normalize(userAnswer);
  if (!normalized) return false;
  return (acceptedAnswers ?? []).some(a => normalize(a) === normalized);
}

// 1 câu hỏi trong nhóm "split-reading" — có field `type` RIÊNG (khác các nhóm khác) vì mỗi câu tự
// chọn dạng con (điền chỗ trống / trắc nghiệm), xem SPLIT_QUESTION_TYPES.
export function blankSplitQuestion(subType = "fill-blank") {
  if (subType === "multiple-choice") return { type: "multiple-choice", text: "", options: ["", "", "", ""], answerIndex: 0 };
  return { type: "fill-blank", text: "", acceptedAnswers: [] };
}

// 1 câu hỏi TRONG 1 nhóm — không có field `type`/`points` riêng, thừa hưởng từ nhóm cha (TRỪ nhóm
// "split-reading", xem blankSplitQuestion ở trên). `hint` (fill-blank) là gợi ý tuỳ chọn hiện cạnh
// chỗ trống, ví dụ chia dạng từ: "(USE)" → đáp án "USEFUL".
export function blankGroupQuestion(type) {
  if (type === "multiple-choice") return { text: "", options: ["", "", "", ""], answerIndex: 0 };
  if (type === "pronunciation-underline") return { options: ["", "", "", ""], answerIndex: 0 };
  if (type === "fill-blank") return { text: "", hint: "", acceptedAnswers: [] };
  if (type === "word-bank") return { text: "", answer: "" };
  if (type === "split-reading") return blankSplitQuestion("fill-blank");
  return { prompt: "", sampleAnswer: "" };
}

// `wordBank`: danh sách từ cho sẵn dùng chung cả nhóm (chỉ dùng cho type "word-bank"). `passage` của
// nhóm "split-reading" là đoạn văn hiện BÊN TRÁI màn hình chia đôi (KetPetPracticeTestQuiz.jsx).
export function blankGroup(type = "multiple-choice") {
  return {
    type,
    instruction: "",
    passage: "",
    wordBank: type === "word-bank" ? [] : undefined,
    totalPoints: type === "open-ended" ? 0 : 1,
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

// answers: { "gi-qi": string | number } — number (answerIndex) cho multiple-choice, string cho
// fill-blank. Nhóm "open-ended" không chấm điểm (results[gi][qi] = null), không cộng vào total.
export function gradePracticeTestGroups(groups, answers) {
  let correct = 0;
  let total = 0;
  const results = groups.map((g, gi) => {
    const count = g.questions.length;
    if (g.type === "open-ended" || count === 0) {
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
        isCorrect = userAnswer === q.answerIndex;
      } else if (effectiveType === "fill-blank") {
        isCorrect = isFillBlankCorrect(userAnswer, q.acceptedAnswers);
      } else if (effectiveType === "word-bank") {
        isCorrect = isFillBlankCorrect(userAnswer, [q.answer]);
      }
      total += perQuestion;
      if (isCorrect) correct += perQuestion;
      return isCorrect;
    });
  });
  return { correct, total, results };
}
