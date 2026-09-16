// Chấm điểm Practice Test KET/PET — mỗi Test (1-4) của 1 Unit là danh sách NHÓM CÂU HỎI theo thứ tự
// I, II, III... (đổi từ danh sách câu hỏi phẳng sang nhóm, chốt người dùng 2026-09-16): GV tạo 1 nhóm,
// CHỌN DẠNG cho cả nhóm (trắc nghiệm/điền từ/tự luận), nhập hướng dẫn làm bài + đoạn văn dùng chung
// (nếu có) + tổng điểm của nhóm, rồi bấm "+ Thêm câu" nhiều lần — mỗi câu thêm vào LUÔN theo đúng dạng
// của nhóm (không tự chọn dạng riêng từng câu nữa). Điểm mỗi câu trong nhóm = tổng điểm nhóm / số câu.
export const GROUP_TYPES = [
  { key: "multiple-choice", label: "Trắc nghiệm (phát âm / chọn đáp án / điền từ đoạn văn / đọc hiểu)" },
  { key: "fill-blank", label: "Điền từ / Chia dạng đúng của từ (đáp án ngắn)" },
  { key: "open-ended", label: "Tự luận (viết câu / đặt câu hỏi — chỉ hiện đáp án mẫu, không chấm điểm)" },
];

function normalize(str) {
  return (str ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isFillBlankCorrect(userAnswer, acceptedAnswers) {
  const normalized = normalize(userAnswer);
  if (!normalized) return false;
  return (acceptedAnswers ?? []).some(a => normalize(a) === normalized);
}

// 1 câu hỏi TRONG 1 nhóm — không có field `type`/`points` riêng, thừa hưởng từ nhóm cha.
export function blankGroupQuestion(type) {
  if (type === "multiple-choice") return { text: "", options: ["", "", "", ""], answerIndex: 0 };
  if (type === "fill-blank") return { text: "", acceptedAnswers: [] };
  return { prompt: "", sampleAnswer: "" };
}

export function blankGroup(type = "multiple-choice") {
  return { type, instruction: "", passage: "", totalPoints: type === "open-ended" ? 0 : 1, questions: [] };
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
      let isCorrect = false;
      if (g.type === "multiple-choice") {
        isCorrect = userAnswer === q.answerIndex;
      } else if (g.type === "fill-blank") {
        isCorrect = isFillBlankCorrect(userAnswer, q.acceptedAnswers);
      }
      total += perQuestion;
      if (isCorrect) correct += perQuestion;
      return isCorrect;
    });
  });
  return { correct, total, results };
}
