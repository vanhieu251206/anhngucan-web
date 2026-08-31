import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

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
export async function createTeacherAccount(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    // Ghi Firestore bằng `db` CHÍNH (vẫn đang đăng nhập là admin, không phải secondary) —
    // đúng field role Firestore Rules yêu cầu để chấp nhận write.
    await setDoc(doc(db, "users", cred.user.uid), {
      role: "teacher",
      email,
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

// Mật khẩu chung ĐANG DÙNG cho MỌI tài khoản học sinh (toàn trung tâm, không theo lớp) — lưu
// plaintext ở settings/studentAccess (chỉ admin/teacher đọc được, xem firestore.rules) vì cần
// dùng lại để (a) tạo tài khoản mới đúng mật khẩu hiện hành, (b) khi đổi mật khẩu chung phải tự
// đăng nhập LẦN LƯỢT từng tài khoản cũ bằng mật khẩu CŨ rồi mới đổi được (không có Cloud
// Functions/Admin SDK để đổi mật khẩu người khác mà không cần mật khẩu cũ).
export async function getCurrentStudentPassword() {
  const snap = await getDoc(doc(db, "settings", "studentAccess"));
  return snap.exists() ? snap.data().currentPassword ?? null : null;
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
    try {
      await createStudentAccount({ displayName: row.displayName, className: row.className, username, password });
      results.push({ ...row, username, ok: true });
    } catch (err) {
      results.push({ ...row, username, ok: false, error: err.message || String(err) });
    }
  }
  return results;
}

// Đổi mật khẩu chung cho TOÀN BỘ tài khoản học sinh hiện có — vì không có Admin SDK, phải tự
// đăng nhập LẦN LƯỢT từng em bằng mật khẩu CŨ (qua secondary app, không đụng phiên admin đang
// đăng nhập) rồi gọi updatePassword(). Chạy tuần tự (không song song) để tránh dồn quá nhiều kết
// nối Auth cùng lúc — với ~100 học sinh có thể mất khoảng 1-2 phút, admin cần chờ xong.
export async function updateSharedStudentPassword(oldPassword, newPassword, onProgress) {
  const students = await listStudents();
  const failed = [];
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const email = `${student.username}@${STUDENT_EMAIL_DOMAIN}`;
    const secondaryApp = initializeApp(firebaseConfig, `secondary-pwd-${Date.now()}-${i}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const cred = await signInWithEmailAndPassword(secondaryAuth, email, oldPassword);
      await updatePassword(cred.user, newPassword);
    } catch (err) {
      failed.push({ ...student, error: err.message || String(err) });
    } finally {
      await signOut(secondaryAuth).catch(() => {});
      await deleteApp(secondaryApp);
    }
    onProgress?.(i + 1, students.length);
  }
  await setDoc(doc(db, "settings", "studentAccess"), { currentPassword: newPassword }, { merge: true });
  return { total: students.length, failed };
}
