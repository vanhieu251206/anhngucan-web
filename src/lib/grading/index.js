// Điểm vào CHUNG của việc chấm bài — Worker (worker/src/submit.js) gọi `gradeSubmission()` để chấm từ câu trả lời
// thô học sinh gửi lên, không tin điểm do trình duyệt tự tính (chốt 2026-09-25). Module THUẦN.
import { gradeReading } from "./reading.js";
import { flattenPassages, flattenSections, gradeIelts } from "./ielts.js";
import { gradeVocabularyGroups } from "../ketPetVocabulary.js";
import { gradePracticeTestGroups, openEndedFullAnswer } from "../ketPetPracticeTest.js";
import { serverGrader, gradeCanvasPart } from "./listeningExam.js";
import { isWriteItem, itemReady } from "./canvasParts.js";
import { gradeVocabItems } from "./vocab.js";

// Dạng bài Worker tự chấm từ câu trả lời thô. Các dạng còn lại (speaking, dictation) chấm ngay trong lúc làm ở
// trình duyệt (phản hồi đúng/sai từng câu) nên Worker chỉ nhận điểm, kẹp hợp lệ, và kiểm soát lượt/hạn/thời gian.
export const SERVER_GRADED = new Set(["reading", "ielts-reading", "ielts-listening", "ketpet-vocab", "ketpet-test", "listening-exam", "yle-vocab"]);

// Vị trí đề trong Firestore theo loại bài (mode lưu ở testResults/attempts).
export function testLocation(kind, seriesId, level, testId) {
  const lessonId = `${seriesId}-${level}`;
  const collection = {
    reading: "readingTests",
    "ielts-reading": "practiceTests",
    "ielts-listening": "listeningTests",
    "ketpet-vocab": "vocabularyUnits",
    "ketpet-test": "practiceTests",
    "listening-exam": "listeningExamTests",
    dictation: "dictationTests",
    "yle-vocab": "vocabTests",
    speaking: "tests",
  }[kind];
  return collection ? { lessonId, collection, docId: String(testId) } : null;
}

const LISTENING_PART_KEYS = ["part1", "part2", "part3", "part4", "part5"];

// Listening luyện đề: Part chấm ở máy chủ dùng câu trả lời thô; Part tô màu/viết vào tranh (canvas) nhận điểm
// trình duyệt gửi, kẹp trong [0, số câu của Part].
function gradeListeningExam(test, raw) {
  const parts = {};
  const items = [];
  let correct = 0;
  let total = 0;
  LISTENING_PART_KEYS.forEach(key => {
    const part = test.parts?.[key];
    if (!part) return;
    const clientPart = raw?.parts?.[key];
    if (clientPart === undefined) return; // Part không hiện cho học sinh (chưa soạn)
    const grader = serverGrader(key, part);
    const res = grader ? grader(part, clientPart?.answers) : gradeCanvasPart(part, clientPart, isWriteItem, itemReady);
    parts[key] = { score: res.score, total: res.total };
    correct += res.score;
    total += res.total;
    // Chi tiết từng câu, gom theo Part bằng `section` (ResultItems.jsx / resultSheetPdf.js vẽ dòng tiêu đề Part).
    items.push(...res.items.map(it => ({ section: `Part ${key.slice(4)}`, ...it })));
  });
  return { correct, total, parts, items };
}

const stripTags = s => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const letter = i => String.fromCharCode(65 + i);
const optionText = (options, i) => (Number.isInteger(i) && options?.[i] != null ? `${letter(i)}. ${stripTags(options[i])}` : "");
const joinAnswers = list => (Array.isArray(list) ? list : String(list ?? "").split("|")).map(s => String(s).trim()).filter(Boolean).join(" / ");
const tfText = v => (v === true ? "True" : v === false ? "False" : "");

// KET/PET: đề bài + câu trả lời + đáp án đúng ở dạng CHỮ đọc được (trắc nghiệm ghi "B. ..." thay vì số thứ tự).
function ketPetDetail(g, q, qi, value) {
  const type = g.type === "split-reading" ? q.type : g.type;
  const prompt = stripTags(q.text ?? q.prompt ?? (Array.isArray(q.words) ? q.words.join(" / ") : "")).slice(0, 160);
  const typed = String(value ?? "");
  if (type === "multiple-choice" || type === "pronunciation-underline") {
    return { prompt, studentAnswer: optionText(q.options, value), correctAnswer: optionText(q.options, q.answerIndex) };
  }
  if (type === "true-false-table") return { prompt, studentAnswer: tfText(value), correctAnswer: tfText(q.answer) };
  if (type === "categorize") {
    const col = v => (v == null || v === "" ? "" : String(g.columns?.[Number(v)] ?? ""));
    return { prompt, studentAnswer: col(value), correctAnswer: col(q.columnIndex) };
  }
  if (type === "reorder") return { prompt, studentAnswer: typed, correctAnswer: String(q.correctPos ?? qi + 1) };
  if (type === "word-bank") return { prompt, studentAnswer: typed, correctAnswer: String(q.answer ?? "") };
  if (type === "open-ended" || type === "translation") {
    return { prompt, studentAnswer: typed.trim() ? openEndedFullAnswer(q.hint, typed) : "", correctAnswer: joinAnswers(q.sampleAnswer) };
  }
  if (type === "free-response") return { prompt, studentAnswer: typed.trim() ? openEndedFullAnswer(q.hint, typed) : "" };
  if (Array.isArray(q.blanks)) {
    // Nhiều ô trống: ghi lần lượt từng ô, ngăn bằng " ; " (ô bỏ trống ghi "…").
    const cells = Array.isArray(value) ? value : [value];
    const any = cells.some(c => String(c ?? "").trim());
    return {
      prompt,
      studentAnswer: any ? q.blanks.map((_, i) => String(cells[i] ?? "").trim() || "…").join(" ; ") : "",
      correctAnswer: q.blanks.map(joinAnswers).join(" ; "),
    };
  }
  return { prompt, studentAnswer: typed, correctAnswer: joinAnswers(q.acceptedAnswers) };
}

// raw — dạng câu trả lời theo từng loại:
//   reading: answers[partIndex][qIndex]        ielts-*: { [số câu]: giá trị }
//   ketpet-*: { "gi-qi": giá trị }             listening-exam: { parts: { part1: { answers }, part4: { score } ... } }
export function gradeSubmission(kind, test, raw) {
  if (kind === "reading") {
    const r = gradeReading(test.parts ?? [], raw, test.seriesId);
    return { correct: r.earnedPoints, total: r.totalPoints, items: r.items };
  }
  if (kind === "ielts-reading") return gradeIelts(flattenPassages(test.passages), raw);
  if (kind === "ielts-listening") return gradeIelts(flattenSections(test.sections), raw);
  if (kind === "ketpet-vocab" || kind === "ketpet-test") {
    const groups = test.groups ?? [];
    const g = kind === "ketpet-vocab" ? gradeVocabularyGroups(groups, raw) : gradePracticeTestGroups(groups, raw);
    const items = g.results.flatMap((row, gi) =>
      // Tự luận: ketPetDetail ghép cả phần gợi ý cô cho sẵn để phiếu chấm/kết quả hiện đủ câu học sinh viết.
      // Câu không chấm điểm (results = null): đánh dấu để trang kết quả/phiếu chấm không hiện "Sai".
      row.map((ok, qi) => ({
        group: gi + 1,
        qNumber: (Number(groups[gi]?.startNumber) || 1) + qi,
        isCorrect: ok,
        ...ketPetDetail(groups[gi], groups[gi].questions?.[qi] ?? {}, qi, raw?.[`${gi}-${qi}`]),
        ...(ok == null ? { ungraded: true } : {}),
      })),
    );
    return { correct: g.correct, total: g.total, items, results: g.results };
  }
  if (kind === "listening-exam") return gradeListeningExam(test, raw);
  if (kind === "yle-vocab") {
    const g = gradeVocabItems(test.items ?? [], raw);
    return { correct: g.correct, total: g.total, items: g.items };
  }
  return null;
}
