// Vocabulary Starters/Movers/Flyers (2026-09-30) — mỗi bài là danh sách câu PHẲNG `items`, mỗi câu 1 trong 4 dạng,
// đều là "viết ra 1 từ": nhìn hình, xếp chữ cái, nghe, đọc định nghĩa. Đáp án `answer` nhiều cách viết ngăn bằng `|`.
// Module THUẦN — Worker (worker/src/submit.js) import thẳng để chấm, không import React/Firebase vào đây.
export const VOCAB_TYPES = [
  { key: "picture", label: "Nhìn hình ghi chữ", instruction: "Look at the picture and write the word." },
  { key: "scramble", label: "Xếp chữ cái thành từ", instruction: "Put the letters in order to make a word." },
  { key: "listen", label: "Nghe ghi từ", instruction: "Listen and write the word." },
  { key: "definition", label: "Đọc định nghĩa ghi từ", instruction: "Read and write the word." },
];

export function vocabTypeInfo(type) {
  return VOCAB_TYPES.find(t => t.key === type) ?? VOCAB_TYPES[0];
}

export function blankVocabItem(type) {
  return { type, imageUrl: "", audioUrl: "", definition: "", answer: "" };
}

function normalizeWord(str) {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}

export function acceptedAnswers(answer) {
  return String(answer ?? "")
    .split("|")
    .map(s => s.trim())
    .filter(Boolean);
}

export function isVocabCorrect(userAnswer, answer) {
  const typed = normalizeWord(userAnswer);
  return typed !== "" && acceptedAnswers(answer).some(a => normalizeWord(a) === typed);
}

// Câu đủ dữ liệu để hiện cho học sinh (bỏ câu nháp thiếu hình/audio/định nghĩa). Đề học sinh không có `answer`
// nên dạng xếp chữ nhận biết bằng `scrambled`.
export function vocabItemReady(item) {
  if (!item) return false;
  if (item.type === "picture") return Boolean(item.imageUrl);
  if (item.type === "listen") return Boolean(item.audioUrl);
  if (item.type === "definition") return Boolean(String(item.definition ?? "").trim());
  if (item.type === "scramble") return Boolean(item.scrambled || String(item.answer ?? "").trim());
  return false;
}

// raw: { [chỉ số câu]: chuỗi học sinh gõ }. Chỉ số theo mảng `items` gốc (kể cả câu nháp bị ẩn).
export function gradeVocabItems(items, raw) {
  let correct = 0;
  let total = 0;
  const results = (items ?? []).map((item, i) => {
    if (!vocabItemReady(item)) return null;
    total += 1;
    const ok = isVocabCorrect(raw?.[i], item.answer);
    if (ok) correct += 1;
    return ok;
  });
  let qNumber = 0;
  const detail = [];
  (items ?? []).forEach((item, i) => {
    if (results[i] == null) return;
    qNumber += 1;
    detail.push({
      qNumber,
      prompt: item.type === "definition" ? String(item.definition).slice(0, 120) : vocabTypeInfo(item.type).label,
      studentAnswer: String(raw?.[i] ?? ""),
      correctAnswer: acceptedAnswers(item.answer).join(" / "),
      isCorrect: results[i],
    });
  });
  return { correct, total, results, items: detail };
}
