import { useEffect, useState } from "react";
import { useAuth } from "./authContext.jsx";
import { getClass, bookAllowsSeries, bookAllowsLevel } from "./classes.js";

// Lớp (và sách được gán) của học sinh đang đăng nhập — xem lib/classes.js "Sách của lớp". Nhớ tạm theo tên lớp để
// chuyển qua lại các trang không phải tải lại. Admin/giáo viên/tester: không giới hạn.
const cache = new Map(); // className -> Promise<class|null>

function loadClass(className) {
  if (!cache.has(className)) {
    const p = getClass(className).catch(() => {
      cache.delete(className);
      return null;
    });
    cache.set(className, p);
  }
  return cache.get(className);
}

export function useClassBook() {
  const { role, profile } = useAuth();
  const isStudent = role === "student";
  const className = isStudent ? profile?.className || "" : "";
  const [cls, setCls] = useState(undefined); // undefined = đang tải

  useEffect(() => {
    if (!isStudent) return;
    if (!className) {
      setCls(null);
      return;
    }
    let alive = true;
    setCls(undefined);
    loadClass(className).then(c => alive && setCls(c));
    return () => {
      alive = false;
    };
  }, [isStudent, className]);

  const book = cls?.book ?? null;
  return {
    cls: isStudent ? cls : null,
    // Đã biết quyền (dùng để đẩy học sinh ra khỏi cấp mở sẵn từ URL mà lớp không được gán).
    ready: !isStudent || cls !== undefined,
    // Đang tải → tạm khoá (tránh bấm lọt vào bộ đề không được gán).
    canSeries: seriesId => !isStudent || (cls !== undefined && bookAllowsSeries(book, seriesId)),
    canLevel: (seriesId, level) => !isStudent || (cls !== undefined && bookAllowsLevel(book, seriesId, level)),
  };
}
