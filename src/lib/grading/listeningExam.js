// Chấm Luyện đề Listening (Starters/Movers — listeningExamTests) — module THUẦN dùng chung trình duyệt + Worker.
// Part 1 (nối), Part 2 (viết), Part 3/Movers Part 3/Movers Part 4 (chọn tranh) chấm được ở máy chủ. Part 4 tô màu
// Starters và Part 5 Movers chấm bằng so điểm ảnh trên canvas nên VẪN chấm ở trình duyệt — Worker chỉ nhận điểm
// của 2 Part này và kẹp trong khoảng [0, số câu] (xem worker/src/submit.js).

// ---------- Part 1: nối tên với người trong tranh ----------
// Khung vuông nhỏ quanh điểm chạm (px) — khớp .p1r-point. Toạ độ điểm chạm và khung đáp án đều theo % ảnh, nên
// cần kích thước khung ảnh (px) lúc học sinh làm bài để đổi nửa cạnh khung vuông sang %.
export const PART1_POINT_SIZE = 22;

function hits(pt, r, size) {
  const hx = (PART1_POINT_SIZE / 2 / size.w) * 100;
  const hy = (PART1_POINT_SIZE / 2 / size.h) * 100;
  return pt.x + hx >= r.x && pt.x - hx <= r.x + r.w && pt.y + hy >= r.y && pt.y - hy <= r.y + r.h;
}

export function matchesPair(conn, pair, size) {
  return (
    (hits(conn.p1, pair.a, size) && hits(conn.p2, pair.b, size)) ||
    (hits(conn.p1, pair.b, size) && hits(conn.p2, pair.a, size))
  );
}

export function part1Questions(part) {
  return (part?.pairs ?? []).filter(p => p.a && p.b && p.id !== "example");
}

// Số câu Part 1 — đề học sinh tải về đã tách `pairs` (đáp án) nên dùng `questionCount` lưu sẵn công khai.
export function part1QuestionCount(part) {
  return part?.questionCount ?? part1Questions(part).length;
}

// raw: { conns: [{ p1, p2 }], size: { w, h } }
export function gradePart1(part, raw) {
  const questions = part1Questions(part);
  const conns = Array.isArray(raw?.conns) ? raw.conns : [];
  const size = { w: Math.max(Number(raw?.size?.w) || 1, 1), h: Math.max(Number(raw?.size?.h) || 1, 1) };
  const right = questions.map(q => conns.some(c => c?.p1 && c?.p2 && matchesPair(c, q, size)));
  return {
    score: right.filter(Boolean).length,
    total: questions.length,
    // Chi tiết từng câu cho màn "Kết quả học sinh" — Part nối không có chữ để hiện, chỉ ghi nối đúng/chưa đúng.
    items: questions.map((q, i) => ({ qNumber: i + 1, prompt: "Nối tên với người trong tranh", studentAnswer: right[i] ? "Nối đúng" : "Chưa nối đúng", isCorrect: right[i] })),
  };
}

const clip = (s, n = 160) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// ---------- Part 2: nghe và viết tên/số ----------
export const normPart2 = s => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
const accepted = answer => String(answer ?? "").split("/").map(normPart2).filter(Boolean);
export const isPart2Right = (q, value) => accepted(q.answer).includes(normPart2(value));

export function part2Questions(part) {
  return (part?.questions ?? []).filter(q => q.question?.trim());
}

// raw: [giá trị theo thứ tự câu]
export function gradePart2(part, raw) {
  const questions = part2Questions(part);
  const values = Array.isArray(raw) ? raw : [];
  const items = questions.map((q, i) => ({
    qNumber: i + 1, prompt: clip(q.question), studentAnswer: clip(values[i], 80), correctAnswer: String(q.answer ?? ""), isCorrect: isPart2Right(q, values[i]),
  }));
  return { score: items.filter(it => it.isCorrect).length, total: questions.length, items };
}

// ---------- Part 3 Starters / Movers Part 3 / Movers Part 4: chọn đáp án chữ cái ----------
export const choiceQuestions = part2Questions;

export function gradeChoicePart(part, raw) {
  const questions = choiceQuestions(part);
  const values = Array.isArray(raw) ? raw : [];
  const items = questions.map((q, i) => ({
    qNumber: i + 1, prompt: clip(q.question), studentAnswer: clip(values[i], 20), correctAnswer: String(q.answer ?? ""), isCorrect: values[i] != null && values[i] === q.answer,
  }));
  return { score: items.filter(it => it.isCorrect).length, total: questions.length, items };
}

// Part tô màu / viết vào tranh (canvas): trình duyệt chấm rồi gửi `{ score, items: [{ id, ok, said }] }` — `said` là
// màu con đã tô / chữ con đã viết ở vùng đó. Bản trình duyệt cũ chỉ gửi `score` → 1 dòng tóm tắt, không có từng câu.
export function gradeCanvasPart(part, client, isWriteItem, itemReady) {
  const ready = (part?.items ?? []).filter(itemReady);
  const sent = Array.isArray(client?.items) ? client.items : null;
  if (!sent) {
    const score = Math.max(0, Math.min(Math.floor(Number(client?.score) || 0), ready.length));
    return { score, total: ready.length, items: [{ qNumber: 1, prompt: "Tô màu (không có chi tiết từng câu)", studentAnswer: `${score}/${ready.length} câu đúng`, ungraded: true }] };
  }
  const items = ready.map((it, i) => {
    const mine = sent.find(s => s?.id === it.id);
    const write = isWriteItem(it);
    return {
      qNumber: i + 1,
      prompt: write ? "Viết chữ vào tranh" : "Tô màu",
      studentAnswer: clip(mine?.said, 40),
      correctAnswer: write ? String(it.answer ?? "") : String(it.color ?? "").replace(/^./, c => c.toUpperCase()),
      isCorrect: !!mine?.ok,
    };
  });
  return { score: items.filter(it => it.isCorrect).length, total: ready.length, items };
}

// Part nào chấm ở máy chủ, dùng hàm nào. Trả null = Part chấm bằng canvas ở trình duyệt (tô màu/viết vào tranh).
export function serverGrader(key, part) {
  if (key === "part1") return gradePart1;
  if (key === "part2") return gradePart2;
  if (key === "part3") return gradeChoicePart;
  if (key === "part4" && part?.partNo === 4) return gradeChoicePart;
  return null;
}
