// Điểm vào CHUNG của việc chấm bài — Worker (worker/src/submit.js) gọi `gradeSubmission()` để chấm từ câu trả lời
// thô học sinh gửi lên, không tin điểm do trình duyệt tự tính (chốt 2026-09-25). Module THUẦN.
import { gradeReading } from "./reading.js";
import { flattenPassages, flattenSections, gradeIelts } from "./ielts.js";
import { gradeVocabularyGroups } from "../ketPetVocabulary.js";
import { gradePracticeTestGroups } from "../ketPetPracticeTest.js";
import { serverGrader } from "./listeningExam.js";
import { itemReady } from "./canvasParts.js";

// Dạng bài Worker tự chấm từ câu trả lời thô. Các dạng còn lại (speaking, dictation) chấm ngay trong lúc làm ở
// trình duyệt (phản hồi đúng/sai từng câu) nên Worker chỉ nhận điểm, kẹp hợp lệ, và kiểm soát lượt/hạn/thời gian.
export const SERVER_GRADED = new Set(["reading", "ielts-reading", "ielts-listening", "ketpet-vocab", "ketpet-test", "listening-exam"]);

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
    speaking: "tests",
  }[kind];
  return collection ? { lessonId, collection, docId: String(testId) } : null;
}

const LISTENING_PART_KEYS = ["part1", "part2", "part3", "part4", "part5"];

// Listening luyện đề: Part chấm ở máy chủ dùng câu trả lời thô; Part tô màu/viết vào tranh (canvas) nhận điểm
// trình duyệt gửi, kẹp trong [0, số câu của Part].
function gradeListeningExam(test, raw) {
  const parts = {};
  let correct = 0;
  let total = 0;
  LISTENING_PART_KEYS.forEach(key => {
    const part = test.parts?.[key];
    if (!part) return;
    const clientPart = raw?.parts?.[key];
    if (clientPart === undefined) return; // Part không hiện cho học sinh (chưa soạn)
    const grader = serverGrader(key, part);
    let res;
    if (grader) {
      res = grader(part, clientPart?.answers);
    } else {
      const partTotal = (part.items ?? []).filter(itemReady).length;
      const score = Math.max(0, Math.min(Math.floor(Number(clientPart?.score) || 0), partTotal));
      res = { score, total: partTotal };
    }
    parts[key] = res;
    correct += res.score;
    total += res.total;
  });
  return {
    correct,
    total,
    parts,
    items: Object.entries(parts).map(([part, r]) => ({ part, correct: r.score, total: r.total })),
  };
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
      row.map((ok, qi) => ({ group: gi + 1, qNumber: qi + 1, isCorrect: ok, studentAnswer: String(raw?.[`${gi}-${qi}`] ?? "") })),
    );
    return { correct: g.correct, total: g.total, items, results: g.results };
  }
  if (kind === "listening-exam") return gradeListeningExam(test, raw);
  return null;
}
