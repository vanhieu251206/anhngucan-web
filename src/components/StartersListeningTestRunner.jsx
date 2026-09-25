import { useEffect, useRef, useState } from "react";
import StartersListeningPart1Runner from "./StartersListeningPart1Runner.jsx";
import StartersListeningPart2Runner from "./StartersListeningPart2.jsx";
import StartersListeningPart3Runner from "./StartersListeningPart3.jsx";
import StartersListeningPart4Runner, { part4Has } from "./StartersListeningPart4.jsx";
import MoversListeningPart3Runner from "./MoversListeningPart3.jsx";
import ExamTimer, { useExamTimer } from "./ExamTimer.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { useTestSubmission } from "../lib/testSubmit.js";
import { serverGrader } from "../lib/grading/listeningExam.js";
import SubmitStatus from "./SubmitStatus.jsx";

const Part3Dispatch = props => (props.part.variant === "movers" ? <MoversListeningPart3Runner {...props} /> : <StartersListeningPart3Runner {...props} />);

// Làm 1 Test Luyện đề Listening Starters: gộp mọi Part đã có nội dung thành MỘT trang cuộn xuống, làm
// xong hết mới bấm "Nộp bài" một lần duy nhất — điểm tổng cộng các Part.
// Movers Part 4 (partNo = 4) là dạng tick A/B/C như Part 3 Starters; Starters Part 4 là tô màu.
const Part4Dispatch = props => (props.part.partNo === 4 ? <StartersListeningPart3Runner {...props} /> : <StartersListeningPart4Runner {...props} />);

const PARTS = [
  { key: "part1", Runner: StartersListeningPart1Runner, has: p => !!p?.imageUrl },
  { key: "part2", Runner: StartersListeningPart2Runner, has: p => !!p?.imageUrl },
  { key: "part3", Runner: Part3Dispatch, has: p => !!p?.questions?.some(q => q.question?.trim()) },
  { key: "part4", Runner: Part4Dispatch, has: p => (p?.partNo === 4 ? !!p?.questions?.some(q => q.question?.trim()) : part4Has(p)) },
  { key: "part5", Runner: StartersListeningPart4Runner, has: p => part4Has(p) },
];

// Test có ít nhất 1 Part đã soạn thì mở được (dùng cho thẻ Test ở LessonsPage).
export const testHasContent = test => PARTS.some(p => p.has(test?.parts?.[p.key]));

export default function StartersListeningTestRunner({ test, studentUid, studentName, studentClass, seriesId, level, lessonLabel, openingId }) {
  const { isStaff, isTester } = useAuth();
  const canReview = isStaff || isTester; // tô đúng/sai + hiện đáp án cho admin/giáo viên/tài khoản đặc biệt
  const available = PARTS.filter(p => p.has(test.parts?.[p.key]));
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Đồng hồ chung (ExamTimer.jsx): hết giờ tự nộp bài; đóng băng khi đã nộp, đếm lại khi "Làm lại".
  // Học sinh: máy chủ chấm (lib/testSubmit.js — đề học sinh không có đáp án), điểm từng Part trả về ở serverResult.
  const [submitState, setSubmitState] = useState(null); // { error? } khi đang nộp/lỗi
  const [serverResult, setServerResult] = useState(null);
  const submitToServer = useTestSubmission({
    kind: "listening-exam", seriesId, level, testId: test.testId ?? test.id, openingId, lessonLabel, studentName, resetKey: attempt,
  });
  const timer = useExamTimer({ limitMinutes: test.timeLimitMinutes, running: !submitted && !submitState, onExpire: doSubmit, resetKey: attempt });
  const [scores, setScores] = useState({});

  const [activeKey, setActiveKey] = useState(available[0]?.key);
  const sectionRefs = useRef({});

  // Theo dõi Part đang nằm ở vùng nhìn thấy (vùng cuộn là .reading-fullscreen-body) để tô màu card.
  useEffect(() => {
    const first = sectionRefs.current[available[0]?.key];
    const root = first?.closest(".reading-fullscreen-body") ?? null;
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) if (e.isIntersecting) setActiveKey(e.target.dataset.part);
      },
      { root, rootMargin: "-25% 0px -60% 0px" },
    );
    available.forEach(p => sectionRefs.current[p.key] && obs.observe(sectionRefs.current[p.key]));
    return () => obs.disconnect();
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  function jumpTo(key) {
    setActiveKey(key);
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Mỗi Part báo { score, total, answers } — answers là câu trả lời thô để máy chủ chấm lại.
  const report = key => s => setScores(prev => ({ ...prev, [key]: s }));
  // Điểm hiển thị: học sinh dùng điểm máy chủ trả về; admin/giáo viên (đề có đáp án) dùng điểm chấm tại chỗ.
  const shownScores = serverResult?.parts ?? scores;
  const total = serverResult ? serverResult.total : available.reduce((sum, p) => sum + (scores[p.key]?.total ?? 0), 0);
  const score = serverResult ? serverResult.correct : available.reduce((sum, p) => sum + (scores[p.key]?.score ?? 0), 0);

  // Học sinh chỉ thấy tổng số câu đúng; chi tiết theo Part lưu cho giáo viên/admin (lib/testResults.js).
  async function doSubmit() {
    if (submitted || (submitState && !submitState.error)) return;
    // Part chấm được ở máy chủ gửi câu trả lời thô; Part tô màu/viết vào tranh (canvas) gửi điểm tự chấm.
    const parts = Object.fromEntries(
      available.map(p => [p.key, serverGrader(p.key, test.parts[p.key]) ? { answers: scores[p.key]?.answers ?? null } : { score: scores[p.key]?.score ?? 0 }]),
    );
    const payload = { answers: { parts }, elapsedMs: timer.getElapsedMs() };
    if (canReview) {
      setSubmitted(true);
      submitToServer(payload).catch(() => {});
      return;
    }
    setSubmitState({});
    try {
      setServerResult(await submitToServer(payload));
      setSubmitted(true);
      setSubmitState(null);
    } catch (error) {
      setSubmitState({ error });
    }
  }

  function reset() {
    setScores({});
    setServerResult(null);
    setSubmitState(null);
    setSubmitted(false);
    setAttempt(a => a + 1);
  }

  return (
    <div className="exam-layout">
      <ExamTimer timer={timer} />
      <nav className="exam-side" aria-label="Danh sách Part">
        {available.map(p => {
          const sc = shownScores[p.key];
          return (
            <button
              key={p.key}
              type="button"
              className={`exam-side-card${activeKey === p.key ? " is-active" : ""}`}
              onClick={() => jumpTo(p.key)}
            >
              <strong>Part {p.key.slice(4)}</strong>
              <small>{submitted && sc ? `${sc.score}/${sc.total}` : `${sc?.total ?? 5} câu`}</small>
            </button>
          );
        })}
        {submitState ? (
          <SubmitStatus error={submitState.error} onRetry={doSubmit} />
        ) : !submitted ? (
          <button type="button" className="btn btn-primary exam-side-submit" onClick={doSubmit}>Nộp bài</button>
        ) : (
          <>
            <div className="exam-side-score">Kết quả: {score} / {total}</div>
            {(!studentUid || canReview) && <button type="button" className="btn btn-secondary exam-side-submit" onClick={reset}>Làm lại</button>}
          </>
        )}
      </nav>

      <div className="exam-test">
        {available.map(({ key, Runner }) => (
          <section
            className="exam-test-part"
            key={`${key}-${attempt}`}
            data-part={key}
            ref={el => { sectionRefs.current[key] = el; }}
          >
            <Runner part={test.parts[key]} submitted={submitted} reveal={canReview} onScore={report(key)} />
          </section>
        ))}

      </div>
    </div>
  );
}
