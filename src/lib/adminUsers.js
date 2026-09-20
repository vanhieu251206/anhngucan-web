import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
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
export { STUDENT_EMAIL_DOMAIN };

export function createTeacherAccount(email, password) {
  return createStaffLikeAccount("teacher", email, password);
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

// XOÁ: xoá hồ sơ Firestore (mất tên/lớp/quyền → không dùng được nữa, kể cả đang đăng nhập). Tài khoản trong
// Firebase Auth vẫn còn (client không xoá được tài khoản người khác) — dọn thêm ở Firebase Console →
// Authentication nếu muốn. Kết quả/lượt làm cũ giữ nguyên.
export async function deleteStudent(uid) {
  await deleteDoc(doc(db, "users", uid));
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
    // Tên đăng nhập đã có trong Firebase Auth nhưng không có hồ sơ Firestore (tài khoản mồ côi) → thử số kế tiếp.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await createStudentAccount({ displayName: row.displayName, className: row.className, username, password });
        results.push({ ...row, username, ok: true });
        break;
      } catch (err) {
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
