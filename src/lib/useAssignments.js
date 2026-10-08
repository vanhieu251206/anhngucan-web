import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { useAuth } from "./authContext.jsx";
import { attemptKey, openingForStudent } from "./openings.js";
import { getAttemptInfo } from "./attempts.js";

// Bài giáo viên mở cho lớp của học sinh (chuông AssignmentBell.jsx + trang "Bài của con" MyWorkPage.jsx) — theo dõi
// trực tiếp (onSnapshot) nên giáo viên vừa mở/sửa/đóng bài là học sinh thấy ngay. Chỉ tài khoản học sinh có lớp.
//   active:  lần mở còn hạn, hạn gần nhất lên đầu
//   expired: lần mở đã hết hạn (giáo viên chưa đóng), hạn gần nhất lên đầu
//   info[openingId]: { count, lastCorrect, bestCorrect, total } — lượt đã nộp + điểm tóm tắt (lib/attempts.js)
//   now: mốc thời gian hiện tại, tự cập nhật mỗi phút (bài quá hạn tự chuyển nhóm)
export function useAssignments() {
  const { user, isStudent, profile } = useAuth();
  const className = isStudent ? profile?.className ?? null : null;
  const uid = user?.uid;
  const [openings, setOpenings] = useState([]);
  const [info, setInfo] = useState({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setOpenings([]);
    if (!className) return;
    return onSnapshot(
      query(collection(db, "openings"), where("className", "==", className)),
      // Em được giáo viên mở lại riêng: hạn chót + số lượt hiện theo hạn riêng của em (openingForStudent).
      snap => setOpenings(snap.docs.map(d => openingForStudent({ id: d.id, ...d.data() }, uid))),
      () => setOpenings([])
    );
  }, [className, uid]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { active, expired } = useMemo(() => {
    const deadline = o => o.expiresAt?.toMillis?.() ?? Infinity;
    const sorted = [...openings].sort((a, b) => deadline(a) - deadline(b));
    return {
      active: sorted.filter(o => deadline(o) > now),
      expired: sorted.filter(o => deadline(o) <= now).reverse(),
    };
  }, [openings, now]);

  const refreshInfo = useCallback(async () => {
    if (!uid || !openings.length) return;
    const rows = await Promise.all(
      openings.map(o => getAttemptInfo(uid, o.kind, attemptKey(o.testId, o.id)).catch(() => null))
    );
    setInfo(Object.fromEntries(openings.map((o, i) => [o.id, rows[i]])));
  }, [uid, openings]);

  const idsKey = openings.map(o => o.id).join(",");
  useEffect(() => {
    refreshInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, idsKey]);

  return { enabled: !!className, uid, active, expired, info, now, refreshInfo };
}
