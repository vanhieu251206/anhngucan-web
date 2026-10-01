// Đọc file .txt soạn sẵn thành danh sách NHÓM câu hỏi Practice Test KET/PET (lib/ketPetPracticeTest.js) — để nhập
// cả đề 1 lần thay vì gõ tay từng câu trong CMS. Module THUẦN. Định dạng (viết gần giống trang sách):
//
//   # dòng bắt đầu bằng # là ghi chú, bỏ qua
//   Exercise 1: Choose the word whose underlined part is pronounced differently.
//   Dạng: phát âm                      ← bỏ dòng này thì tự đoán theo nội dung câu
//   Điểm: 10                           ← tổng điểm cả nhóm; bỏ thì mỗi câu 1 điểm
//   Khung từ: ant, dog, cat            ← chỉ dạng "khung từ"
//   Đoạn văn:                          ← tuỳ chọn; kéo dài tới câu đầu tiên
//   ...
//   1. A. [s]lang   B. [s]ugar   C. [s]ize   D. [s]ong      ← [..] = gạch chân
//   Đáp án: B
//   2. The sofa is ______ the window.
//   → b _ _ _ _ _ _                    ← dòng "→" (hoặc "->") = gợi ý / từ cho sẵn đầu câu
//   Đáp án: between | beside           ← nhiều cách viết ngăn bằng |
//   Sau câu: Linda: Thanks!            ← câu thoại hiện ngay sau ô trả lời (chỉ dạng "không chấm")
//
//   Tiêu đề: PRACTICE TEST FOR UNIT 2  ← tiêu đề lớn hiện trên nhóm kế tiếp
//   Nhóm: Mark the letter A, B, C or D ← mở nhóm KHÔNG có nhãn "Exercise N" (sách chỉ in câu hướng dẫn)
//   Mục: 1. Suggestion                 ← mục con của Exercise; từ mục thứ 2 tự mở nhóm nối tiếp không lặp đầu đề
//   Yêu cầu: Write TRUE or FALSE...    ← dòng hướng dẫn nằm SAU đoạn văn
//   Số câu ghi trong file được giữ nguyên (nhóm bắt đầu từ câu 17 thì web hiện Question 17, 18...).
//
// Dạng: trắc nghiệm | phát âm | điền từ | khung từ | đọc hiểu | tự luận | đúng sai | không chấm.
import { blankGroup } from "./ketPetPracticeTest.js";

// Tên dòng mở nhóm (đã bỏ dấu): "Exercise 7:" → nhóm có nhãn; "Nhóm:" → nhóm không nhãn (sách không in "Exercise").
const LABELED_HEADER = /^(exercise|bai|part)\s+[\w.]+$/;
const PLAIN_HEADER = /^nhom(\s+[\w.]+)?$/;
const QUESTION_LINE = /^(\d+)\s*[.)]\s*(.*)$/;
const HINT_LINE = /^(?:→|->)\s*(.*)$/;

function plain(str) {
  return String(str ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
}

function resolveType(value) {
  const v = plain(value);
  if (/phat am|gach chan|underline/.test(v)) return "pronunciation-underline";
  if (/khong cham|free/.test(v)) return "free-response";
  if (/dung\s*\/?\s*sai|true/.test(v)) return "true-false-table";
  if (/khung tu|word\s*(bank|box)/.test(v)) return "word-bank";
  if (/doc hieu|split/.test(v)) return "split-reading";
  if (/trac nghiem|multiple/.test(v)) return "multiple-choice";
  if (/dien|fill/.test(v)) return "fill-blank";
  if (/tu luan|viet|open/.test(v)) return "open-ended";
  return null;
}

// "His uncle ... A. attic  B. toilet  C. hall  D. bathroom" → { text, options }. null nếu không thấy ≥ 2 đáp án.
function splitOptions(body) {
  const marks = [];
  let from = 0;
  for (const letter of "ABCD") {
    const re = new RegExp(`(^|\\s)${letter}[.)]\\s*`, "g");
    re.lastIndex = from;
    const m = re.exec(body);
    if (!m) break;
    marks.push({ start: m.index + m[1].length, end: re.lastIndex });
    from = re.lastIndex;
  }
  if (marks.length < 2) return null;
  return {
    text: body.slice(0, marks[0].start).trim(),
    options: marks.map((mk, i) => body.slice(mk.end, marks[i + 1]?.start ?? body.length).trim()),
  };
}

function parseTrueFalse(answer) {
  const v = plain(answer);
  if (/^(t|true|dung)$/.test(v)) return true;
  if (/^(f|false|sai)$/.test(v)) return false;
  return null;
}

const answerList = answer => String(answer ?? "").split("|").map(s => s.trim()).filter(Boolean);

function guessType(raws) {
  const withOptions = raws.filter(r => splitOptions(r.body));
  if (withOptions.length === raws.length) {
    return raws.some(r => /\[[^\]]+\]/.test(r.body)) ? "pronunciation-underline" : "multiple-choice";
  }
  if (raws.every(r => parseTrueFalse(r.answer) != null)) return "true-false-table";
  if (raws.some(r => r.hint.includes("_"))) return "fill-blank";
  if (raws.some(r => r.answer)) return "open-ended";
  return "free-response";
}

function buildChoice(raw, underline, where, errors) {
  const parsed = splitOptions(raw.body);
  if (!parsed) {
    errors.push(`${where}: không tìm thấy các đáp án A. B. C. D.`);
    return null;
  }
  const answerIndex = "ABCD".indexOf(raw.answer.trim().toUpperCase().charAt(0));
  if (!raw.answer.trim() || answerIndex < 0 || answerIndex >= parsed.options.length) {
    errors.push(`${where}: thiếu "Đáp án:" (A, B, C hoặc D).`);
    return null;
  }
  if (underline) return { options: parsed.options.map(o => o.replace(/\[([^\]]+)\]/g, "<u>$1</u>")), answerIndex };
  return { text: parsed.text, options: parsed.options, answerIndex };
}

function buildQuestion(type, raw, where, errors) {
  if (type === "multiple-choice") return buildChoice(raw, false, where, errors);
  if (type === "pronunciation-underline") return buildChoice(raw, true, where, errors);
  if (type === "fill-blank") return { text: raw.body, hint: raw.hint, acceptedAnswers: answerList(raw.answer) };
  if (type === "word-bank") return { text: raw.body, answer: raw.answer.trim() };
  if (type === "split-reading") {
    if (splitOptions(raw.body)) {
      const q = buildChoice(raw, false, where, errors);
      return q && { type: "multiple-choice", ...q };
    }
    return { type: "fill-blank", text: raw.body, acceptedAnswers: answerList(raw.answer) };
  }
  if (type === "true-false-table") {
    const answer = parseTrueFalse(raw.answer);
    if (answer == null) {
      errors.push(`${where}: thiếu "Đáp án:" (True hoặc False).`);
      return null;
    }
    return { text: raw.body, answer };
  }
  if (type === "free-response") return { prompt: raw.body, hint: raw.hint, ...(raw.after ? { after: raw.after } : {}) };
  return { prompt: raw.body, hint: raw.hint, sampleAnswer: answerList(raw.answer).join(" | ") };
}

// Trả về { groups, errors } — errors là danh sách dòng mô tả lỗi (rỗng = đọc được hết).
export function parsePracticeTestText(source) {
  const lines = String(source ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const errors = [];
  const drafts = [];
  let draft = null;
  let question = null;
  let inPassage = false;
  let pendingSection = "";

  function openDraft(lineNo, fields) {
    draft = { lineNo, label: "", instruction: "", subtitle: "", task: "", typeText: "", points: null, wordBank: [], passage: [], raws: [], section: pendingSection, ...fields };
    drafts.push(draft);
    pendingSection = "";
    question = null;
    inPassage = false;
  }

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    const lineNo = i + 1;
    if (line.startsWith("#")) return;

    const colon = line.indexOf(":");
    const key = colon > 0 ? plain(line.slice(0, colon)) : "";
    const value = colon > 0 ? line.slice(colon + 1).trim() : "";

    if (key === "tieu de") { pendingSection = value; return; }
    if (LABELED_HEADER.test(key)) { openDraft(lineNo, { label: line.slice(0, colon).trim(), instruction: value }); return; }
    if (PLAIN_HEADER.test(key)) { openDraft(lineNo, { instruction: value }); return; }
    if (key === "muc") {
      // Mục con (a, b / 1, 2...) của cùng 1 Exercise: mục đầu gắn vào nhóm đang mở, các mục sau mở nhóm nối tiếp không có đầu đề.
      if (!draft) errors.push(`Dòng ${lineNo}: "Mục:" nằm trước dòng "Exercise N: ...".`);
      else if (draft.raws.length) openDraft(lineNo, { subtitle: value, typeText: draft.typeText });
      else { draft.subtitle = value; inPassage = false; }
      return;
    }
    if (!draft) {
      if (line) errors.push(`Dòng ${lineNo}: nội dung nằm trước dòng "Exercise N: ...".`);
      return;
    }

    const qm = line.match(QUESTION_LINE);
    if (qm) {
      question = { lineNo, number: qm[1], body: qm[2].trim(), hint: "", answer: "" };
      draft.raws.push(question);
      inPassage = false;
      return;
    }
    if (!question && key === "yeu cau") { draft.task = value; inPassage = false; return; }
    if (inPassage) {
      draft.passage.push(rawLine.trimEnd());
      return;
    }
    if (!line) return;

    if (key === "dap an") {
      if (question) question.answer = value;
      else errors.push(`Dòng ${lineNo}: "Đáp án:" không thuộc câu nào.`);
      return;
    }
    if (question && key === "sau cau") { question.after = value; return; }
    if (!question && key === "dang") { draft.typeText = value; return; }
    if (!question && key === "diem") { draft.points = Number(value.replace(",", ".")); return; }
    if (!question && key === "khung tu") { draft.wordBank = value.split(",").map(s => s.trim()).filter(Boolean); return; }
    if (!question && key === "doan van") {
      inPassage = true;
      if (value) draft.passage.push(value);
      return;
    }

    const hint = line.match(HINT_LINE);
    if (hint && question) { question.hint = hint[1].trim(); return; }
    if (question) question.body = `${question.body} ${line}`.trim();
    else draft.instruction = `${draft.instruction} ${line}`.trim();
  });

  const groups = drafts.map((d, di) => {
    const where = `Nhóm thứ ${di + 1} (dòng ${d.lineNo})`;
    if (!d.raws.length) {
      errors.push(`${where}: chưa có câu nào.`);
      return null;
    }
    const type = d.typeText ? resolveType(d.typeText) : guessType(d.raws);
    if (!type) {
      errors.push(`${where}: không hiểu "Dạng: ${d.typeText}".`);
      return null;
    }
    if (d.points != null && !(d.points >= 0)) errors.push(`${where}: "Điểm:" phải là số.`);
    const questions = d.raws.map(raw => buildQuestion(type, raw, `Dòng ${raw.lineNo} (câu ${raw.number})`, errors));
    const startNumber = Number(d.raws[0].number);
    return {
      ...blankGroup(type),
      label: d.label,
      instruction: d.instruction,
      passage: d.passage.join("\n").trim(),
      ...(d.section ? { section: d.section } : {}),
      ...(d.subtitle ? { subtitle: d.subtitle } : {}),
      ...(d.task ? { task: d.task } : {}),
      ...(startNumber !== 1 ? { startNumber } : {}),
      ...(type === "word-bank" ? { wordBank: d.wordBank } : {}),
      totalPoints: type === "free-response" ? 0 : d.points ?? questions.length,
      questions,
    };
  });

  if (!drafts.length && !errors.length) errors.push('Không thấy dòng "Exercise N: ..." nào trong file.');
  return { groups: errors.length ? [] : groups, errors };
}
