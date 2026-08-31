import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // null = chưa đăng nhập/không có role
  // Hồ sơ học sinh (displayName/className/username) đọc thẳng từ doc users/{uid} — dùng để tự
  // điền tên/lớp khi vào bài (thay cho NamePromptScreen kiểu gõ tay đã bỏ, xem LessonsPage.jsx).
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
        setRole(snap.exists() ? snap.data().role : null);
        setProfile(snap.exists() ? snap.data() : null);
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

  const value = {
    user,
    role,
    profile,
    loading,
    isStaff,
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
