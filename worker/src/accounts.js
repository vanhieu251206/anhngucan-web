// Tạo tài khoản (học sinh / giáo viên / tài khoản đặc biệt) phía máy chủ — 2026-10-08. Trước đó trình duyệt tự gọi
// createUserWithEmailAndPassword nên Firebase phải bật "cho phép đăng ký": người ngoài biết API key công khai cũng tự
// tạo được tài khoản. Chuyển về đây để TẮT được đăng ký trong Firebase Console (Authentication → Settings → User
// actions → bỏ "Enable create (sign-up)") — tạo bằng khoá service account vẫn chạy khi đã tắt.
//
//   POST /admin/create-account { role, username, password, displayName?, className?, scope? } → { uid, email }
//
// Quyền (khớp firestore.rules): học sinh = admin + giáo viên chính; giáo viên = admin (mọi loại) hoặc giáo viên chính
// (chỉ giáo viên phụ, restricted = true); tài khoản đặc biệt = chỉ admin.
import { adminError, getAccessToken, parseServiceAccount, verifyIdToken } from "./admin.js";
import { firestore, encodeFields } from "./firestore.js";

const EMAIL_DOMAINS = { student: "hocsinh.local", teacher: "giaovien.local", tester: "tester.local" };
const USERNAME_RE = /^[a-z0-9._-]{1,64}$/;

function cleanLevelAccess(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    if (value === "view" || value === "edit") out[String(key)] = value;
  }
  return out;
}

function buildProfile(role, body, email, username, caller) {
  const isAdmin = caller.role === "admin";
  const isFullStaff = isAdmin || (caller.role === "teacher" && caller.restricted !== true);
  if (role === "student") {
    if (!isFullStaff) throw adminError(403, "forbidden");
    return {
      role,
      username,
      displayName: String(body.displayName ?? "").trim().slice(0, 100),
      className: String(body.className ?? ""),
      mustChangePassword: true,
    };
  }
  if (role === "teacher") {
    const restricted = body.scope?.restricted === true;
    if (!isFullStaff || (!isAdmin && !restricted)) throw adminError(403, "forbidden");
    const scope = restricted
      ? {
          restricted: true,
          allowedSeriesIds: [],
          levelAccess: cleanLevelAccess(body.scope.levelAccess),
          allowedClasses: (Array.isArray(body.scope.allowedClasses) ? body.scope.allowedClasses : []).map(String),
        }
      : {};
    return { role, email, username, mustChangePassword: true, ...scope };
  }
  if (!isAdmin) throw adminError(403, "forbidden");
  return { role, email, username };
}

async function authRequest(projectId, token, method, body) {
  return fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createAccount(request, env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw adminError(500, "admin-not-configured");
  const db = firestore(env);
  const callerUid = await verifyIdToken((request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""), db.projectId);
  const caller = await db.get(`users/${callerUid}`);
  if (!caller || caller.disabled) throw adminError(403, "forbidden");

  const body = (await request.json().catch(() => null)) ?? {};
  const role = String(body.role ?? "");
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL_DOMAINS[role] || !USERNAME_RE.test(username)) throw adminError(400, "bad-request");
  if (password.length < 6) throw adminError(400, "weak-password");
  const email = `${username}@${EMAIL_DOMAINS[role]}`;
  const profile = buildProfile(role, body, email, username, caller);

  const token = await getAccessToken(parseServiceAccount(env));
  const res = await authRequest(db.projectId, token, "accounts", { email, password });
  if (!res.ok) {
    const detail = await res.text();
    if (detail.includes("EMAIL_EXISTS")) throw adminError(409, "email-already-in-use");
    console.error("auth create", res.status, detail);
    throw adminError(502, "auth-create-failed");
  }
  const { localId: uid } = await res.json();

  try {
    await db.commit([
      {
        update: { name: db.name(`users/${uid}`), fields: encodeFields(profile) },
        updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
        currentDocument: { exists: false },
      },
      // Bản sao mật khẩu cho admin xem lại / giáo viên in lại phiếu đăng nhập (src/lib/passwordVault.js).
      {
        update: { name: db.name(`passwordVault/${uid}`), fields: encodeFields({ password }) },
        updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
      },
    ]);
  } catch (err) {
    // Không ghi được hồ sơ → xoá luôn tài khoản Auth vừa tạo, không để lại tài khoản mồ côi giữ tên đăng nhập.
    await authRequest(db.projectId, token, "accounts:delete", { localId: uid }).catch(() => {});
    throw err;
  }
  return { uid, email };
}
