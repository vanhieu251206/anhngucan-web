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

// Câu của 1 nhóm: mỗi chỗ trống bảng/đoạn văn/sơ đồ (table-diagram, diagram) cũng là 1 câu.
function groupQuestions(group) {
  if (group.type === "table-diagram") return deriveTableDiagramBlanks(group);
  if (group.type === "diagram") return (group.diagramPoints ?? []).map(p => ({ acceptedAnswers: p.answer ?? "" }));
  return group.questions ?? [];
}

// Đề tải lên (PDF/Word, 2026-10-31 — cùng kiểu KET/PET, lib/ketPetPracticeTest.js): nhóm "answer-sheet" = phiếu trả
// lời, mỗi câu tự mang dạng (`q.type` "multiple-choice" A-E / "fill-blank" gõ chữ, `acceptedAnswers` là MẢNG). Câu
// tắt (`q.skip`) vẫn giữ số thứ tự nhưng không tính điểm.
function flattenContainers(containers, indexKey) {
  const flat = [];
  let n = 1;
  (containers ?? []).forEach((c, ci) => {
    (c?.groups ?? []).forEach((group, gi) => {
      const sheet = group.type === "answer-sheet";
      groupQuestions(group).forEach((q, qi) => {
        if (!(sheet && q?.skip)) flat.push({ number: n, [indexKey]: ci, groupIndex: gi, questionIndex: qi, type: sheet ? q.type : group.type, q });
        n++;
      });
    });
  });
  return flat;
}

export function flattenPassages(passages) {
  return flattenContainers(passages, "passageIndex");
}

export function flattenSections(sections) {
  return flattenContainers(sections, "sectionIndex");
}

// Số câu đầu tiên của từng passage/section trong cả Test (Passage 2 bắt đầu từ câu 14...) — để phiếu trả lời đề tải
// lên đánh số khớp với đề giấy khi học sinh làm riêng từng passage.
export function firstQuestionNumbers(containers) {
  const out = [];
  let n = 1;
  (containers ?? []).forEach(c => {
    out.push(n);
    (c?.groups ?? []).forEach(group => {
      n += groupQuestions(group).length;
    });
  });
  return out;
}

function acceptedList(q) {
  const raw = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.join("|") : String(q.acceptedAnswers ?? "");
  return raw.split("|").map(s => s.trim()).filter(Boolean);
}

export function isIeltsCorrect(entry, value) {
  const { type, q } = entry;
  if (value == null || value === "") return false;
  if (type === "multiple-choice") return Number(value) === q.answerIndex;
  if (type === "tfng") return value === q.answer;
  const accepted = acceptedList(q).map(normalizeIeltsAnswer).filter(Boolean);
  return accepted.includes(normalizeIeltsAnswer(value));
}

// answers: { [số câu]: giá trị }.
export function gradeIelts(flat, answers) {
  let correct = 0;
  const items = flat.map(entry => {
    const ok = isIeltsCorrect(entry, answers?.[entry.number]);
    if (ok) correct++;
    const value = answers?.[entry.number];
    const q = entry.q ?? {};
    // Trắc nghiệm: ghi "B. nội dung" thay vì số thứ tự lựa chọn.
    // Phiếu đề tải lên: lựa chọn chính là chữ cái → chỉ ghi "B".
    const option = i => {
      if (i == null || i === "" || q.options?.[Number(i)] == null) return "";
      const letter = String.fromCharCode(65 + Number(i));
      return q.options[Number(i)] === letter ? letter : `${letter}. ${q.options[Number(i)]}`;
    };
    const mc = entry.type === "multiple-choice";
    return {
      qNumber: entry.number,
      prompt: String(q.text ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 160),
      studentAnswer: mc ? option(value) : String(value ?? ""),
      correctAnswer: mc ? option(q.answerIndex) : q.answer != null ? String(q.answer) : acceptedList(q).join(" / "),
      isCorrect: ok,
    };
  });
  return { correct, total: flat.length, items };
}

// Lựa chọn của danh sách dùng chung (List of Headings, A/B/C...): { key, text }. Nếu ô ký hiệu bị bỏ trống mà ký hiệu
// dính ở đầu nội dung (vd dán nguyên dòng "i<Tab>Seeking the transmission...") thì tách ra — ký hiệu rỗng làm mọi lựa
// chọn trùng nhau: học sinh bấm câu nào cũng thành chọn hết, và chấm sai hết (lỗi thật 2026-09-30, IELTS 9 Test 1).
const OPTION_KEY_RE = /^\s*\(?([ivxlcdm]{1,6}|[A-Za-z]|\d{1,2})[.)]?(?:\s+|\t+)(\S.*)$/i;
export function normalizeOption(o) {
  const key = String(o?.key ?? "").trim();
  const text = String(o?.text ?? "");
  if (key) return { key, text: text.trim() };
  const m = text.match(OPTION_KEY_RE);
  return m ? { key: m[1], text: m[2].trim() } : { key: "", text: text.trim() };
}
export function normalizeOptions(options) {
  return (options ?? []).map(normalizeOption);
}
