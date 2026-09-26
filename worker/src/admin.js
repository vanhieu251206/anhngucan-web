// Xoá HẲN tài khoản học sinh (cả Firebase Auth lẫn hồ sơ Firestore) — chốt 2026-09-25. Trình duyệt không xoá
// được tài khoản Auth của người khác, Cloud Functions cần gói Blaze (có thẻ) nên dùng Worker này giữ khoá
// service account (secret FIREBASE_SERVICE_ACCOUNT, KHÔNG commit) để gọi Identity Toolkit + Firestore REST API.
//
// Chỉ admin + giáo viên chính (teacher không `restricted`) được gọi — kiểm tra qua Firebase ID token của người
// gọi (xác minh chữ ký bằng khoá công khai của Google) + đọc users/{uid}.role. Chỉ xoá được tài khoản có email
// "@hocsinh.local" (học sinh), không bao giờ đụng tới admin/giáo viên.

const STUDENT_EMAIL_DOMAIN = "hocsinh.local";
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "="));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

export function adminError(status, error) {
  return { status, error };
}

// ---------- Access token của service account (OAuth2, JWT ký RS256) ----------
let cachedToken = null; // { token, exp }

export async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", b64urlDecode(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${claims}.${b64url(sig)}`,
  });
  if (!res.ok) throw adminError(500, "service-account-auth-failed");
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

// ---------- Xác minh Firebase ID token của người gọi ----------
let cachedJwks = null; // { keys, exp }

async function getJwks() {
  if (cachedJwks && cachedJwks.exp > Date.now()) return cachedJwks.keys;
  const res = await fetch(JWK_URL);
  if (!res.ok) throw adminError(503, "jwks-unavailable");
  const { keys } = await res.json();
  cachedJwks = { keys, exp: Date.now() + 60 * 60 * 1000 };
  return keys;
}

export async function verifyIdToken(idToken, projectId) {
  const parts = (idToken || "").split(".");
  if (parts.length !== 3) throw adminError(401, "invalid-token");
  const dec = new TextDecoder();
  let header, payload;
  try {
    header = JSON.parse(dec.decode(b64urlDecode(parts[0])));
    payload = JSON.parse(dec.decode(b64urlDecode(parts[1])));
  } catch {
    throw adminError(401, "invalid-token"); // token hỏng/giả — không để rơi thành lỗi 500
  }
  const jwk = (await getJwks()).find(k => k.kid === header.kid);
  if (header.alg !== "RS256" || !jwk) throw adminError(401, "invalid-token");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlDecode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const now = Math.floor(Date.now() / 1000);
  if (
    !ok ||
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    !payload.sub ||
    payload.exp <= now ||
    payload.iat > now + 60
  ) {
    throw adminError(401, "invalid-token");
  }
  return payload.sub;
}

// ---------- Firestore / Identity Toolkit REST ----------
function userDocUrl(projectId, uid) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
}

async function getUserDoc(projectId, uid, token) {
  const res = await fetch(userDocUrl(projectId, uid), { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw adminError(502, "firestore-read-failed");
  const { fields = {} } = await res.json();
  return {
    role: fields.role?.stringValue ?? null,
    restricted: fields.restricted?.booleanValue === true,
  };
}

async function lookupAuthUser(projectId, token, query) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw adminError(502, "auth-lookup-failed");
  const { users } = await res.json();
  return users?.[0] ?? null;
}

export function parseServiceAccount(env) {
  // Bỏ BOM đầu chuỗi (PowerShell 5.1 tự thêm khi pipe file vào `wrangler secret put`).
  return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT.replace(/^﻿/, ""));
}

// Project id Firebase để xác minh ID token — lấy từ khoá service account (đã có sẵn cho /admin/delete-student).
export function firebaseProjectId(env) {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID;
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw adminError(500, "auth-not-configured");
  return parseServiceAccount(env).project_id;
}

// body: { uid } (xoá học sinh đang có) hoặc { username } (dọn tài khoản Auth mồ côi để dùng lại tên đăng nhập).
export async function deleteStudent(request, env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw adminError(500, "admin-not-configured");
  const sa = parseServiceAccount(env);
  const projectId = sa.project_id;

  const callerUid = await verifyIdToken((request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""), projectId);
  const token = await getAccessToken(sa);
  const caller = await getUserDoc(projectId, callerUid, token);
  const allowed = caller && (caller.role === "admin" || (caller.role === "teacher" && !caller.restricted));
  if (!allowed) throw adminError(403, "forbidden");

  const body = await request.json().catch(() => ({}));
  const query = body.uid
    ? { localId: [String(body.uid)] }
    : body.username
      ? { email: [`${String(body.username).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`] }
      : null;
  if (!query) throw adminError(400, "missing-target");

  const authUser = await lookupAuthUser(projectId, token, query);
  const targetUid = authUser?.localId ?? body.uid;
  if (authUser && !(authUser.email || "").endsWith(`@${STUDENT_EMAIL_DOMAIN}`)) throw adminError(403, "not-a-student");
  const profile = targetUid ? await getUserDoc(projectId, targetUid, token) : null;
  if (profile && profile.role !== "student") throw adminError(403, "not-a-student");
  // Xoá theo username chỉ để dọn tài khoản MỒ CÔI (không còn hồ sơ) — không bao giờ xoá học sinh đang có hồ sơ.
  if (!body.uid && profile) throw adminError(409, "not-orphan");
  if (!authUser && !profile) return { deleted: false };

  await deleteAccount(projectId, token, authUser?.localId, profile ? targetUid : null);
  return { deleted: true };
}

// Xoá cả tài khoản Auth (nếu có) lẫn hồ sơ Firestore (nếu có).
async function deleteAccount(projectId, token, authUid, profileUid) {
  if (authUid) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ localId: authUid }),
    });
    if (!res.ok) throw adminError(502, "auth-delete-failed");
  }
  if (profileUid) {
    const res = await fetch(userDocUrl(projectId, profileUid), { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw adminError(502, "firestore-delete-failed");
  }
}

// Xoá HẲN tài khoản giáo viên (2026-09-26). body: { uid }. Admin xoá được mọi giáo viên; giáo viên chính chỉ xoá
// được giáo viên PHỤ (restricted). Không ai tự xoá chính mình, không bao giờ đụng tới admin/học sinh.
export async function deleteTeacher(request, env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw adminError(500, "admin-not-configured");
  const sa = parseServiceAccount(env);
  const projectId = sa.project_id;

  const callerUid = await verifyIdToken((request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""), projectId);
  const token = await getAccessToken(sa);
  const caller = await getUserDoc(projectId, callerUid, token);
  const isAdmin = caller?.role === "admin";
  if (!caller || !(isAdmin || (caller.role === "teacher" && !caller.restricted))) throw adminError(403, "forbidden");

  const body = await request.json().catch(() => ({}));
  const uid = body.uid ? String(body.uid) : "";
  if (!uid) throw adminError(400, "missing-target");
  if (uid === callerUid) throw adminError(403, "forbidden");

  const profile = await getUserDoc(projectId, uid, token);
  if (!profile || profile.role !== "teacher") throw adminError(403, "not-a-teacher");
  if (!isAdmin && !profile.restricted) throw adminError(403, "not-a-sub-teacher");

  const authUser = await lookupAuthUser(projectId, token, { localId: [uid] });
  await deleteAccount(projectId, token, authUser?.localId, uid);
  return { deleted: true };
}
