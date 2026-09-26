import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase.js";

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

// Cấu hình giống hệt firebase.js — cần import lại nguyên trạng để khởi tạo 1 app Firebase
// PHỤ (secondary), KHÔNG dùng chung app chính (import từ "./firebase.js" sẽ đụng instance
// auth đang đăng nhập là admin).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase Auth: gọi createUserWithEmailAndPassword trên app CHÍNH sẽ tự động đăng nhập
// luôn thành user mới tạo, đá admin ra khỏi phiên hiện tại — đây là hành vi mặc định đã biết
// của SDK, không phải bug. Cách né: tạo 1 Firebase App phụ (secondary) chỉ dùng để tạo tài
// khoản, không đụng gì tới app/auth chính đang giữ phiên đăng nhập admin.
export { STUDENT_EMAIL_DOMAIN };

// scope: { restricted, allowedSeriesIds, allowedClasses } — bỏ trống/undefined = tài khoản KHÔNG
// giới hạn (hoạt động y hệt giáo viên full-time hiện tại). Chỉ set khi tạo giáo viên dạy ngắn hạn/
// vài lớp (chốt 2026-09-22, xem firestore.rules `isRestrictedTeacher()`).
// Giáo viên tạo từ CMS đăng nhập bằng tên đăng nhập (không email thật) — tự nối "@giaovien.local" (domain giả,
// giống học sinh/tester), LoginPage.jsx cũng tự nối khi đăng nhập (2026-09-26).
export const TEACHER_EMAIL_DOMAIN = "giaovien.local";

export function createTeacherAccount(username, password, scope) {
  const extra = scope?.restricted
    ? { restricted: true, allowedSeriesIds: scope.allowedSeriesIds ?? [], allowedClasses: scope.allowedClasses ?? [] }
    : {};
  // Mật khẩu ban đầu do người tạo đặt — giáo viên BẮT BUỘC đổi ở lần đăng nhập đầu (ForceChangePassword.jsx, như học sinh).
  return createStaffLikeAccount("teacher", `${username}@${TEACHER_EMAIL_DOMAIN}`, password, { username, mustChangePassword: true, ...extra });
}

// Sửa phạm vi 1 tài khoản giáo viên đã có — admin HOẶC giáo viên khác đều gọi được (xem
// firestore.rules `users/{uid}` allow update theo isStaff(), chỉ đụng đúng 3 field này).
export async function updateTeacherScope(uid, { restricted, allowedSeriesIds, allowedClasses }) {
  await updateDoc(doc(db, "users", uid), {
    restricted: !!restricted,
    allowedSeriesIds: allowedSeriesIds ?? [],
    allowedClasses: allowedClasses ?? [],
  });
}

// Tài khoản đặc biệt (role "tester"): đăng nhập làm được mọi dạng bài nhưng không ghi lịch sử vào
// hệ thống — xem lib/historyGuard.js. Không vào được khu vực quản trị (isStaff = false).
// Đăng nhập bằng tên đăng nhập (không cần email thật): Firebase Auth bắt buộc định dạng email nên
// tự nối "@tester.local" (domain giả, không gửi mail đi đâu) — LoginPage.jsx cũng tự nối như vậy.
export const TESTER_EMAIL_DOMAIN = "tester.local";

export function createTesterAccount(username, password) {
  return createStaffLikeAccount("tester", `${username}@${TESTER_EMAIL_DOMAIN}`, password, { username });
}

async function createStaffLikeAccount(role, email, password, extra = {}) {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    // Ghi Firestore bằng `db` CHÍNH (vẫn đang đăng nhập là admin, không phải secondary) —
    // đúng field role Firestore Rules yêu cầu để chấp nhận write.
    await setDoc(doc(db, "users", cred.user.uid), {
      role,
      email,
      ...extra,
      createdAt: serverTimestamp(),
    });
    return { uid: cred.user.uid, email };
  } finally {
    // Luôn dọn app phụ dù thành công hay lỗi — tránh rò rỉ instance qua nhiều lần gọi.
    // Lưu ý: nếu setDoc phía trên lỗi (vd Firestore Rules chưa publish kịp), tài khoản Auth
    // vẫn đã được tạo (mồ côi, không có doc role) — chấp nhận rủi ro này ở scope hiện tại,
    // không tự động rollback/xoá user, chỉ báo lỗi rõ cho admin qua UI gọi hàm này.
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
  }
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
  forbidden: "Chỉ admin và giáo viên chính được xoá tài khoản.",
  "not-a-student": "Chỉ xoá được tài khoản học sinh.",
  "not-a-teacher": "Tài khoản này không phải giáo viên.",
  "not-a-sub-teacher": "Giáo viên chính chỉ xoá được giáo viên phụ.",
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
  if (!res.ok) throw Object.assign(new Error(ADMIN_ERRORS[data.error] ?? `Lỗi xoá tài khoản (${data.error || res.status}).`), { code: data.error });
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

// Tạo 1 tài khoản học sinh — dùng chung khuôn secondary-app với createTeacherAccount() ở trên.
export async function createStudentAccount({ displayName, className, username, password }) {
  const email = `${username}@${STUDENT_EMAIL_DOMAIN}`;
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      role: "student",
      username,
      displayName,
      className,
      // Mật khẩu ban đầu do giáo viên đặt chung — học sinh BẮT BUỘC đổi ở lần đăng nhập đầu (ForceChangePassword.jsx).
      mustChangePassword: true,
      createdAt: serverTimestamp(),
    });
    return { uid: cred.user.uid, username, displayName, className };
  } finally {
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
  }
}

// Tạo hàng loạt từ danh sách {displayName, className} — tự sinh username duy nhất (tên bỏ dấu
// viết liền + số thứ tự nếu trùng, so trùng với cả username đã có sẵn trong Firestore lẫn trong
// CHÍNH đợt đang tạo). Trả về kết quả từng dòng (thành công kèm username, hoặc lỗi) để CMS hiện
// bảng cho giáo viên — KHÔNG dừng cả đợt khi 1 dòng lỗi.
export async function bulkCreateStudents(rows, password) {
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
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await createStudentAccount({ displayName: row.displayName, className: row.className, username, password });
        results.push({ ...row, username, ok: true });
        break;
      } catch (err) {
        if (err.code === "auth/email-already-in-use" && !purged) {
          purged = true;
          if (await purgeOrphanUsername(username)) continue;
        }
        if (err.code === "auth/email-already-in-use" && attempt < 4) {
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
