// Nộp bài qua máy chủ (chốt 2026-09-25, "sửa tận gốc"): học sinh KHÔNG còn tự ghi kết quả/số lượt vào Firestore
// (firestore.rules chặn). Worker kiểm tra lớp + lần mở bài + hạn chót + số lượt + thời gian làm bài theo GIỜ MÁY
// CHỦ, tự chấm từ câu trả lời thô (đáp án đọc từ answerKeys — học sinh không đọc được), rồi ghi kết quả + cộng lượt.
//
//   POST /test/start  { kind, seriesId, level, testId, openingId }  → { startId }   (ghi giờ bắt đầu thật)
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

const RESULT_KEEP_MS = 48 * 60 * 60 * 1000; // kết quả giữ tới 48h sau hạn chót (lib/testResults.js)
const NO_START_GRACE_MS = 5 * 60 * 1000; // không có mốc bắt đầu (lỗi mạng lúc vào bài): cho nộp trễ tối đa 5 phút
const TIME_LIMIT_GRACE_MS = 2 * 60 * 1000; // độ trễ mạng/đồng hồ khi hết giờ tự nộp
const KINDS = new Set(["speaking", "reading", "dictation", "listening-exam", "ielts-reading", "ielts-listening", "ketpet-vocab", "ketpet-test"]);

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

export async function submitTest(request, env) {
  const db = firestore(env);
  const caller = await loadCaller(request, env, db);
  const body = await readBody(request);
  const isStudent = caller.role === "student";
  const now = Date.now();

  let opening = null;
  let startedAt = null;
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
    const limitMinutes = opening.timeLimitMinutes ?? test?.timeLimitMinutes ?? null;
    if (limitMinutes && startedAt != null) overtime = now - startedAt > limitMinutes * 60000 + TIME_LIMIT_GRACE_MS;
  }

  const response = { correct: graded.correct, total: graded.total, ...(graded.parts ? { parts: graded.parts } : {}) };
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
    gradedBy,
    overtime,
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
        fields: encodeFields({ uid: caller.uid, mode: body.kind, testId: key, seriesId: body.seriesId, level: body.level }),
      },
      updateMask: { fieldPaths: ["uid", "mode", "testId", "seriesId", "level"] },
      updateTransforms: [
        { fieldPath: "count", increment: { integerValue: "1" } },
        { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
      ],
    });
    if (body.startId && startedAt != null) writes.push({ delete: db.name(`testStarts/${body.startId}`) });
  }
  await db.commit(writes);
  return response;
}
