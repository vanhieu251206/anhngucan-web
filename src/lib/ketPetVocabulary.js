// Chấm điểm Vocabulary KET/PET — mỗi Unit là danh sách NHÓM câu hỏi theo thứ tự I, II, III... (đổi
// từ danh sách câu hỏi phẳng sang nhóm, chốt người dùng 2026-09-17, cùng cơ chế với Practice Test —
// xem ketPetPracticeTest.js): GV tạo 1 nhóm, CHỌN DẠNG cho cả nhóm, nhập hướng dẫn làm bài + đoạn văn
// dùng chung (nếu có) + tổng điểm của nhóm, rồi bấm "+ Thêm câu" nhiều lần — mỗi câu thêm vào LUÔN
// theo đúng dạng của nhóm. Điểm mỗi câu trong nhóm = tổng điểm nhóm / số câu.
export { toRoman } from "./ketPetPracticeTest.js";

export const GROUP_TYPES = [
  { key: "multiple-choice", label: "Trắc nghiệm (Choose the correct word)" },
  { key: "fill-blank", label: "Điền từ (Collocation / Fill in the blanks)" },
  { key: "word-bank", label: "Điền từ trong khung từ cho sẵn (Collocation completion / word box)" },
  { key: "translation", label: "Dịch câu (Translation — chỉ hiện đáp án mẫu, không chấm điểm)" },
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
  if (type === "word-bank") return { text: "", answer: "" };
  return { prompt: "", sampleAnswer: "" };
}

// `wordBank`: danh sách từ cho sẵn dùng chung cả nhóm (chỉ dùng cho type "word-bank").
export function blankGroup(type = "multiple-choice") {
  return {
    type,
    instruction: "",
    passage: "",
    wordBank: type === "word-bank" ? [] : undefined,
    totalPoints: type === "translation" ? 0 : 1,
    questions: [],
  };
}

// answers: { "gi-qi": string | number } — number (answerIndex) cho multiple-choice, string cho
// fill-blank/word-bank. Nhóm "translation" không chấm điểm (results[gi][qi] = null), không cộng total.
export function gradeVocabularyGroups(groups, answers) {
  let correct = 0;
  let total = 0;
  const results = groups.map((g, gi) => {
    const count = g.questions.length;
    if (g.type === "translation" || count === 0) {
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
      } else if (g.type === "word-bank") {
        isCorrect = isFillBlankCorrect(userAnswer, [q.answer]);
      }
      total += perQuestion;
      if (isCorrect) correct += perQuestion;
      return isCorrect;
    });
  });
  return { correct, total, results };
}
