import { useEffect, useRef, useState } from "react";
import StartersListeningPart1Runner from "./StartersListeningPart1Runner.jsx";
import StartersListeningPart2Runner from "./StartersListeningPart2.jsx";
import StartersListeningPart3Runner from "./StartersListeningPart3.jsx";
import StartersListeningPart4Runner from "./StartersListeningPart4.jsx";

// Làm 1 Test Luyện đề Listening Starters: gộp mọi Part đã có nội dung thành MỘT trang cuộn xuống, làm
// xong hết mới bấm "Nộp bài" một lần duy nhất — điểm tổng cộng các Part.
const PARTS = [
  { key: "part1", Runner: StartersListeningPart1Runner, has: p => !!p?.imageUrl },
  { key: "part2", Runner: StartersListeningPart2Runner, has: p => !!p?.imageUrl },
  { key: "part3", Runner: StartersListeningPart3Runner, has: p => !!p?.questions?.some(q => q.question?.trim()) },
  { key: "part4", Runner: StartersListeningPart4Runner, has: p => !!p?.imageUrl && !!p?.items?.some(i => i.frame) },
];

// Test có ít nhất 1 Part đã soạn thì mở được (dùng cho thẻ Test ở LessonsPage).
export const testHasContent = test => PARTS.some(p => p.has(test?.parts?.[p.key]));

export default function StartersListeningTestRunner({ test }) {
  const available = PARTS.filter(p => p.has(test.parts?.[p.key]));
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(0);
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

  const report = key => s => setScores(prev => (prev[key]?.score === s.score && prev[key]?.total === s.total ? prev : { ...prev, [key]: s }));
  const total = available.reduce((sum, p) => sum + (scores[p.key]?.total ?? 0), 0);
  const score = available.reduce((sum, p) => sum + (scores[p.key]?.score ?? 0), 0);

  function reset() {
    setScores({});
    setSubmitted(false);
    setAttempt(a => a + 1);
  }

  return (
    <div className="exam-layout">
      <nav className="exam-side" aria-label="Danh sách Part">
        {available.map((p, i) => {
          const sc = scores[p.key];
          return (
            <button
              key={p.key}
              type="button"
              className={`exam-side-card${activeKey === p.key ? " is-active" : ""}`}
              onClick={() => jumpTo(p.key)}
            >
              <strong>Part {i + 1}</strong>
              <small>{submitted && sc ? `${sc.score}/${sc.total}` : `${sc?.total ?? 5} câu`}</small>
            </button>
          );
        })}
        {!submitted ? (
          <button type="button" className="btn btn-primary exam-side-submit" onClick={() => setSubmitted(true)}>Nộp bài</button>
        ) : (
          <>
            <div className="exam-side-score">Kết quả: {score} / {total}</div>
            <button type="button" className="btn btn-secondary exam-side-submit" onClick={reset}>Làm lại</button>
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
            <Runner part={test.parts[key]} submitted={submitted} onScore={report(key)} />
          </section>
        ))}

      </div>
    </div>
  );
}
