import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { setHistoryDisabled } from "./historyGuard.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // null = chưa đăng nhập/không có role
  // Hồ sơ học sinh (displayName/className/username) đọc thẳng từ doc users/{uid} — dùng để tự
  // điền tên/lớp khi vào bài (thay cho NamePromptScreen kiểu gõ tay đã bỏ, xem LessonsPage.jsx).
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Đọc lại hồ sơ sau khi sửa users/{uid} (vd học sinh vừa đổi mật khẩu lần đầu, xoá cờ mustChangePassword).
  async function refreshProfile() {
    const u = auth.currentUser;
    if (!u) return;
    const snap = await getDoc(doc(db, "users", u.uid));
    setProfile(snap.exists() ? snap.data() : null);
  }

  useEffect(() => {
    // onAuthStateChanged tự bắn ngay lần đầu với trạng thái hiện tại — return cleanup để tránh
    // đăng ký trùng listener (React 19 StrictMode gọi effect 2 lần ở dev).
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        // Học sinh bị khoá, hoặc hồ sơ đã bị xoá (tài khoản Auth còn nhưng không còn quyền) → đăng xuất.
        if (!snap.exists() || snap.data().disabled) {
          await signOut(auth);
          return;
        }
        setRole(snap.data().role);
        setProfile(snap.data());
      } catch {
        // Đọc role lỗi (mất mạng...) — coi như chưa xác định, không chặn cả app.
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isStaff = role === "admin" || role === "teacher";
  // Tài khoản đặc biệt: làm được mọi bài (bỏ qua mật khẩu bộ đề/giới hạn lượt) nhưng không ghi
  // lịch sử — xem lib/historyGuard.js. Đặt cờ ngay trong render (không đợi effect) để chắc chắn
  // cờ đã bật trước khi bất kỳ Runner nào kịp mount và gọi hàm ghi.
  const isTester = role === "tester";
  setHistoryDisabled(isTester);

  const value = {
    user,
    role,
    profile,
    refreshProfile,
    loading,
    isStaff,
    isTester,
    isAdmin: role === "admin",
    isTeacher: role === "teacher",
    isStudent: role === "student",
    logout: () => signOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
