import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "./firebase.js";
import { savePasswordCopy } from "./passwordVault.js";

// Domain giả cho tài khoản học sinh — Firebase Auth bắt buộc định dạng email, học sinh (trẻ em)
// không có email thật nên dùng "username@hocsinh.local" (không phải domain thật, không gửi mail
// đi đâu cả, chỉ để thoả định dạng bắt buộc của Firebase Auth).
const STUDENT_EMAIL_DOMAIN = "hocsinh.local";

// Bỏ dấu tiếng Việt + viết liền không khoảng trắng, chỉ giữ chữ/số — dùng làm gốc cho username tự
// sinh (vd "Nguyễn Văn An" → "nguyenvanan").
function slugifyName(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Tạo tài khoản qua Cloudflare Worker (worker/src/accounts.js, 2026-10-08) — trình duyệt KHÔNG còn tự gọi
// createUserWithEmailAndPassword, nhờ vậy tắt được "cho phép đăng ký" trong Firebase Console (người ngoài không tự
// tạo được tài khoản). Worker tạo tài khoản Auth + hồ sơ users + bản sao mật khẩu (passwordVault) trong 1 lần.
export { STUDENT_EMAIL_DOMAIN };

// scope: { restricted, levelAccess, allowedClasses } — levelAccess theo từng cấp (lib/teacherScope.js, 2026-09-27;
// thay allowedSeriesIds theo bộ đề — field cũ luôn ghi [] khi lưu bằng giao diện mới) — bỏ trống/undefined = tài khoản KHÔNG
// giới hạn (hoạt động y hệt giáo viên full-time hiện tại). Chỉ set khi tạo giáo viên dạy ngắn hạn/
// vài lớp (chốt 2026-09-22, xem firestore.rules `isRestrictedTeacher()`).
// Giáo viên tạo từ CMS đăng nhập bằng tên đăng nhập (không email thật) — tự nối "@giaovien.local" (domain giả,
// giống học sinh/tester), LoginPage.jsx cũng tự nối khi đăng nhập (2026-09-26).
export const TEACHER_EMAIL_DOMAIN = "giaovien.local";

export function createTeacherAccount(username, password, scope) {
  const extra = scope?.restricted
    ? { restricted: true, levelAccess: scope.levelAccess ?? {}, allowedClasses: scope.allowedClasses ?? [] }
    : {};
  // Mật khẩu ban đầu do người tạo đặt — giáo viên BẮT BUỘC đổi ở lần đăng nhập đầu (ForceChangePassword.jsx, như học sinh).
  return callAdminWorker("/admin/create-account", { role: "teacher", username, password, scope: extra });
}

// Sửa phạm vi 1 tài khoản giáo viên đã có — admin HOẶC giáo viên khác đều gọi được (xem
// firestore.rules `users/{uid}` allow update theo isStaff(), chỉ đụng đúng các field phạm vi này).
export async function updateTeacherScope(uid, { restricted, levelAccess, allowedClasses }) {
  await updateDoc(doc(db, "users", uid), {
    restricted: !!restricted,
    allowedSeriesIds: [],
    levelAccess: restricted ? levelAccess ?? {} : {},
    allowedClasses: allowedClasses ?? [],
  });
}

// Tài khoản đặc biệt (role "tester"): đăng nhập làm được mọi dạng bài nhưng không ghi lịch sử vào
// hệ thống — xem lib/historyGuard.js. Không vào được khu vực quản trị (isStaff = false).
// Đăng nhập bằng tên đăng nhập (không cần email thật): Firebase Auth bắt buộc định dạng email nên
// tự nối "@tester.local" (domain giả, không gửi mail đi đâu) — LoginPage.jsx cũng tự nối như vậy.
export const TESTER_EMAIL_DOMAIN = "tester.local";

export function createTesterAccount(username, password) {
  return callAdminWorker("/admin/create-account", { role: "tester", username, password });
}

export async function listTeachers() {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher")));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function listTesters() {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "tester")));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// KHOÁ: đặt cờ disabled trên hồ sơ — học sinh bị đăng xuất và không đăng nhập lại được (LoginPage.jsx +
// authContext.jsx kiểm tra). Mở khoá: bỏ cờ. Không có Admin SDK nên không khoá được ở tầng Firebase Auth.
export async function setStudentDisabled(uid, disabled) {
  await updateDoc(doc(db, "users", uid), { disabled });
}

// Chuyển học sinh sang lớp khác ("" = chưa xếp lớp).
export async function setStudentClass(uid, className) {
  await updateDoc(doc(db, "users", uid), { className });
}

// XOÁ HẲN (2026-09-25): gọi Cloudflare Worker (worker/src/admin.js, giữ khoá service account) xoá cả tài khoản
// Firebase Auth lẫn hồ sơ Firestore → tên đăng nhập dùng lại được. Trình duyệt không tự xoá được tài khoản Auth
// của người khác. Kết quả/lượt làm cũ giữ nguyên.
const WORKER_URL = import.meta.env.VITE_WORKER_URL;

const ADMIN_ERRORS = {
  "admin-not-configured": "Worker chưa có khoá quản trị Firebase (FIREBASE_SERVICE_ACCOUNT) — xem worker/README.md.",
  forbidden: "Không có quyền thực hiện thao tác này với tài khoản đó.",
  "not-a-student": "Chỉ xoá được tài khoản học sinh.",
  "not-a-teacher": "Tài khoản này không phải giáo viên.",
  "not-a-sub-teacher": "Giáo viên chính chỉ xoá được giáo viên phụ.",
  "not-a-tester": "Tài khoản này không phải tài khoản đặc biệt.",
  "cannot-reset-admin": "Không đặt lại được mật khẩu tài khoản admin.",
  "weak-password": "Mật khẩu cần ít nhất 6 ký tự.",
  "email-already-in-use": "Tên đăng nhập đã có người dùng.",
};

async function callAdminWorker(path, body) {
  if (!WORKER_URL) throw new Error("Chưa cấu hình VITE_WORKER_URL.");
  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(ADMIN_ERRORS[data.error] ?? `Lỗi (${data.error || res.status}).`), { code: data.error });
  return data;
}

// Xoá hẳn tài khoản giáo viên (admin: mọi giáo viên; giáo viên chính: chỉ giáo viên phụ) — worker/src/admin.js.
export async function deleteTeacher(uid) {
  await callAdminWorker("/admin/delete-teacher", { uid });
}

// Khoá/mở khoá giáo viên — cùng cờ `disabled` như học sinh (authContext.jsx tự đăng xuất; firestore.rules coi như mất quyền).
export async function setTeacherDisabled(uid, disabled) {
  await updateDoc(doc(db, "users", uid), { disabled });
}

// Xoá hẳn tài khoản đặc biệt (chỉ admin) — worker/src/admin.js deleteTester.
export async function deleteTester(uid) {
  await callAdminWorker("/admin/delete-tester", { uid });
}

// Khoá/mở khoá bất kỳ tài khoản nào (tab "Quản lý tài khoản" của admin) — cùng cờ `disabled`.
export async function setAccountDisabled(uid, disabled) {
  await updateDoc(doc(db, "users", uid), { disabled });
}

// Toàn bộ hồ sơ users (mọi role) — chỉ admin dùng.
export async function listAllAccounts() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function deleteStudent(uid) {
  await callAdminWorker("/admin/delete-student", { uid });
}

// Tên đăng nhập bị giữ bởi tài khoản Auth mồ côi (hồ sơ đã xoá kiểu cũ) → xoá để dùng lại tên. Trả về true nếu dọn được.
async function purgeOrphanUsername(username) {
  try {
    return (await callAdminWorker("/admin/delete-student", { username })).deleted === true;
  } catch {
    return false;
  }
}

export async function listStudents({ className } = {}) {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
  const all = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  return className ? all.filter(s => s.className === className) : all;
}

// Tạo 1 tài khoản học sinh. Mật khẩu ban đầu — học sinh BẮT BUỘC đổi ở lần đăng nhập đầu (ForceChangePassword.jsx).
export async function createStudentAccount({ displayName, className, username, password }) {
  const { uid } = await callAdminWorker("/admin/create-account", { role: "student", username, password, displayName, className });
  return { uid, username, displayName, className };
}

// Mật khẩu ban đầu ngẫu nhiên cho từng em (2026-10-08) — mật khẩu chung cả lớp + tên đăng nhập đoán được thì bạn cùng
// lớp vào được tài khoản em chưa đăng nhập lần đầu. Bỏ các ký tự dễ nhầm khi đọc phiếu (0/o, 1/l/i).
const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function randomPassword(length = 6) {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, b => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

// Tạo hàng loạt từ danh sách {displayName, className} — tự sinh username duy nhất (tên bỏ dấu
// viết liền + số thứ tự nếu trùng, so trùng với cả username đã có sẵn trong Firestore lẫn trong
// CHÍNH đợt đang tạo). Trả về kết quả từng dòng (thành công kèm username, hoặc lỗi) để CMS hiện
// bảng cho giáo viên — KHÔNG dừng cả đợt khi 1 dòng lỗi. Không truyền `commonPassword` = mỗi em 1 mật khẩu ngẫu
// nhiên; kết quả từng dòng kèm `password` để in phiếu đăng nhập.
export async function bulkCreateStudents(rows, commonPassword) {
  const existing = await listStudents();
  const takenUsernames = new Set(existing.map(s => s.username).filter(Boolean));
  const results = [];
  for (const row of rows) {
    const base = slugifyName(row.displayName) || "hocsinh";
    let username = base;
    let n = 1;
    while (takenUsernames.has(username)) {
      n += 1;
      username = `${base}${n}`;
    }
    takenUsernames.add(username);
    // Tên đăng nhập đã có trong Firebase Auth nhưng không có hồ sơ Firestore (tài khoản mồ côi, vd xoá kiểu cũ) →
    // nhờ Worker dọn tài khoản đó để dùng lại đúng tên; không dọn được thì thử số kế tiếp.
    let purged = false;
    const password = commonPassword || randomPassword();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await createStudentAccount({ displayName: row.displayName, className: row.className, username, password });
        results.push({ ...row, username, password, ok: true });
        break;
      } catch (err) {
        if (err.code === "email-already-in-use" && !purged) {
          purged = true;
          if (await purgeOrphanUsername(username)) continue;
        }
        if (err.code === "email-already-in-use" && attempt < 4) {
          do {
            n += 1;
            username = `${base}${n}`;
          } while (takenUsernames.has(username));
          takenUsernames.add(username);
          continue;
        }
        results.push({ ...row, username, ok: false, error: err.message || String(err) });
        break;
      }
    }
  }
  return results;
}

// Đặt lại mật khẩu không cần mật khẩu hiện tại (chỉ admin, 2026-09-28) — worker/src/admin.js resetPassword.
// Ghi luôn bản sao vào passwordVault để admin xem lại được.
export async function resetAccountPassword(uid, password) {
  await callAdminWorker("/admin/reset-password", { uid, password });
  await savePasswordCopy(uid, password);
}
