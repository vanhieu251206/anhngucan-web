// Chấm điểm IELTS Reading (practiceTests → passages) + IELTS Listening (listeningTests → sections) — module THUẦN,
// dùng CHUNG cho trình duyệt lẫn Worker chấm bài phía máy chủ (xem lib/grading/reading.js).
import { deriveTableDiagramBlanks } from "../tableDiagramBlanks.js";

export function normalizeIeltsAnswer(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}

// IELTS Reading: mỗi chỗ trống bảng/đoạn văn/sơ đồ (table-diagram, diagram) cũng là 1 câu.
export function flattenPassages(passages) {
  const flat = [];
  let n = 1;
  (passages ?? []).forEach((passage, pi) => {
    (passage.groups ?? []).forEach((group, gi) => {
      const qs = group.type === "table-diagram" ? deriveTableDiagramBlanks(group)
        : group.type === "diagram" ? (group.diagramPoints ?? []).map(p => ({ acceptedAnswers: p.answer ?? "" }))
        : (group.questions ?? []);
      qs.forEach((q, qi) => {
        flat.push({ number: n, passageIndex: pi, groupIndex: gi, questionIndex: qi, type: group.type, q });
        n++;
      });
    });
  });
  return flat;
}

// IELTS Listening: chỉ có câu hỏi thường trong từng nhóm.
export function flattenSections(sections) {
  const flat = [];
  let n = 1;
  (sections ?? []).forEach((section, si) => {
    (section.groups ?? []).forEach((group, gi) => {
      (group.questions ?? []).forEach((q, qi) => {
        flat.push({ number: n, sectionIndex: si, groupIndex: gi, questionIndex: qi, type: group.type, q });
        n++;
      });
    });
  });
  return flat;
}

export function isIeltsCorrect(entry, value) {
  const { type, q } = entry;
  if (value == null || value === "") return false;
  if (type === "multiple-choice") return Number(value) === q.answerIndex;
  if (type === "tfng") return value === q.answer;
  const accepted = String(q.acceptedAnswers ?? "").split("|").map(normalizeIeltsAnswer).filter(Boolean);
  return accepted.includes(normalizeIeltsAnswer(value));
}

// answers: { [số câu]: giá trị }.
export function gradeIelts(flat, answers) {
  let correct = 0;
  const items = flat.map(entry => {
    const ok = isIeltsCorrect(entry, answers?.[entry.number]);
    if (ok) correct++;
    return {
      qNumber: entry.number,
      studentAnswer: String(answers?.[entry.number] ?? ""),
      correctAnswer: String(entry.q?.answer ?? entry.q?.acceptedAnswers ?? entry.q?.answerIndex ?? ""),
      isCorrect: ok,
    };
  });
  return { correct, total: flat.length, items };
}
