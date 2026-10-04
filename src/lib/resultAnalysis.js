import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { listStudents } from "./adminUsers.js";
import { listOpenings, attemptKey } from "./openings.js";
import { listResultsForOpening, RESULT_MODE_LABEL } from "./testResults.js";

// Số liệu cho màn "Phân tích bài làm" (pages/dashboard/ResultAnalysisPage.jsx): 1 lượt nộp so với chính em, so với
// lớp, so với cả trung tâm. Dùng chung cho MỌI dạng bài — chỉ dựa vào correct/total + items đã chuẩn hoá.
//  - Điểm của các em khác + lịch sử của em: collection `attempts` (điểm tóm tắt, giữ lâu dài).
//  - Từng câu / thời gian làm bài của lớp: `testResults` của cùng lần mở bài (chỉ còn trong 48h sau hạn chót).

const SCENE_LABEL = { mic: "Nói", "scene-click": "Chạm vào ảnh", "card-select": "Chọn thẻ", "drag-drop": "Kéo-thả" };

export const pctOf = (correct, total) => (total > 0 && correct != null ? Math.round((correct / total) * 100) : null);
const mean = xs => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Đưa items của mọi dạng bài về 1 dạng: { key, section, label, prompt, score (0..1, null = không chấm), weight }.
export function normalizeItems(mode, items = []) {
  if (mode === "speaking") {
    return items.map((it, i) => ({
      key: `s${it.sceneIndex ?? i}`,
      section: SCENE_LABEL[it.sceneType] ?? null,
      label: String((it.sceneIndex ?? i) + 1),
      prompt: it.examinerLine ?? "",
      score: it.result === "correct" ? 1 : 0,
      weight: 1,
    }));
  }
  // Listening luyện đề nộp trước 2026-10-03: chỉ có điểm từng Part.
  if (items[0]?.part) {
    return items.map(it => ({
      key: it.part, section: it.part, label: it.part, prompt: "",
      score: it.total > 0 ? it.correct / it.total : null, weight: it.total || 0,
    }));
  }
  return items.map((it, i) => {
    const section = it.section ?? (it.partIndex != null ? `Part ${it.partIndex + 1}` : it.group != null ? `Nhóm ${it.group}` : null);
    const number = it.qNumber ?? i + 1;
    const graded = !it.ungraded && it.isCorrect != null;
    return {
      key: `${section ?? ""}|${number}|${it.gapIndex ?? ""}|${i}`,
      section,
      label: String(number),
      prompt: it.prompt ?? "",
      score: !graded ? null : it.earned != null && it.total > 0 ? Math.min(1, it.earned / it.total) : it.isCorrect ? 1 : 0,
      weight: it.total > 0 ? it.total : 1,
    };
  });
}

// % đúng theo từng phần (Part / nhóm / kiểu câu) — theo đúng thứ tự xuất hiện trong bài.
function sectionPcts(norm) {
  const map = new Map();
  for (const it of norm) {
    if (!it.section || it.score == null) continue;
    const s = map.get(it.section) ?? { earned: 0, weight: 0 };
    s.earned += it.score * it.weight;
    s.weight += it.weight;
    map.set(it.section, s);
  }
  return new Map([...map].filter(([, s]) => s.weight > 0).map(([k, s]) => [k, Math.round((s.earned / s.weight) * 100)]));
}

const attemptPct = a => pctOf(a.bestCorrect ?? a.lastCorrect, a.total);

function groupStats(rows, myUid, myPct) {
  const pcts = rows.map(x => x.pct);
  const others = rows.filter(x => x.uid !== myUid).map(x => x.pct);
  return {
    count: rows.length,
    avg: mean(pcts),
    median: median(pcts),
    max: pcts.length ? Math.max(...pcts) : null,
    min: pcts.length ? Math.min(...pcts) : null,
    rank: 1 + others.filter(p => p > myPct).length,
    // % các em KHÁC có điểm thấp hơn em này.
    beat: others.length ? Math.round((others.filter(p => p < myPct).length / others.length) * 100) : null,
    // Phân bố điểm 5 mức: 0–19, 20–39, 40–59, 60–79, 80–100.
    histogram: pcts.reduce((h, p) => { h[Math.min(4, Math.floor(p / 20))] += 1; return h; }, [0, 0, 0, 0, 0]),
  };
}

export async function loadResultAnalysis(r) {
  const attempts = collection(db, "attempts");
  const docsOf = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const [mine, levelAttempts, openingResults, students, openings] = await Promise.all([
    getDocs(query(attempts, where("uid", "==", r.uid))).then(docsOf),
    // Mọi lượt cùng dạng bài + cùng bộ đề + cùng cấp của cả trung tâm (gồm cả các lớp làm đúng bài này).
    r.seriesId != null && r.level != null
      ? getDocs(query(attempts, where("mode", "==", r.mode), where("seriesId", "==", r.seriesId), where("level", "==", r.level))).then(docsOf)
      : Promise.resolve([]),
    listResultsForOpening(r.openingId).catch(() => []),
    listStudents().catch(() => []),
    listOpenings().catch(() => []),
  ]);
  return { mine, levelAttempts, openingResults, students, openings };
}

export function buildAnalysis(r, { mine, levelAttempts, openingResults, students, openings }) {
  const key = attemptKey(r.testId, r.openingId);
  const myPct = pctOf(r.correct, r.total);
  const openingById = new Map(openings.map(o => [o.id, o]));
  const nameByUid = new Map(students.map(s => [s.uid, s.displayName]));
  openingResults.forEach(x => { if (x.uid && !nameByUid.get(x.uid)) nameByUid.set(x.uid, x.studentName); });

  // ---- So với chính em: mọi bài em đã nộp có điểm, theo thứ tự thời gian.
  const history = mine
    .filter(a => a.total > 0 && a.lastCorrect != null)
    .map(a => {
      const isCurrent = a.mode === r.mode && a.testId === key;
      const opening = openingById.get(String(a.testId).split("@")[1]);
      return {
        isCurrent,
        mode: a.mode,
        pct: isCurrent ? myPct : pctOf(a.lastCorrect, a.total),
        at: a.updatedAt?.toMillis?.() ?? 0,
        label: [opening?.testTitle, RESULT_MODE_LABEL[a.mode] ?? a.mode].filter(Boolean).join(" · "),
      };
    })
    .sort((a, b) => a.at - b.at);
  if (!history.some(h => h.isCurrent)) {
    history.push({ isCurrent: true, mode: r.mode, pct: myPct, at: r.submittedAt?.toMillis?.() ?? Date.now(), label: r.lessonLabel ?? "" });
  }
  const previous = history.filter(h => !h.isCurrent);
  const sameMode = previous.filter(h => h.mode === r.mode);
  const self = {
    history,
    count: previous.length,
    avg: mean(previous.map(h => h.pct)),
    best: previous.length ? Math.max(...previous.map(h => h.pct)) : null,
    sameModeCount: sameMode.length,
    sameModeAvg: mean(sameMode.map(h => h.pct)),
    last: previous[previous.length - 1] ?? null,
  };

  // ---- So với lớp (cùng lần mở bài) và cả trung tâm (mọi lớp làm đúng bài này): mỗi em lấy điểm cao nhất.
  const sameTest = levelAttempts
    .filter(a => a.uid && String(a.testId).startsWith(`${r.testId}@`) && attemptPct(a) != null)
    .map(a => ({ uid: a.uid, testId: a.testId, pct: a.uid === r.uid && a.testId === key ? myPct : attemptPct(a) }));
  if (!sameTest.some(a => a.uid === r.uid && a.testId === key)) sameTest.push({ uid: r.uid, testId: key, pct: myPct });
  const classRows = sameTest.filter(a => a.testId === key);
  const cls = {
    ...groupStats(classRows, r.uid, myPct),
    size: students.filter(s => s.className === r.studentClass).length,
    ranking: classRows
      .map(a => ({ uid: a.uid, pct: a.pct, name: nameByUid.get(a.uid) || "—", isMe: a.uid === r.uid }))
      .sort((a, b) => b.pct - a.pct),
  };
  const center = { ...groupStats(sameTest, r.uid, myPct), classCount: new Set(sameTest.map(a => a.testId)).size };
  const levelPcts = levelAttempts.map(attemptPct).filter(p => p != null);
  const level = { count: levelPcts.length, avg: mean(levelPcts) };

  // ---- Từng câu / từng phần so với lớp: mỗi em lấy lượt nộp điểm cao nhất còn lưu.
  const bestByUid = new Map();
  for (const x of openingResults) {
    if (!x.uid || x.uid === r.uid) continue;
    const cur = bestByUid.get(x.uid);
    if (!cur || (pctOf(x.correct, x.total) ?? -1) > (pctOf(cur.correct, cur.total) ?? -1)) bestByUid.set(x.uid, x);
  }
  const myItems = normalizeItems(r.mode, r.items);
  const classSubmissions = [r, ...bestByUid.values()];
  const classNorms = classSubmissions.map(x => (x === r ? myItems : normalizeItems(x.mode, x.items)));
  const rateOf = pick => {
    const acc = new Map();
    classNorms.forEach(norm => pick(norm).forEach((v, k) => {
      const s = acc.get(k) ?? { sum: 0, n: 0 };
      s.sum += v;
      s.n += 1;
      acc.set(k, s);
    }));
    return new Map([...acc].map(([k, s]) => [k, Math.round(s.sum / s.n)]));
  };
  const qRate = rateOf(norm => new Map(norm.filter(it => it.score != null).map(it => [it.key, it.score * 100])));
  const sectionRate = rateOf(sectionPcts);
  const questions = myItems.map(it => ({ ...it, classRate: qRate.get(it.key) ?? null }));
  const sections = [...sectionPcts(myItems)].map(([name, pct]) => ({ name, pct, classPct: sectionRate.get(name) ?? null }));
  const times = classSubmissions.map(x => x.elapsedMs).filter(ms => ms > 0);

  return {
    myPct,
    self,
    cls,
    center,
    level,
    questions,
    sections,
    peerCount: classSubmissions.length,
    medianMs: median(times),
    // Các lượt em đã nộp trong cùng lần mở bài này.
    myAttempts: openingResults
      .filter(x => x.uid === r.uid)
      .sort((a, b) => (a.submittedAt?.toMillis?.() ?? 0) - (b.submittedAt?.toMillis?.() ?? 0))
      .map(x => ({ id: x.id, pct: pctOf(x.correct, x.total), at: x.submittedAt?.toDate?.() ?? null })),
  };
}
