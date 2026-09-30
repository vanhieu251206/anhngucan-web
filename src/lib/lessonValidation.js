// Kiểm tra bài đang soạn trong CMS (2026-09-30) — mỗi hàm trả danh sách câu cảnh báo tiếng Việt, rỗng = ổn. Chỉ để
// CẢNH BÁO giáo viên (nhãn "⚠ N chỗ cần kiểm tra" cạnh nút Xuất bản + hỏi lại khi xuất bản), KHÔNG chặn lưu — cùng cách
// Listening luyện đề đã chốt 2026-09-29. Module thuần, không React.
import { countBlanks, normalizeBlankHolder } from "./tableDiagramBlanks.js";
import { splitGapfillText } from "./grading/reading.js";
import { acceptedAnswers as vocabAnswers } from "./grading/vocab.js";
import { normalizeOptions } from "./grading/ielts.js";

const blank = v => !String(v ?? "").trim();
const filled = v => !blank(v);

// Trắc nghiệm: ít nhất 2 lựa chọn, không lựa chọn trống xen giữa, đáp án đúng trỏ vào lựa chọn có chữ.
function checkChoices(where, options, answerIndex, out, { minOptions = 2 } = {}) {
  const opts = options ?? [];
  const count = opts.filter(filled).length;
  // Ô trống ở CUỐI được hiểu là không dùng (câu 2-3 lựa chọn); ô trống nằm GIỮA các lựa chọn là sót.
  const lastFilled = opts.findLastIndex(filled);
  if (count < minOptions) out.push(`${where}: cần ít nhất ${minOptions} lựa chọn.`);
  else if (opts.slice(0, lastFilled).some(blank)) out.push(`${where}: có lựa chọn bị bỏ trống.`);
  if (count >= minOptions && (answerIndex == null || blank(opts[answerIndex]))) out.push(`${where}: chưa chọn đáp án đúng.`);
}

// ---------- Speaking (TestStudio) ----------
export function validateSpeakingScenes(scenes) {
  const out = [];
  if (!(scenes ?? []).length) return ["Chưa có scene nào."];
  scenes.forEach((sc, i) => {
    const w = `Scene ${i + 1}`;
    if (!sc.type) {
      out.push(`${w}: chưa chọn hành động.`);
      return;
    }
    if (blank(sc.examinerLine) && !sc.audioUrl) out.push(`${w}: chưa có câu của giám khảo.`);
    if (sc.type === "mic" && blank(sc.answerTemplate) && blank(sc.expectedKeyword)) out.push(`${w}: chưa có câu trả lời mẫu.`);
    if (sc.type === "scene-click") {
      if (!sc.sceneImage) out.push(`${w}: chưa có ảnh tranh.`);
      if (!sc.target) out.push(`${w}: chưa khoanh vị trí đúng trên tranh.`);
    }
    if (sc.type === "card-select") {
      const opts = sc.options ?? [];
      if (opts.some(o => !o?.image && blank(o?.label))) out.push(`${w}: còn thẻ chưa có ảnh.`);
      if (!(sc.correctIds?.length || sc.correctId)) out.push(`${w}: chưa chọn thẻ đúng.`);
    }
    if (sc.type === "drag-drop") {
      if (!sc.sceneImage) out.push(`${w}: chưa có ảnh tranh.`);
      if (!sc.card?.image && blank(sc.card?.label)) out.push(`${w}: chưa có thẻ để kéo.`);
      if (!sc.target) out.push(`${w}: chưa khoanh vị trí thả đúng.`);
    }
  });
  return out;
}

// ---------- Reading & Writing YLE (ReadingStudio) ----------
function readingQuestionHasContent(q) {
  // Yes/No mặc định sẵn answer "yes" — không tính là đã soạn.
  return filled(q.text) || filled(q.prompt) || (q.type !== "yesno" && filled(q.answer)) || q.image || (q.answers ?? []).some(filled) || (q.options ?? []).some(filled);
}

function partHasContent(part) {
  return (part.questions ?? []).some(q => q.type !== "free-writing" && readingQuestionHasContent(q)) ||
    !!part.image || (part.wordBank ?? []).some(w => filled(typeof w === "string" ? w : w?.word ?? w?.text));
}

function wordBankWords(part) {
  return (part.wordBank ?? []).map(w => (typeof w === "string" ? w : w?.word ?? w?.text ?? "")).filter(filled);
}

export function validateReadingParts(parts) {
  const out = [];
  if (!(parts ?? []).length) return ["Chưa có Part nào."];
  parts.forEach((part, pi) => {
    const pLabel = `Part ${pi + 1}`;
    if (!partHasContent(part)) {
      out.push(`${pLabel}: chưa soạn.`);
      return;
    }
    const bank = wordBankWords(part).map(w => w.trim().toLowerCase());
    if ((part.wordBank ?? []).length && (part.wordBank ?? []).some(w => blank(typeof w === "string" ? w : w?.word ?? w?.text))) {
      out.push(`${pLabel}: ngân hàng từ còn ô trống.`);
    }
    (part.questions ?? []).forEach((q, qi) => {
      const w = `${pLabel} – Câu ${qi + 1}`;
      if (q.type === "free-writing") return;
      if (q.type === "yesno") {
        if (blank(q.text)) out.push(`${w}: chưa có câu.`);
        if (part.fixedLayout === "starters-part1" && !q.image) out.push(`${w}: chưa có ảnh.`);
      } else if (q.type === "gapfill") {
        const gaps = splitGapfillText(q.text).length - 1;
        if (gaps <= 0) out.push(`${w}: đoạn văn chưa có chỗ trống "___".`);
        const offset = q.firstGapIsExample ? 1 : 0;
        const answers = q.answers ?? [];
        if (answers.length < gaps) out.push(`${w}: số đáp án ít hơn số chỗ trống.`);
        const missing = answers.slice(offset, gaps).filter(blank).length;
        if (missing) out.push(`${w}: còn ${missing} chỗ trống chưa có đáp án.`);
      } else if (q.type === "short-answer") {
        if (blank(q.prompt) && blank(q.text) && !q.image) out.push(`${w}: chưa có câu hỏi.`);
        if (blank(q.answer)) out.push(`${w}: chưa có đáp án.`);
      } else if (q.type === "word-scramble") {
        if (blank(q.answer)) out.push(`${w}: chưa có từ đáp án.`);
        if (!q.image) out.push(`${w}: chưa có ảnh.`);
      } else if (q.type === "multiple-choice") {
        checkChoices(w, q.options, q.answerIndex, out);
      } else if (q.type === "word-bank") {
        if (blank(q.text)) out.push(`${w}: chưa có câu.`);
        if (blank(q.answer)) out.push(`${w}: chưa có đáp án.`);
        else if (bank.length && !String(q.answer).split("|").some(a => bank.includes(a.trim().toLowerCase()))) {
          out.push(`${w}: đáp án "${q.answer}" không có trong ngân hàng từ.`);
        }
      }
    });
  });
  return out;
}

// ---------- Dictation ----------
export function validateDictation(sentences) {
  const out = [];
  if (!(sentences ?? []).length) return ["Chưa có câu nào."];
  sentences.forEach((s, i) => {
    if (!s.audioUrl) out.push(`Câu ${i + 1}: chưa có audio.`);
    if (blank(s.text)) out.push(`Câu ${i + 1}: chưa có câu đúng.`);
  });
  return out;
}

// ---------- Vocabulary YLE ----------
export function validateVocabItems(items) {
  const out = [];
  if (!(items ?? []).length) return ["Chưa có câu nào."];
  items.forEach((it, i) => {
    const w = `Câu ${i + 1}`;
    if (it.type === "picture" && !it.imageUrl) out.push(`${w}: chưa có hình.`);
    if (it.type === "listen" && !it.audioUrl) out.push(`${w}: chưa có audio.`);
    if (it.type === "definition" && blank(it.definition)) out.push(`${w}: chưa có định nghĩa.`);
    const answers = vocabAnswers(it.answer);
    if (!answers.length) out.push(`${w}: chưa có đáp án.`);
    else if (it.type === "scramble" && answers[0].length < 2) out.push(`${w}: từ quá ngắn để xáo chữ.`);
  });
  return out;
}

// ---------- IELTS: nhóm câu hỏi dùng chung cho Reading (Luyện đề) và Listening ----------
function validateIeltsGroups(groups, prefix, out) {
  (groups ?? []).forEach((g, gi) => {
    const gw = `${prefix}Nhóm ${gi + 1}`;
    if (g.type === "table-diagram") {
      const holders = [
        ...(g.table?.rows ?? []).flatMap(r => r.cells ?? []),
        ...(g.paragraphs ?? []),
      ].map(normalizeBlankHolder);
      const total = holders.reduce((n, h) => n + countBlanks(h.text), 0) + (g.diagramPoints ?? []).length;
      if (!total) out.push(`${gw}: chưa có chỗ trống "___" nào.`);
      const missing = holders.reduce((n, h) => {
        const count = countBlanks(h.text);
        return n + Array.from({ length: count }, (_, k) => h.answers[k]).filter(blank).length;
      }, 0) + (g.diagramPoints ?? []).filter(p => blank(p?.answer)).length;
      if (missing) out.push(`${gw}: còn ${missing} chỗ trống chưa có đáp án.`);
      return;
    }
    if (g.type === "diagram") {
      if (!g.diagramImage) out.push(`${gw}: chưa có ảnh sơ đồ.`);
      const pts = g.diagramPoints ?? [];
      if (!pts.length) out.push(`${gw}: chưa đánh dấu điểm nào trên sơ đồ.`);
      const missing = pts.filter(p => blank(p?.answer)).length;
      if (missing) out.push(`${gw}: còn ${missing} điểm chưa có đáp án.`);
      return;
    }
    if (g.type === "matching") {
      const opts = normalizeOptions(g.optionsList);
      if (!opts.length) out.push(`${gw}: chưa có danh sách lựa chọn.`);
      const keys = opts.map(o => o.key.toLowerCase());
      if (keys.some(k => !k)) out.push(`${gw}: có lựa chọn chưa có ký hiệu (i, ii, A, B...) — học sinh sẽ không chọn được.`);
      if (new Set(keys.filter(Boolean)).size < keys.filter(Boolean).length) out.push(`${gw}: có ký hiệu lựa chọn bị trùng.`);
      (g.items ?? []).forEach((it, ii) => {
        if (it.isExample || blank(it.answerKey)) return;
        const ok = String(it.answerKey).split("|").some(a => keys.includes(a.trim().toLowerCase()));
        if (!ok && keys.some(Boolean)) out.push(`${gw} – Mục ${ii + 1}: đáp án "${it.answerKey}" không có trong danh sách lựa chọn.`);
      });
      const items = (g.items ?? []).filter(it => !it.isExample);
      if (!items.length) out.push(`${gw}: chưa có câu nào.`);
      const missing = items.filter(it => blank(it.answerKey)).length;
      if (missing) out.push(`${gw}: còn ${missing} câu chưa có đáp án.`);
      return;
    }
    const qs = g.questions ?? [];
    if (!qs.length) out.push(`${gw}: chưa có câu hỏi.`);
    qs.forEach((q, qi) => {
      const w = `${gw} – Câu ${qi + 1}`;
      if (g.type === "multiple-choice") {
        if (blank(q.text)) out.push(`${w}: chưa có câu hỏi.`);
        checkChoices(w, q.options, q.answerIndex, out);
      } else if (g.type === "tfng") {
        if (blank(q.text)) out.push(`${w}: chưa có câu.`);
      } else if (blank(q.acceptedAnswers)) {
        out.push(`${w}: chưa có đáp án.`);
      }
    });
  });
}

export function validateIeltsPracticePassage(passage, practiceText) {
  const out = [];
  if (blank(passage?.title)) out.push("Chưa có tên bài đọc.");
  if (blank(practiceText)) out.push("Chưa có bài đọc.");
  if (!(passage?.groups ?? []).length) out.push("Chưa có nhóm câu hỏi nào.");
  validateIeltsGroups(passage?.groups, "", out);
  return out;
}

export function validateComprehension({ title, sentences }) {
  const out = [];
  if (blank(title)) out.push("Chưa có tên bài đọc.");
  if (!(sentences ?? []).length) return [...out, "Chưa có câu nào."];
  sentences.forEach((s, i) => {
    if (blank(s.en)) out.push(`Câu ${i + 1}: chưa có câu tiếng Anh.`);
    if (blank(s.vi)) out.push(`Câu ${i + 1}: chưa có bản dịch.`);
    (s.vocab ?? []).forEach((v, vi) => {
      if (blank(v.termDef) || blank(v.meaning)) out.push(`Câu ${i + 1} – Từ vựng ${vi + 1}: còn ô trống.`);
    });
  });
  return out;
}

export function validateIeltsListening(sections) {
  const out = [];
  if (!(sections ?? []).length) return ["Chưa có section nào."];
  sections.forEach((s, si) => {
    const p = `Section ${si + 1} – `;
    if (!s.audioUrl) out.push(`Section ${si + 1}: chưa có audio.`);
    if (!(s.groups ?? []).length) out.push(`Section ${si + 1}: chưa có nhóm câu hỏi.`);
    validateIeltsGroups(s.groups, p, out);
  });
  return out;
}

// ---------- KET/PET (Vocabulary + Practice Test — cùng dạng "nhóm I, II, III...") ----------
export function validateKetPetGroups(groups) {
  const out = [];
  if (!(groups ?? []).length) return ["Chưa có nhóm câu hỏi nào."];
  groups.forEach((g, gi) => {
    const gw = `Nhóm ${gi + 1}`;
    const qs = g.questions ?? [];
    if (!qs.length) {
      out.push(`${gw}: chưa có câu hỏi.`);
      return;
    }
    if (g.type === "translation") return;
    if (g.type === "word-bank" && !(g.wordBank ?? []).filter(filled).length) out.push(`${gw}: chưa có khung từ.`);
    if (g.type === "categorize" && (g.columns ?? []).some(blank)) out.push(`${gw}: còn cột chưa đặt tên.`);
    const bank = (g.wordBank ?? []).map(w => String(w).trim().toLowerCase());
    qs.forEach((q, qi) => {
      const w = `${gw} – Câu ${qi + 1}`;
      const type = g.type === "split-reading" ? q.type : g.type;
      if (type === "multiple-choice") {
        checkChoices(w, q.options, q.answerIndex, out);
      } else if (type === "pronunciation-underline") {
        checkChoices(w, q.options, q.answerIndex, out);
      } else if (type === "fill-blank" || type === "word-scramble" || type === "listen-and-type") {
        if (!(q.acceptedAnswers ?? []).some(filled)) out.push(`${w}: chưa có đáp án.`);
        if (type === "listen-and-type" && !q.audioUrl) out.push(`${w}: chưa có audio.`);
        if (type === "word-scramble" && !(q.words ?? []).length) out.push(`${w}: chưa có các từ xáo trộn.`);
      } else if (type === "word-bank") {
        if (blank(q.answer)) out.push(`${w}: chưa có đáp án.`);
        else if (bank.length && !bank.includes(String(q.answer).trim().toLowerCase())) out.push(`${w}: đáp án "${q.answer}" không có trong khung từ.`);
      } else if (type === "open-ended") {
        if (blank(q.sampleAnswer)) out.push(`${w}: chưa có đáp án.`);
      } else if (type === "categorize" || type === "true-false-table" || type === "reorder") {
        if (blank(q.text)) out.push(`${w}: chưa có nội dung.`);
      }
    });
  });
  return out;
}
