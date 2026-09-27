import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { useAuth } from "./authContext.jsx";
import { bookAllowsSeries, bookAllowsLevel } from "./classes.js";
import { levelAccessOf, seriesHasAccess } from "./teacherScope.js";

// Lớp (và sách được gán) của học sinh đang đăng nhập — xem lib/classes.js "Sách của lớp". Theo dõi trực tiếp doc
// classes/{tên lớp} (onSnapshot): giáo viên đổi sách / chuyển lớp là có hiệu lực ngay, không cần tải lại trang
// (Firestore tự gộp các listener cùng 1 doc). Admin/giáo viên chính/tester: không giới hạn. Giáo viên phụ (restricted):
// chỉ vào được cấp được cấp quyền Xem hoặc Sửa (lib/teacherScope.js, 2026-09-27).
export function useClassBook() {
  const { role, profile } = useAuth();
  const isStudent = role === "student";
  const className = isStudent ? profile?.className || "" : "";
  const [cls, setCls] = useState(undefined); // undefined = đang tải, null = không có lớp / lớp chưa tạo
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isStudent) return;
    setError(false);
    if (!className) {
      setCls(null);
      return;
    }
    setCls(undefined);
    return onSnapshot(
      doc(db, "classes", className),
      snap => setCls(snap.exists() ? { name: className, ...snap.data() } : { name: className }),
      () => {
        setCls(null);
        setError(true);
      }
    );
  }, [isStudent, className]);

  const book = cls?.book ?? null;
  // Giáo viên phụ: giới hạn theo từng cấp được cấp quyền (Xem hoặc Sửa).
  if (role === "teacher" && profile?.restricted) {
    return {
      cls: null,
      error: false,
      ready: true,
      canSeries: seriesId => seriesHasAccess(profile, role, seriesId),
      canLevel: (seriesId, level) => !!levelAccessOf(profile, role, seriesId, level),
    };
  }
  return {
    cls: isStudent ? cls : null,
    // Không tải được lớp (mất mạng...) — trang hiện lời nhắc thay vì chỉ để mọi bộ đề xám không rõ lý do.
    error: isStudent && error,
    // Đã biết quyền (dùng để đẩy học sinh ra khỏi cấp mở sẵn từ URL mà lớp không được gán).
    ready: !isStudent || cls !== undefined,
    // Đang tải → tạm khoá (tránh bấm lọt vào bộ đề không được gán).
    canSeries: seriesId => !isStudent || (cls !== undefined && bookAllowsSeries(book, seriesId)),
    canLevel: (seriesId, level) => !isStudent || (cls !== undefined && bookAllowsLevel(book, seriesId, level)),
  };
}
