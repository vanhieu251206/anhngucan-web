import { useEffect, useRef, useState } from "react";

// Đồng hồ làm bài DÙNG CHUNG cho mọi loại bài (Speaking, Reading, Dictation, Listening, IELTS...).
// - Có `limitMinutes` (giáo viên đặt trong CMS): đếm ngược, hết giờ gọi `onExpire` đúng 1 lần (runner tự nộp bài).
// - Không có: đếm lên, chỉ để hiện/ghi thời gian làm bài.
// `running=false` (đã nộp bài) thì đóng băng, `getElapsedMs()` cho báo cáo lấy thời gian đã làm.
export function useExamTimer({ limitMinutes, running = true, onExpire, resetKey }) {
  const startRef = useRef(Date.now());
  const stoppedAtRef = useRef(null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const [, setTick] = useState(0);

  const limitMs = limitMinutes > 0 ? limitMinutes * 60000 : null;

  // Đổi resetKey (vd "Làm lại") = bắt đầu đếm lại từ đầu.
  const lastResetRef = useRef(resetKey);
  if (lastResetRef.current !== resetKey) {
    lastResetRef.current = resetKey;
    startRef.current = Date.now();
    stoppedAtRef.current = null;
    expiredRef.current = false;
  }

  useEffect(() => {
    if (!running) {
      stoppedAtRef.current ??= Date.now();
      return;
    }
    const id = setInterval(() => {
      setTick(t => t + 1);
      if (limitMs && !expiredRef.current && Date.now() - startRef.current >= limitMs) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    }, 500);
    return () => clearInterval(id);
  }, [running, limitMs]);

  const getElapsedMs = () => (stoppedAtRef.current ?? Date.now()) - startRef.current;
  const elapsedMs = getElapsedMs();
  return {
    limitMs,
    elapsedMs,
    remainingMs: limitMs ? Math.max(0, limitMs - elapsedMs) : null,
    getElapsedMs,
  };
}

function clock(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function ExamTimer({ timer }) {
  const countdown = timer.limitMs != null;
  const ms = countdown ? timer.remainingMs : timer.elapsedMs;
  const urgent = countdown && ms <= 60000;
  return (
    <div className={`exam-timer${urgent ? " is-urgent" : ""}`} role="timer" aria-label={countdown ? "Thời gian còn lại" : "Thời gian đã làm"}>
      <span aria-hidden="true">⏱</span>
      <strong>{clock(ms)}</strong>
    </div>
  );
}
