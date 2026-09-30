import { useEffect, useState } from "react";
import { useClassBook } from "./useClassBook.js";
import { nextClassSession } from "./classes.js";

const WEEKDAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const pad = n => String(n).padStart(2, "0");

// Buổi học tiếp theo của lớp học sinh (sidebar Header.jsx + trang "Bài của con"), vd
// { when: "Thứ 5, 18:00", left: "còn 2 ngày" } — null khi không phải học sinh / lớp chưa có lịch.
export function useNextClass() {
  const { cls } = useClassBook();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const next = nextClassSession(cls, now);
  if (!next) return null;
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(next) - startOfDay(now)) / 86400000);
  const dayText = dayDiff === 0 ? "Hôm nay" : dayDiff === 1 ? "Ngày mai" : WEEKDAY_NAMES[next.getDay()];
  const time = cls?.time ? `, ${pad(next.getHours())}:${pad(next.getMinutes())}` : "";
  const mins = Math.max(1, Math.round((next - now) / 60000));
  const left = mins < 60 ? `còn ${mins} phút` : mins < 24 * 60 ? `còn ${Math.floor(mins / 60)} giờ` : `còn ${dayDiff} ngày`;
  return { when: `${dayText}${time}`, left: cls?.time || dayDiff > 0 ? left : "" };
}
