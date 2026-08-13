import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // null = guest (chưa đăng nhập/không có role)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged tự bắn ngay lần đầu với trạng thái hiện tại — return cleanup để tránh
    // đăng ký trùng listener (React 19 StrictMode gọi effect 2 lần ở dev).
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        setRole(snap.exists() ? snap.data().role : null);
      } catch {
        // Đọc role lỗi (mất mạng...) — coi như guest, không chặn cả app.
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isStaff = role === "admin" || role === "teacher";

  const value = {
    user,
    role,
    loading,
    isStaff,
    isAdmin: role === "admin",
    isTeacher: role === "teacher",
    logout: () => signOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
