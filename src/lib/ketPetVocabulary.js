// Chấm điểm Vocabulary KET/PET — mỗi Unit là 1 danh sách câu hỏi PHẲNG (không chia khung cố định,
// mỗi câu tự chọn dạng riêng — chốt người dùng 2026-09-14), dạng "multiple-choice"/"fill-blank"
// tính điểm, "translation" không chấm đúng/sai (chỉ hiện đáp án mẫu).
export const QUESTION_TYPES = [
  { key: "multiple-choice", label: "Trắc nghiệm (Choose the correct word)" },
  { key: "fill-blank", label: "Điền từ (Collocation / Fill in the blanks)" },
  { key: "translation", label: "Dịch câu (Translation)" },
];

function normalize(str) {
  return (str ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isFillBlankCorrect(userAnswer, acceptedAnswers) {
  const normalized = normalize(userAnswer);
  if (!normalized) return false;
  return (acceptedAnswers ?? []).some(a => normalize(a) === normalized);
}

export function blankQuestion(type) {
  if (type === "multiple-choice") return { type, text: "", options: ["", "", "", ""], answerIndex: 0 };
  if (type === "fill-blank") return { type, text: "", acceptedAnswers: [] };
  return { type: "translation", prompt: "", sampleAnswer: "" };
}

// answers: { [questionIndex]: string | number } — number (answerIndex) cho multiple-choice, string
// cho fill-blank. "translation" không có trong `results` (không chấm).
export function gradeVocabularyQuestions(questions, answers) {
  let correct = 0;
  let total = 0;
  const results = questions.map((q, qi) => {
    if (q.type === "translation") return null;
    const userAnswer = answers?.[qi];
    let isCorrect = false;
    if (q.type === "multiple-choice") {
      isCorrect = userAnswer === q.answerIndex;
    } else if (q.type === "fill-blank") {
      isCorrect = isFillBlankCorrect(userAnswer, q.acceptedAnswers);
    }
    total += 1;
    if (isCorrect) correct += 1;
    return isCorrect;
  });
  return { correct, total, results };
}
