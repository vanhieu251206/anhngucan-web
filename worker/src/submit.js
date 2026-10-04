// Nộp bài qua máy chủ (chốt 2026-09-25, "sửa tận gốc"): học sinh KHÔNG còn tự ghi kết quả/số lượt vào Firestore
// (firestore.rules chặn). Worker kiểm tra lớp + lần mở bài + hạn chót + số lượt + thời gian làm bài theo GIỜ MÁY
// CHỦ, tự chấm từ câu trả lời thô (đáp án đọc từ answerKeys — học sinh không đọc được), rồi ghi kết quả + cộng lượt.
//
//   POST /test/start  { kind, seriesId, level, testId, openingId }  → { startId }   (ghi giờ bắt đầu thật)
//   POST /test/review { openingId }                                   → { deadline, results }  (chỉ SAU hạn chót)
//   POST /test/submit { startId, kind, seriesId, level, testId, openingId, answers, client, sessionId, lessonLabel,
//                       studentName, elapsedMs }                      → { correct, total, parts? }
//
// `client` = { correct, total, items } — chỉ dùng cho dạng chấm ở trình duyệt (speaking, dictation; Listening Part
// tô màu gửi điểm riêng trong answers.parts). Admin/giáo viên làm thử: không kiểm tra mở bài, kết quả ghi uid=null
// như trước. Tài khoản đặc biệt (tester): chấm nhưng KHÔNG ghi gì.
import { adminError, verifyIdToken } from "./admin.js";
import { firestore, encodeFields, randomDocId } from "./firestore.js";
import { SERVER_GRADED, gradeSubmission, testLocation } from "../../src/lib/grading/index.js";
import { answerKind, answerKeyDocId, mergeAnswers, parseEntries } from "../../src/lib/grading/answerKeys.js";
import { regradeResult, gradingSignature } from "../../src/lib/grading/regrade.js";

const RESULT_KEEP_MS = 48 * 60 * 60 * 1000; // kết quả giữ tới 48h sau hạn chót (lib/testResults.js)
const NO_START_GRACE_MS = 5 * 60 * 1000; // không có mốc bắt đầu (lỗi mạng lúc vào bài): cho nộp trễ tối đa 5 phút
const TIME_LIMIT_GRACE_MS = 2 * 60 * 1000; // độ trễ mạng/đồng hồ khi hết giờ tự nộp
const KINDS = new Set(["speaking", "reading", "dictation", "listening-exam", "ielts-reading", "ielts-listening", "ketpet-vocab", "ketpet-test", "yle-vocab"]);

function attemptKey(testId, openingId) {
  return openingId ? `${testId}@${openingId}` : testId;
}

async function readBody(request) {
  const body = await request.json().catch(() => null);
  if (!body || !KINDS.has(body.kind) || body.testId == null || !body.seriesId || body.level == null) {
    throw adminError(400, "bad-request");
  }
  return body;
}

async function loadCaller(request, env, db) {
  const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const uid = await verifyIdToken(idToken, db.projectId);
  const profile = await db.get(`users/${uid}`);
  if (!profile || profile.disabled) throw adminError(403, "forbidden");
  return { uid, profile, role: profile.role };
}

// Học sinh: lần mở bài phải đúng lớp + đúng bài. Trả về opening.
async function loadOpeningFor(db, caller, body) {
  if (!body.openingId) throw adminError(403, "not-opened");
  const opening = await db.get(`openings/${body.openingId}`);
  if (
    !opening ||
    opening.className !== caller.profile.className ||
    opening.kind !== body.kind ||
    String(opening.testId) !== String(body.testId) ||
    opening.seriesId !== body.seriesId ||
    String(opening.level) !== String(body.level)
  ) {
    throw adminError(403, "not-opened");
  }
  return opening;
}

async function attemptCount(db, uid, body) {
  const doc = await db.get(`attempts/${uid}_${body.kind}_${attemptKey(body.testId, body.openingId)}`);
  return doc?.count ?? 0;
}

export async function startTest(request, env) {
  const db = firestore(env);
  const caller = await loadCaller(request, env, db);
  const body = await readBody(request);
  if (caller.role !== "student") return { startId: null };

  const opening = await loadOpeningFor(db, caller, body);
  if (opening.expiresAt && opening.expiresAt.getTime() < Date.now()) throw adminError(403, "expired");
  if (opening.maxAttempts && (await attemptCount(db, caller.uid, body)) >= opening.maxAttempts) throw adminError(403, "no-attempts");

  const startId = randomDocId();
  await db.commit([
    {
      update: {
        name: db.name(`testStarts/${startId}`),
        fields: encodeFields({ uid: caller.uid, kind: body.kind, testId: String(body.testId), openingId: body.openingId }),
      },
      updateTransforms: [{ fieldPath: "startedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false },
    },
  ]);
  return { startId };
}

// Đề + đáp án (ghép lại từ answerKeys nếu đề đã tách). null nếu đề không nằm trong Firestore (vd Speaking Test 1
// Starters 1 nhúng cứng trong yleData.js).
async function loadTestWithAnswers(db, body) {
  const loc = testLocation(body.kind, body.seriesId, body.level, body.testId);
  if (!loc) return null;
  const test = await db.get(`lessons/${loc.lessonId}/${loc.collection}/${loc.docId}`);
  if (!test) return null;
  const kind = answerKind(loc.collection, loc.lessonId);
  if (!test.answersSplit || !kind) return test;
  const key = await db.get(`answerKeys/${answerKeyDocId(loc.lessonId, loc.collection, loc.docId)}`);
  // Đề đã tách mà mất khoá đáp án → KHÔNG chấm (chấm trên đề trống đáp án sẽ cho điểm sai).
  if (!key) throw adminError(500, "answer-key-missing");
  return mergeAnswers(kind, test, parseEntries(key));
}

function clampClientScore(client, maxTotal) {
  let total = Math.max(0, Number(client?.total) || 0);
  if (maxTotal != null) total = Math.min(total, maxTotal);
  const correct = Math.max(0, Math.min(Number(client?.correct) || 0, total));
  return { correct, total };
}

// Số câu thật của dạng chấm ở trình duyệt (để kẹp điểm gửi lên). null = không biết (đề nhúng cứng).
function clientGradedTotal(kind, test) {
  if (!test) return null;
  if (kind === "dictation") return (test.sentences ?? []).length;
  if (kind === "speaking") return (test.scenes ?? []).filter(sc => sc.type !== "narration").length;
  return null;
}

const MAX_RAW_ANSWERS_CHARS = 200_000;
function rawAnswersJson(answers) {
  const json = JSON.stringify(answers ?? null);
  return json.length <= MAX_RAW_ANSWERS_CHARS ? json : null;
}

function cleanTabLeaves(list) {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 50)
    .map(l => ({ at: new Date(Number(l?.at) || 0), awayMs: Math.max(0, Math.floor(Number(l?.awayMs) || 0)) }))
    .filter(l => l.at.getTime() > 0);
}

export async function submitTest(request, env) {
  const db = firestore(env);
  const caller = await loadCaller(request, env, db);
  const body = await readBody(request);
  const isStudent = caller.role === "student";
  const now = Date.now();

  let opening = null;
  let startedAt = null;
  let startDoc = null; // mốc bắt đầu hợp lệ của lượt này — giữ cả số vòng làm lại (maxWrong, xem dưới)
  let overtime = false;
  if (isStudent) {
    opening = await loadOpeningFor(db, caller, body);
    if (body.startId) {
      const start = await db.get(`testStarts/${body.startId}`);
      if (
        start &&
        start.uid === caller.uid &&
        start.kind === body.kind &&
        start.testId === String(body.testId) &&
        start.openingId === body.openingId
      ) {
        startedAt = start.startedAt?.getTime() ?? null;
        startDoc = start;
      }
    }
    const deadline = opening.expiresAt?.getTime();
    if (deadline != null) {
      const ok = startedAt != null ? startedAt <= deadline : now <= deadline + NO_START_GRACE_MS;
      if (!ok) throw adminError(403, "expired");
    }
    if (opening.maxAttempts && (await attemptCount(db, caller.uid, body)) >= opening.maxAttempts) {
      throw adminError(403, "no-attempts");
    }
  }

  const test = await loadTestWithAnswers(db, body);
  let graded;
  let gradedBy = "server";
  if (SERVER_GRADED.has(body.kind)) {
    if (!test) throw adminError(404, "test-not-found");
    graded = gradeSubmission(body.kind, { ...test, seriesId: body.seriesId }, body.answers);
  } else {
    gradedBy = "client";
    const { correct, total } = clampClientScore(body.client, clientGradedTotal(body.kind, test));
    graded = { correct, total, items: Array.isArray(body.client?.items) ? body.client.items : [] };
  }

  if (isStudent) {
    const limitMinutes = opening.timeLimitMinutes ?? null;
    if (limitMinutes && startedAt != null) overtime = now - startedAt > limitMinutes * 60000 + TIME_LIMIT_GRACE_MS;
  }

  // "Sai tối đa N câu mới được nộp" (opening.maxWrong, 2026-10-05, yêu cầu của cô): còn sai nhiều hơn N câu thì
  // CHƯA ghi kết quả, chỉ trả về điểm + danh sách câu sai (không kèm đáp án) để học sinh sửa rồi nộp lại — cả chuỗi
  // làm lại tính 1 lượt. Hết giờ làm bài hoặc quá hạn chót thì nhận bài luôn dù chưa đạt. Chỉ dạng Worker tự chấm.
  let mastery = null;
  if (isStudent && gradedBy === "server" && Number.isInteger(opening.maxWrong) && opening.maxWrong >= 0) {
    const wrong = (graded.items ?? []).filter(it => !it.ungraded && it.isCorrect === false);
    const limitMinutes = opening.timeLimitMinutes ?? test?.timeLimitMinutes ?? null;
    const spentMs = startedAt != null ? now - startedAt : Number(body.elapsedMs) || 0;
    const closeAt = opening.expiresAt?.getTime();
    const timeUp = (limitMinutes > 0 && spentMs >= limitMinutes * 60000 - 5000) || (closeAt != null && now > closeAt);
    const round = (startDoc?.rounds ?? 0) + 1;
    const firstCorrect = startDoc?.firstCorrect ?? graded.correct;
    if (wrong.length > opening.maxWrong && !timeUp) {
      if (startDoc) {
        await db.commit([{
          update: { name: db.name(`testStarts/${body.startId}`), fields: encodeFields({ rounds: round, firstCorrect }) },
          updateMask: { fieldPaths: ["rounds", "firstCorrect"] },
          currentDocument: { exists: true },
        }]);
      }
      return {
        retry: true, correct: graded.correct, total: graded.total, maxWrong: opening.maxWrong, round,
        wrong: wrong.map(it => ({ section: it.section ?? null, group: it.group ?? null, qNumber: it.qNumber ?? null })),
      };
    }
    mastery = { maxWrong: opening.maxWrong, rounds: round, firstCorrect, passed: wrong.length <= opening.maxWrong };
  }

  const response = { correct: graded.correct, total: graded.total, ...(graded.parts ? { parts: graded.parts } : {}), ...(mastery ? { mastery } : {}) };
  if (caller.role === "tester") return response; // tài khoản đặc biệt: không để lại dấu vết

  const deadline = opening?.expiresAt?.getTime() ?? 0;
  const result = {
    mode: body.kind,
    seriesId: body.seriesId,
    level: body.level,
    testId: String(body.testId),
    lessonLabel: typeof body.lessonLabel === "string" ? body.lessonLabel.slice(0, 200) : null,
    studentName: isStudent ? caller.profile.displayName ?? null : String(body.studentName ?? "").slice(0, 100) || null,
    studentClass: isStudent ? caller.profile.className ?? null : "Admin",
    uid: isStudent ? caller.uid : null,
    sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    openingId: isStudent ? body.openingId : null,
    purgeAfter: new Date(Math.max(deadline, now) + RESULT_KEEP_MS),
    correct: graded.correct,
    total: graded.total,
    elapsedMs: startedAt != null ? now - startedAt : Number(body.elapsedMs) || null,
    items: graded.items ?? [],
    // Câu trả lời thô (chuỗi JSON) — để chấm lại đúng y như lúc nộp khi giáo viên sửa đáp án (regradeTest).
    rawAnswers: gradedBy === "server" ? rawAnswersJson(body.answers) : null,
    gradedBy,
    // Bài có yêu cầu "sai tối đa N câu": số vòng đã nộp, điểm vòng đầu, có đạt không (null = bài thường).
    mastery,
    overtime,
    // Các lần rời tab lúc làm bài do trình duyệt ghi (src/lib/examFocus.js) — chỉ để giáo viên tham khảo.
    tabLeaves: isStudent ? cleanTabLeaves(body.tabLeaves) : [],
  };

  const writes = [
    {
      update: { name: db.name(`testResults/${randomDocId()}`), fields: encodeFields(result) },
      updateTransforms: [{ fieldPath: "submittedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false },
    },
  ];
  if (isStudent) {
    const key = attemptKey(body.testId, body.openingId);
    writes.push({
      update: {
        name: db.name(`attempts/${caller.uid}_${body.kind}_${key}`),
        // Điểm tóm tắt (lượt gần nhất + cao nhất) cho trang "Bài của con" — doc attempts KHÔNG bị xoá theo luật
        // 48h như testResults (chốt 2026-09-30), chỉ giữ con số, không giữ chi tiết từng câu.
        fields: encodeFields({
          uid: caller.uid, mode: body.kind, testId: key, seriesId: body.seriesId, level: body.level,
          lastCorrect: graded.correct, total: graded.total,
        }),
      },
      updateMask: { fieldPaths: ["uid", "mode", "testId", "seriesId", "level", "lastCorrect", "total"] },
      updateTransforms: [
        { fieldPath: "count", increment: { integerValue: "1" } },
        {
          fieldPath: "bestCorrect",
          maximum: Number.isInteger(graded.correct) ? { integerValue: String(graded.correct) } : { doubleValue: Number(graded.correct) || 0 },
        },
        { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
      ],
    });
    if (body.startId && startedAt != null) writes.push({ delete: db.name(`testStarts/${body.startId}`) });
  }
  await db.commit(writes);
  return response;
}

// Học sinh xem lại bài của chính mình SAU HẠN CHÓT (chốt 2026-09-30): điểm + từng câu (câu trả lời + đáp án đúng).
// Trước hạn chót học sinh chỉ thấy "Đã nộp" — tránh lộ đáp án cho bạn cùng lớp chưa làm. Kết quả chi tiết vẫn bị xoá
// 48h sau hạn chót (purgeAfter) nên chỉ xem được trong khoảng đó. Lần mở bài đã bị giáo viên đóng (xoá): lấy hạn chót
// từ purgeAfter của kết quả.
export async function reviewTest(request, env) {
  const db = firestore(env);
  const caller = await loadCaller(request, env, db);
  if (caller.role !== "student") throw adminError(403, "forbidden");
  const body = await request.json().catch(() => null);
  const openingId = typeof body?.openingId === "string" ? body.openingId : "";
  if (!openingId || openingId.includes("/")) throw adminError(400, "bad-request");

  const opening = await db.get(`openings/${openingId}`);
  if (opening && opening.className !== caller.profile.className) throw adminError(403, "not-opened");
  const rows = await db.query("testResults", { uid: caller.uid, openingId });
  const deadline =
    opening?.expiresAt?.getTime() ??
    (rows[0]?.purgeAfter instanceof Date ? rows[0].purgeAfter.getTime() - RESULT_KEEP_MS : null);
  if (deadline == null) return { deadline: null, results: [] };
  if (Date.now() < deadline) throw adminError(403, "not-yet");

  const results = rows
    .map(r => ({
      mode: r.mode ?? null,
      lessonLabel: r.lessonLabel ?? null,
      correct: r.correct ?? null,
      total: r.total ?? null,
      elapsedMs: r.elapsedMs ?? null,
      submittedAt: r.submittedAt instanceof Date ? r.submittedAt.toISOString() : null,
      items: Array.isArray(r.items) ? r.items : [],
    }))
    .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
  return { deadline: new Date(deadline).toISOString(), results };
}

// Chấm lại MỌI lượt nộp còn lưu của 1 bài theo đề + đáp án hiện tại (2026-10-05) — dùng sau khi giáo viên sửa đáp
// án. Chỉ admin. Trang Kết quả học sinh gọi lần lượt từng bài (mỗi bài 1 request để không vượt giới hạn subrequest của
// Worker). Chỉ dạng Worker tự chấm; lượt không chấm lại được (dữ liệu quá cũ) giữ nguyên. Cập nhật luôn điểm tóm
// tắt ở `attempts` (trang "Bài của con").
//   POST /admin/regrade { kind, seriesId, level, testId } → { checked, changed, skipped }
const REGRADE_COMMIT_SIZE = 40;

export async function regradeTest(request, env) {
  const db = firestore(env);
  const caller = await loadCaller(request, env, db);
  if (caller.role !== "admin") throw adminError(403, "forbidden");
  const body = await readBody(request);
  if (!SERVER_GRADED.has(body.kind)) throw adminError(400, "bad-request");

  const loaded = await loadTestWithAnswers(db, body);
  if (!loaded) throw adminError(404, "test-not-found");
  const test = { ...loaded, seriesId: body.seriesId };

  const rows = (await db.query("testResults", { mode: body.kind, testId: String(body.testId), seriesId: body.seriesId }))
    .filter(r => String(r.level) === String(body.level));

  let skipped = 0;
  const writes = [];
  const current = rows.map(r => {
    const g = regradeResult(body.kind, test, r);
    if (!g) {
      skipped += 1;
      return r;
    }
    if (gradingSignature(g) !== gradingSignature(r)) {
      writes.push({
        update: { name: db.name(`testResults/${r.id}`), fields: encodeFields({ correct: g.correct, total: g.total, items: g.items }) },
        updateMask: { fieldPaths: ["correct", "total", "items"] },
        updateTransforms: [{ fieldPath: "regradedAt", setToServerValue: "REQUEST_TIME" }],
        currentDocument: { exists: true },
      });
    }
    return { ...r, correct: g.correct, total: g.total };
  });
  const changed = writes.length;

  // Điểm tóm tắt của từng học sinh theo từng lần mở bài: lượt gần nhất + lượt cao nhất (tính trên các lượt còn lưu).
  const byAttempt = new Map();
  current.filter(r => r.uid && r.openingId).forEach(r => {
    const id = `${r.uid}_${body.kind}_${attemptKey(body.testId, r.openingId)}`;
    byAttempt.set(id, [...(byAttempt.get(id) ?? []), r]);
  });
  const openingIds = [...new Set(current.filter(r => r.uid && r.openingId).map(r => r.openingId))];
  for (const openingId of openingIds) {
    const docs = await db.query("attempts", { mode: body.kind, testId: attemptKey(body.testId, openingId) });
    for (const doc of docs) {
      const list = byAttempt.get(doc.id);
      if (!list) continue;
      const last = list.reduce((a, b) => ((b.submittedAt?.getTime?.() ?? 0) >= (a.submittedAt?.getTime?.() ?? 0) ? b : a));
      const best = Math.max(...list.map(r => Number(r.correct) || 0));
      if (doc.lastCorrect === last.correct && doc.bestCorrect === best && doc.total === last.total) continue;
      writes.push({
        update: { name: db.name(`attempts/${doc.id}`), fields: encodeFields({ lastCorrect: last.correct, bestCorrect: best, total: last.total }) },
        updateMask: { fieldPaths: ["lastCorrect", "bestCorrect", "total"] },
        currentDocument: { exists: true },
      });
    }
  }

  for (let i = 0; i < writes.length; i += REGRADE_COMMIT_SIZE) await db.commit(writes.slice(i, i + REGRADE_COMMIT_SIZE));
  return { checked: rows.length, changed, skipped };
}
