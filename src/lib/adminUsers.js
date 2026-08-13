import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

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
