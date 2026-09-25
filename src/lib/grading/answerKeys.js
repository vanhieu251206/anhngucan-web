// Tách ĐÁP ÁN khỏi đề bài (chốt 2026-09-25, "sửa tận gốc" chống học sinh đọc đáp án/sửa điểm): đề học sinh tải về
// (lessons/{lessonId}/{collection}/{docId}) KHÔNG còn đáp án; đáp án nằm ở answerKeys/{keyDocId} — chỉ admin/giáo
// viên/tài khoản đặc biệt và Worker chấm bài (service account) đọc được (firestore.rules). Module THUẦN, dùng chung
// cho CMS (lưu = tách, mở soạn = ghép lại), trang làm bài của giáo viên (ghép để xem đáp án) và Worker (ghép để chấm).
//
// Cách lưu: `entries` = danh sách [đường dẫn, giá trị] của từng field đáp án đã gỡ khỏi đề (vd
// [["parts",0,"questions",3,"answer"], "cat"]), lưu dạng CHUỖI JSON (Firestore không cho mảng lồng mảng). Đề và khoá
// luôn được ghi CÙNG 1 lần (writeBatch) nên đường dẫn luôn khớp. Những thứ học sinh vẫn cần thấy khi làm bài thì GIỮ
// trong đề: câu ví dụ mẫu (có sẵn đáp án như đề thật), độ dài mảng chỗ trống (để đếm số ô), chữ cái đã xáo của dạng
// xếp chữ (`scrambled`), độ dài đáp án (`answerLength`), số câu Part 1 Listening (`questionCount`).
import { scrambleWord } from "./reading.js";

// Loại bài theo (collection, lessonId) — practiceTests dùng chung tên collection cho IELTS Reading và KET/PET.
export function answerKind(collection, lessonId) {
  if (collection === "readingTests") return "reading";
  if (collection === "listeningTests") return "ielts-listening";
  if (collection === "vocabularyUnits") return "ketpet-vocab";
  if (collection === "listeningExamTests") return "listening-exam";
  if (collection === "practiceTests") return String(lessonId).startsWith("ket-pet") ? "ketpet-test" : "ielts-reading";
  return null;
}

export function answerKeyDocId(lessonId, collection, docId) {
  return `${lessonId}__${collection}__${docId}`;
}

// Field chứa nội dung cần tách của từng loại.
const CONTENT_FIELD = {
  reading: "parts",
  "ielts-reading": "passages",
  "ielts-listening": "sections",
  "ketpet-test": "groups",
  "ketpet-vocab": "groups",
  "listening-exam": "parts",
};

function makeTaker(entries) {
  return function take(obj, key, path) {
    if (obj && typeof obj === "object" && key in obj && obj[key] !== undefined) {
      entries.push([[...path, key], obj[key]]);
      delete obj[key];
    }
  };
}

// Xáo cố định (không random) — cùng 1 đề luôn ra cùng 1 thứ tự, và khác thứ tự gốc khi có ≥ 2 câu.
function fixedPermutation(n) {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return idx;
  let seed = n * 7919 + 17;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  if (idx.every((v, i) => v === i)) idx.push(idx.shift());
  return idx;
}

function splitReading(parts, take, entries) {
  (parts ?? []).forEach((part, pi) => {
    (part?.questions ?? []).forEach((q, qi) => {
      const base = ["parts", pi, "questions", qi];
      if (Array.isArray(q.answers)) {
        const offset = q.firstGapIsExample ? 1 : 0;
        q.answers.forEach((a, i) => {
          if (i < offset) return; // chỗ trống ví dụ — giữ đáp án hiện sẵn
          entries.push([[...base, "answers", i], a]);
          q.answers[i] = "";
        });
      }
      if (q.type === "word-scramble" && q.answer != null) {
        const word = String(q.answer);
        q.scrambled = scrambleWord(word);
        q.answerLength = word.length;
      }
      if (q.type === "word-bank" && q.answer != null) q.answerLength = String(q.answer).length;
      take(q, "answer", base);
      take(q, "answerIndex", base);
      take(q, "sampleAnswer", base);
    });
  });
}

function splitBlankHolders(list, basePath, entries) {
  (list ?? []).forEach((holder, i) => {
    if (holder && typeof holder === "object" && Array.isArray(holder.answers)) {
      entries.push([[...basePath, i, "answers"], holder.answers]);
      holder.answers = holder.answers.map(() => "");
    }
  });
}

function splitIeltsContainers(containers, field, take, entries) {
  (containers ?? []).forEach((c, ci) => {
    (c?.groups ?? []).forEach((g, gi) => {
      const gBase = [field, ci, "groups", gi];
      (g.questions ?? []).forEach((q, qi) => {
        const base = [...gBase, "questions", qi];
        take(q, "answer", base);
        take(q, "answerIndex", base);
        take(q, "acceptedAnswers", base);
      });
      (g.table?.rows ?? []).forEach((row, ri) => splitBlankHolders(row?.cells, [...gBase, "table", "rows", ri, "cells"], entries));
      splitBlankHolders(g.paragraphs, [...gBase, "paragraphs"], entries);
      (g.diagramPoints ?? []).forEach((p, pi) => take(p, "answer", [...gBase, "diagramPoints", pi]));
    });
  });
}

function splitKetPet(groups, take, entries, isVocab) {
  (groups ?? []).forEach((g, gi) => {
    const gBase = ["groups", gi];
    if (isVocab && g.type === "reorder" && Array.isArray(g.questions)) {
      // "Sắp xếp thứ tự": thứ tự LƯU chính là đáp án — đề công khai lưu thứ tự đã xáo, vị trí đúng cất vào khoá.
      const perm = fixedPermutation(g.questions.length);
      const original = g.questions;
      g.questions = perm.map(orig => original[orig]);
      perm.forEach((orig, newIdx) => entries.push([[...gBase, "questions", newIdx, "correctPos"], orig + 1]));
    }
    (g.questions ?? []).forEach((q, qi) => {
      const base = [...gBase, "questions", qi];
      ["answer", "answerIndex", "acceptedAnswers", "columnIndex", "sampleAnswer"].forEach(k => take(q, k, base));
    });
  });
}

function splitListeningExam(parts, take, entries) {
  if (!parts || typeof parts !== "object") return;
  const p1 = parts.part1;
  if (p1 && Array.isArray(p1.pairs)) {
    p1.questionCount = p1.pairs.filter(p => p?.a && p?.b && p.id !== "example").length;
    entries.push([["parts", "part1", "pairs"], p1.pairs]);
    p1.pairs = p1.pairs.filter(p => p?.id === "example");
  }
  const choiceKeys = ["part2", "part3"];
  if (parts.part4?.partNo === 4) choiceKeys.push("part4");
  choiceKeys.forEach(key => {
    (parts[key]?.questions ?? []).forEach((q, qi) => take(q, "answer", ["parts", key, "questions", qi]));
  });
  // Part 4 tô màu (Starters) / Part 5 (Movers) chấm bằng canvas ở trình duyệt — giữ nguyên đáp án trong đề.
}

// Tách đáp án. `data` là object sẽ ghi vào Firestore (có thể chứa serverTimestamp() — chỉ field nội dung được clone
// sâu qua JSON, các field khác giữ nguyên tham chiếu). Trả về { data: đề công khai, entries }.
export function splitAnswers(kind, data) {
  const field = CONTENT_FIELD[kind];
  if (!field || data?.[field] == null) return { data, entries: [] };
  const content = JSON.parse(JSON.stringify(data[field]));
  const entries = [];
  const take = makeTaker(entries);
  if (kind === "reading") splitReading(content, take, entries);
  else if (kind === "ielts-reading") splitIeltsContainers(content, "passages", take, entries);
  else if (kind === "ielts-listening") splitIeltsContainers(content, "sections", take, entries);
  else if (kind === "ketpet-test") splitKetPet(content, take, entries, false);
  else if (kind === "ketpet-vocab") splitKetPet(content, take, entries, true);
  else if (kind === "listening-exam") splitListeningExam(content, take, entries);
  return { data: { ...data, [field]: content, answersSplit: true }, entries };
}

function setAtPath(root, path, value) {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (node[k] == null || typeof node[k] !== "object") node[k] = typeof path[i + 1] === "number" ? [] : {};
    node = node[k];
  }
  node[path[path.length - 1]] = value;
}

// Ghép đáp án lại vào đề. `restoreOrder` (CMS mở soạn): đưa nhóm "sắp xếp thứ tự" KET/PET về đúng thứ tự gốc (thứ
// tự đúng = thứ tự lưu, như trước khi tách). Worker chấm bài thì KHÔNG restore — giữ thứ tự công khai học sinh thấy,
// chấm theo `correctPos`.
export function mergeAnswers(kind, data, entries, { restoreOrder = false } = {}) {
  const field = CONTENT_FIELD[kind];
  if (!field || !data?.[field] || !entries?.length) return data;
  const wrapped = { [field]: JSON.parse(JSON.stringify(data[field])) };
  entries.forEach(([path, value]) => setAtPath(wrapped, path, value));
  if (restoreOrder && kind === "ketpet-vocab") {
    (wrapped.groups ?? []).forEach(g => {
      if (g.type !== "reorder" || !g.questions?.some(q => q.correctPos != null)) return;
      g.questions = [...g.questions]
        .sort((a, b) => (a.correctPos ?? 0) - (b.correctPos ?? 0))
        .map(({ correctPos: _drop, ...q }) => q);
    });
  }
  return { ...data, [field]: wrapped[field] };
}

export function parseEntries(keyDoc) {
  try {
    return JSON.parse(keyDoc?.entries ?? "[]");
  } catch {
    return [];
  }
}
