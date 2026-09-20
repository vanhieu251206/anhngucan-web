// Chấm điểm Vocabulary KET/PET — mỗi Unit là danh sách NHÓM câu hỏi theo thứ tự I, II, III... (đổi
// từ danh sách câu hỏi phẳng sang nhóm, chốt người dùng 2026-09-17, cùng cơ chế với Practice Test —
// xem ketPetPracticeTest.js): GV tạo 1 nhóm, CHỌN DẠNG cho cả nhóm, nhập hướng dẫn làm bài + đoạn văn
// dùng chung (nếu có) + tổng điểm của nhóm, rồi bấm "+ Thêm câu" nhiều lần — mỗi câu thêm vào LUÔN
// theo đúng dạng của nhóm. Điểm mỗi câu trong nhóm = tổng điểm nhóm / số câu.
export { toRoman } from "./ketPetPracticeTest.js";

export const GROUP_TYPES = [
  { key: "multiple-choice", label: "Trắc nghiệm (Choose the correct word — 2-4 đáp án)" },
  { key: "pronunciation-underline", label: "Trắc nghiệm phát âm (gạch chân chữ cái, bôi đen + bấm nút U)" },
  { key: "fill-blank", label: "Điền từ (Collocation / Fill in the blanks)" },
  { key: "word-bank", label: "Điền từ trong khung từ cho sẵn (Collocation completion / word box)" },
  { key: "categorize", label: "Phân loại từ vào cột (VD theo phát âm /ə/ - /ɜː/)" },
  { key: "true-false-table", label: "Bảng đúng/sai (True/False) nhiều câu" },
  { key: "reorder", label: "Sắp xếp câu hội thoại đúng thứ tự (A, B, C...)" },
  { key: "word-scramble", label: "Xáo trộn từ — sắp xếp thành câu hoàn chỉnh" },
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
// - "categorize": `columnIndex` là vị trí cột đúng trong `group.columns`.
// - "true-false-table": `answer` là boolean (true = Đúng).
// - "reorder": không có field đáp án riêng — thứ tự ĐÚNG chính là thứ tự GV nhập trong `questions`
//   (câu ở vị trí qi có đáp án đúng là "vị trí qi+1"), học sinh làm bài thấy danh sách bị xáo trộn.
// - "word-scramble": `words` là các từ xáo trộn (hiển thị tĩnh), `acceptedAnswers` là (các) câu đúng.
export function blankGroupQuestion(type) {
  if (type === "multiple-choice") return { text: "", options: ["", "", "", ""], answerIndex: 0 };
  if (type === "pronunciation-underline") return { options: ["", "", "", ""], answerIndex: 0 };
  if (type === "fill-blank") return { text: "", acceptedAnswers: [] };
  if (type === "word-bank") return { text: "", answer: "" };
  if (type === "categorize") return { text: "", columnIndex: 0 };
  if (type === "true-false-table") return { text: "", answer: true };
  if (type === "reorder") return { text: "" };
  if (type === "word-scramble") return { words: [], acceptedAnswers: [] };
  return { prompt: "", sampleAnswer: "" };
}

// `wordBank`: danh sách từ cho sẵn dùng chung cả nhóm (chỉ dùng cho type "word-bank"). `columns`:
// tên các cột phân loại (chỉ dùng cho "categorize", mặc định 2 cột). `audioUrl`: audio bài nghe dùng
// chung cho cả nhóm (tuỳ chọn, áp dụng được cho MỌI dạng — dùng cho các bài Listening).
export function blankGroup(type = "multiple-choice") {
  return {
    type,
    instruction: "",
    passage: "",
    audioUrl: "",
    wordBank: type === "word-bank" ? [] : undefined,
    columns: type === "categorize" ? ["", ""] : undefined,
    totalPoints: type === "translation" ? 0 : 1,
    questions: [],
  };
}

// answers: { "gi-qi": string | number | boolean } — number (answerIndex/columnIndex/vị trí) cho
// multiple-choice/pronunciation-underline/categorize/reorder, string cho fill-blank/word-bank/
// word-scramble, boolean cho true-false-table. Nhóm "translation" không chấm điểm (results = null).
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
      if (g.type === "multiple-choice" || g.type === "pronunciation-underline") {
        isCorrect = userAnswer === q.answerIndex;
      } else if (g.type === "fill-blank") {
        isCorrect = isFillBlankCorrect(userAnswer, q.acceptedAnswers);
      } else if (g.type === "word-bank") {
        isCorrect = isFillBlankCorrect(userAnswer, [q.answer]);
      } else if (g.type === "categorize") {
        isCorrect = userAnswer != null && userAnswer !== "" && Number(userAnswer) === q.columnIndex;
      } else if (g.type === "true-false-table") {
        isCorrect = userAnswer === q.answer;
      } else if (g.type === "reorder") {
        isCorrect = userAnswer != null && userAnswer !== "" && Number(userAnswer) === qi + 1;
      } else if (g.type === "word-scramble") {
        isCorrect = isFillBlankCorrect(userAnswer, q.acceptedAnswers);
      }
      total += perQuestion;
      if (isCorrect) correct += perQuestion;
      return isCorrect;
    });
  });
  return { correct, total, results };
}

// Xáo trộn danh sách ỔN ĐỊNH theo 1 seed số (không dùng Math.random trực tiếp) — cùng 1 nhóm câu hỏi
// phải xáo trộn RA CÙNG 1 THỨ TỰ mỗi lần render lại (đổi câu trả lời, mở lại Preview...), tránh xáo
// lại ngẫu nhiên mỗi lần re-render làm học sinh bị đổi đề giữa chừng. Dùng cho dạng "reorder".
export function seededShuffle(items, seed) {
  const arr = items.map((item, i) => ({ item, i }));
  let s = seed || 1;
  function rand() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
