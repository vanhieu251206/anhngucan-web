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

// Dạng nhìn hình có thể có NHIỀU ô (2026-10-31, yêu cầu của cô): `answers` = mảng đáp án từng ô (mỗi ô vẫn nhiều cách
// viết ngăn bằng `|`), không cần đúng thứ tự, mỗi ô tính 1 câu. Câu 1 ô (mọi bài cũ) giữ `answer` như trước.
// Đề học sinh đã gỡ đáp án nên số ô nằm ở `boxCount`.
export function isMultiBox(item) {
  return item?.type === "picture" && (Array.isArray(item.answers) || Number(item.boxCount) > 1);
}

export function vocabBoxCount(item) {
  if (!isMultiBox(item)) return 1;
  return Array.isArray(item.answers) ? Math.max(item.answers.length, 1) : Number(item.boxCount);
}

// Ghép từng ô học sinh gõ với 1 đáp án chưa dùng (không theo thứ tự) — tìm cặp ghép lớn nhất để thứ tự gõ không làm
// mất điểm khi các đáp án có cách viết trùng nhau. Trả về chỉ số đáp án đã ghép cho từng ô (-1 = sai).
export function matchBoxes(typed, answers) {
  const owner = answers.map(() => -1);
  const fits = (b, a) => isVocabCorrect(typed[b], answers[a]);
  function tryBox(b, seen) {
    for (let a = 0; a < answers.length; a++) {
      if (seen[a] || !fits(b, a)) continue;
      seen[a] = true;
      if (owner[a] < 0 || tryBox(owner[a], seen)) {
        owner[a] = b;
        return true;
      }
    }
    return false;
  }
  typed.forEach((_, b) => tryBox(b, []));
  const match = typed.map(() => -1);
  owner.forEach((b, a) => {
    if (b >= 0) match[b] = a;
  });
  return match;
}

function boxValues(raw, count) {
  const arr = Array.isArray(raw) ? raw : [raw];
  return Array.from({ length: count }, (_, k) => String(arr[k] ?? ""));
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

// Điểm mỗi câu — bài có `totalPoints` (ô "Tổng điểm cả bài" trong CMS) thì chia đều cho các câu; để trống (bài cũ)
// thì mỗi câu 1 điểm.
export function vocabPointsPerItem(items, totalPoints) {
  const count = (items ?? []).filter(vocabItemReady).reduce((n, item) => n + vocabBoxCount(item), 0);
  const n = Number(totalPoints);
  return n > 0 && count > 0 ? n / count : 1;
}

// raw: { [chỉ số câu]: chuỗi học sinh gõ — câu nhiều ô thì là mảng chuỗi theo ô }. Chỉ số theo mảng `items` gốc
// (kể cả câu nháp bị ẩn). `results[i]`: true/false, câu nhiều ô là mảng true/false theo ô.
export function gradeVocabItems(items, raw, totalPoints) {
  const perItem = vocabPointsPerItem(items, totalPoints);
  const round2 = n => Math.round(n * 100) / 100;
  let rightCount = 0;
  let count = 0;
  let qNumber = 0;
  const detail = [];
  const results = (items ?? []).map((item, i) => {
    if (!vocabItemReady(item)) return null;
    const label = item.type === "definition" ? String(item.definition).slice(0, 120) : vocabTypeInfo(item.type).label;
    if (!isMultiBox(item)) {
      count += 1;
      const ok = isVocabCorrect(raw?.[i], item.answer);
      if (ok) rightCount += 1;
      qNumber += 1;
      detail.push({ qNumber, prompt: label, studentAnswer: String(raw?.[i] ?? ""), correctAnswer: acceptedAnswers(item.answer).join(" / "), isCorrect: ok });
      return ok;
    }
    const answers = item.answers ?? [];
    const typed = boxValues(raw?.[i], vocabBoxCount(item));
    const match = matchBoxes(typed, answers);
    // Ô sai lần lượt nhận các đáp án chưa ai ghép để hiện "đáp án đúng" cho từng ô.
    const left = answers.map((_, a) => a).filter(a => !match.includes(a));
    return typed.map((value, k) => {
      const ok = match[k] >= 0;
      count += 1;
      if (ok) rightCount += 1;
      qNumber += 1;
      const shownAnswer = ok ? answers[match[k]] : answers[left.shift()];
      detail.push({ qNumber, prompt: `${label} — ô ${k + 1}`, studentAnswer: value, correctAnswer: acceptedAnswers(shownAnswer).join(" / "), isCorrect: ok });
      return ok;
    });
  });
  return { correct: round2(rightCount * perItem), total: round2(count * perItem), results, items: detail };
}
