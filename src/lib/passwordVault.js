import { doc, setDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

// Bản sao mật khẩu dạng CHỮ THƯỜNG để admin xem lại, hỗ trợ học sinh quên mật khẩu (người dùng chủ động chọn
// 2026-09-27, đã được báo rủi ro: lộ dữ liệu là lộ hết mật khẩu). Collection riêng `passwordVault/{uid}`, CHỈ admin
// đọc được (firestore.rules) — không để trong `users` vì giáo viên đọc được hồ sơ đó. Firebase Auth vẫn giữ mật khẩu
// thật; đây chỉ là bản chép lại mỗi khi tạo tài khoản/đổi mật khẩu. Không lưu mật khẩu của admin.
// Lỗi ghi bản sao KHÔNG làm hỏng việc tạo tài khoản/đổi mật khẩu (chỉ log).
export async function savePasswordCopy(uid, password) {
  try {
    await setDoc(doc(db, "passwordVault", uid), { password, updatedAt: serverTimestamp() });
  } catch (err) {
    console.warn("Không lưu được bản sao mật khẩu:", err);
  }
}

// { uid: { password, updatedAt } } — chỉ admin gọi.
export async function loadPasswordVault() {
  const snap = await getDocs(collection(db, "passwordVault"));
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
}
