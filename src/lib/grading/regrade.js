// Chấm LẠI 1 lượt nộp đã lưu (testResults) theo đề + đáp án HIỆN TẠI — dùng khi giáo viên sửa đáp án sau khi học
// sinh đã nộp (2026-10-05). Worker gọi (worker/src/submit.js → regradeTest). Module THUẦN.
//
// Lượt nộp từ 2026-10-05 có lưu câu trả lời thô (`rawAnswers`, chuỗi JSON) → chấm lại y như lúc nộp. Lượt nộp cũ
// hơn chỉ còn `items` (chi tiết từng câu để hiển thị) → dựng lại câu trả lời thô từ đó (answersFromItems). Dạng
// chấm ở trình duyệt (Speaking, Dictation, Part tô màu/nối tranh của Listening) không có gì để chấm lại → giữ nguyên.
import { SERVER_GRADED, gradeSubmission } from "./index.js";
import { flattenPassages, flattenSections } from "./ielts.js";
import { serverGrader } from "./listeningExam.js";
import { vocabItemReady } from "./vocab.js";

const EMPTY_MARKS = new Set(["", "(để trống)", "(chưa trả lời)", "(chưa viết)"]);
const typed = s => (s == null || EMPTY_MARKS.has(String(s)) ? undefined : String(s));
// "B. nội dung" → 1
function letterIndex(s) {
  const m = /^([A-Z])\. /.exec(String(s ?? ""));
  return m ? m[1].charCodeAt(0) - 65 : undefined;
}

function readingAnswers(test, items) {
  const answers = [];
  for (const it of items) {
    if (!Number.isInteger(it.partIndex) || !Number.isInteger(it.qIndex)) return null;
    const q = test.parts?.[it.partIndex]?.questions?.[it.qIndex];
    if (!q) continue;
    const row = (answers[it.partIndex] ??= []);
    if (it.type === "gapfill") {
      const gaps = (row[it.qIndex] ??= []);
      if (it.gapIndex != null) gaps[it.gapIndex] = typed(it.studentAnswer);
      else (it.blanks ?? []).forEach((b, gi) => { gaps[gi + (q.firstGapIsExample ? 1 : 0)] = typed(b.studentAnswer); });
    } else if (it.type === "yesno") {
      row[it.qIndex] = it.studentAnswer === "Yes" ? "yes" : it.studentAnswer === "No" ? "no" : undefined;
    } else if (it.type === "multiple-choice") {
      const i = (q.options ?? []).indexOf(it.studentAnswer);
      row[it.qIndex] = i >= 0 ? i : undefined;
    } else if (it.type === "word-scramble") {
      const s = typed(it.studentAnswer);
      row[it.qIndex] = s ? [s] : undefined;
    } else {
      row[it.qIndex] = typed(it.studentAnswer);
    }
  }
  return answers;
}

function ieltsAnswers(flat, items) {
  const answers = {};
  for (const it of items) {
    const entry = flat.find(e => e.number === it.qNumber);
    if (!entry) continue;
    if (entry.type === "multiple-choice") answers[it.qNumber] = letterIndex(it.studentAnswer);
    else if (typeof entry.q?.answer === "boolean") answers[it.qNumber] = it.studentAnswer === "true" ? true : it.studentAnswer === "false" ? false : undefined;
    else answers[it.qNumber] = typed(it.studentAnswer);
  }
  return answers;
}

function ketPetAnswers(test, items) {
  const answers = {};
  for (const it of items) {
    const gi = Number(it.group) - 1;
    const g = test.groups?.[gi];
    if (!g) continue;
    const qi = Number(it.qNumber) - (Number(g.startNumber) || 1);
    const q = g.questions?.[qi];
    if (!q) continue;
    const type = g.type === "split-reading" ? q.type : g.type;
    const s = typed(it.studentAnswer);
    let value = s;
    if (type === "multiple-choice" || type === "pronunciation-underline") value = letterIndex(s);
    else if (type === "true-false-table") value = s === "True" ? true : s === "False" ? false : undefined;
    else if (type === "categorize") {
      const col = (g.columns ?? []).findIndex(c => String(c) === s);
      value = s != null && col >= 0 ? col : undefined;
    } else if ((type === "open-ended" || type === "translation" || type === "free-response") && s != null) {
      // Chi tiết lưu cả phần gợi ý cô cho sẵn ghép trước câu học sinh viết — bỏ phần gợi ý để ra đúng chữ đã gõ.
      const hint = String(q.hint ?? "").trim();
      value = hint && s.startsWith(`${hint} `) ? s.slice(hint.length + 1) : s;
    }
    if (value !== undefined) answers[`${gi}-${qi}`] = value;
  }
  return answers;
}

function vocabAnswers(test, items) {
  const ready = (test.items ?? []).map((item, i) => (vocabItemReady(item) ? i : -1)).filter(i => i >= 0);
  const answers = {};
  for (const it of items) {
    const i = ready[Number(it.qNumber) - 1];
    if (i != null) answers[i] = String(it.studentAnswer ?? "");
  }
  return answers;
}

// Câu trả lời thô dựng lại từ chi tiết đã lưu. null = không dựng lại được (dữ liệu quá cũ, thiếu vị trí câu).
export function answersFromItems(kind, test, items) {
  if (kind === "reading") return readingAnswers(test, items);
  if (kind === "ielts-reading") return ieltsAnswers(flattenPassages(test.passages), items);
  if (kind === "ielts-listening") return ieltsAnswers(flattenSections(test.sections), items);
  if (kind === "ketpet-vocab" || kind === "ketpet-test") return ketPetAnswers(test, items);
  if (kind === "yle-vocab") return vocabAnswers(test, items);
  return null;
}

// Listening luyện đề, lượt nộp cũ: chỉ Part viết / chọn đáp án chấm lại được từ chi tiết đã lưu; Part nối tranh
// (không còn nét nối) và Part tô màu (trình duyệt chấm) giữ nguyên điểm cũ.
function regradeListeningFromItems(test, items) {
  const out = [];
  let correct = 0;
  let total = 0;
  const sections = [...new Set(items.map(it => it.section))];
  for (const section of sections) {
    const old = items.filter(it => it.section === section);
    const key = `part${String(section ?? "").replace(/\D/g, "")}`;
    const part = test.parts?.[key];
    const grader = part && key !== "part1" ? serverGrader(key, part) : null;
    if (grader) {
      const values = [];
      old.forEach(it => { values[Number(it.qNumber) - 1] = it.studentAnswer === "" ? null : it.studentAnswer; });
      const res = grader(part, values);
      correct += res.score;
      total += res.total;
      out.push(...res.items.map(it => ({ section, ...it })));
      continue;
    }
    const summary = old.length === 1 && old[0].ungraded ? /(\d+)\/(\d+)/.exec(String(old[0].studentAnswer)) : null;
    correct += summary ? Number(summary[1]) : old.filter(it => it.isCorrect).length;
    total += summary ? Number(summary[2]) : old.length;
    out.push(...old);
  }
  return { correct, total, items: out };
}

// result: 1 doc testResults. → { correct, total, items } theo đáp án hiện tại, hoặc null nếu không chấm lại được.
export function regradeResult(kind, test, result) {
  if (!SERVER_GRADED.has(kind) || !test) return null;
  const items = Array.isArray(result.items) ? result.items : [];
  let raw = null;
  if (typeof result.rawAnswers === "string") {
    try {
      raw = JSON.parse(result.rawAnswers);
    } catch {
      raw = null;
    }
  }
  if (raw == null) {
    if (!items.length) return null;
    if (kind === "listening-exam") return regradeListeningFromItems(test, items);
    raw = answersFromItems(kind, test, items);
    if (raw == null) return null;
  }
  const g = gradeSubmission(kind, test, raw);
  return g ? { correct: g.correct, total: g.total, items: g.items ?? [] } : null;
}

// Dấu vết đúng/sai + đáp án từng câu — để biết lượt nộp có đổi gì sau khi chấm lại không.
export function gradingSignature(result) {
  return JSON.stringify([
    result.correct ?? null,
    result.total ?? null,
    (result.items ?? []).map(it => [it.isCorrect ?? null, it.correctAnswer ?? null, (it.blanks ?? []).map(b => [b.correct ?? null, b.correctAnswer ?? null])]),
  ]);
}
