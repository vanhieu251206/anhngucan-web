import { useEffect, useRef, useState } from "react";

// Luyện đề Listening Starters — Part 1 (nghe và nối tên với người trong tranh). Đáp án soạn ở
// StartersListeningExamStudio.jsx: pairs[{ id: "example"|"q1".."q5", a: rect, b: rect }], rect là khung
// { x, y, w, h } theo % ảnh. Học sinh chạm 1 điểm (hiện khung vuông nhỏ), chạm điểm thứ 2 → nối thành
// 1 nét. Khung vuông nhỏ lấy điểm chạm làm tâm; nếu 2 khung này chạm 2 khung của cùng 1 cặp (thứ tự
// nào cũng được) thì cặp đó đúng.
const POINT_SIZE = 22; // px — khớp .p1r-point; khung vuông này lấy điểm chạm làm tâm
// Điểm chạm đúng khi khung vuông nhỏ (tâm = điểm chạm) chạm/chồng lên khung đáp án.
function hits(pt, r, size) {
  const hx = (POINT_SIZE / 2 / size.w) * 100;
  const hy = (POINT_SIZE / 2 / size.h) * 100;
  return pt.x + hx >= r.x && pt.x - hx <= r.x + r.w && pt.y + hy >= r.y && pt.y - hy <= r.y + r.h;
}

function matchesPair(conn, pair, size) {
  return (
    (hits(conn.p1, pair.a, size) && hits(conn.p2, pair.b, size)) ||
    (hits(conn.p1, pair.b, size) && hits(conn.p2, pair.a, size))
  );
}
const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// reveal=false (màn học sinh làm Luyện đề): vẫn KHOÁ bài sau khi nộp nhưng KHÔNG tô đúng/sai hay hiện đáp án.
export default function StartersListeningPart1Runner({ part, submitted, reveal = true, onScore }) {
  const show = submitted && reveal;
  const pairs = (part.pairs ?? []).filter(p => p.a && p.b);
  const questions = pairs.filter(p => p.id !== "example"); // ví dụ đã nối sẵn trong ảnh, bỏ qua dữ liệu cũ

  const [conns, setConns] = useState([]); // [{ p1, p2 }]
  const [pending, setPending] = useState(null); // điểm chạm thứ nhất, chờ điểm thứ hai

  const stageRef = useRef(null);

  useEffect(() => { if (submitted) setPending(null); }, [submitted]);

  function handleStageClick(e) {
    if (submitted) return;
    const rect = stageRef.current.getBoundingClientRect();
    const pt = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    if (!pending) setPending(pt);
    else {
      setConns(c => [...c, { p1: pending, p2: pt }]);
      setPending(null);
    }
  }

  function undo() {
    if (submitted) return;
    if (pending) setPending(null);
    else setConns(c => c.slice(0, -1));
  }

  const box = stageRef.current?.getBoundingClientRect();
  const size = { w: box?.width || 1, h: box?.height || 1 };
  const solved = questions.filter(q => conns.some(c => matchesPair(c, q, size)));
  const missed = questions.filter(q => !solved.includes(q));
  const solvedCount = solved.length;
  useEffect(() => {
    onScore?.({ score: solvedCount, total: questions.length });
  }, [solvedCount, questions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const isRight = c => questions.some(q => matchesPair(c, q, size));

  return (
    <div className="p1r">
      <h2 className="p2s-title">Part 1</h2>
      <p className="p2s-count">– {questions.length} questions –</p>
      <p className="p2s-instr">Listen and draw lines. There is one example.</p>
      <p className="p1r-sub">Nghe audio, rồi chạm vào tên của bạn nhỏ, sau đó chạm vào bạn ấy trong tranh. Con sẽ thấy một đường nối giữa tên và bạn ấy.</p>
      {part.audioUrl && <audio className="p2r-audio" src={part.audioUrl} controls />}

      <div
        ref={stageRef}
        className="p1r-stage"
        onClick={handleStageClick}
        style={{ cursor: submitted ? "default" : "crosshair" }}
      >
        <img src={part.imageUrl} alt="" draggable={false} />

        <svg className="p1r-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {conns.map((c, i) => (
            <line
              key={i}
              x1={c.p1.x} y1={c.p1.y} x2={c.p2.x} y2={c.p2.y}
              stroke={!show ? "#f5711f" : isRight(c) ? "#2e9d5b" : "#d64545"}
              strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinecap="round"
            />
          ))}
          {show && missed.map(q => {
            const a = center(q.a);
            const b = center(q.b);
            return <line key={q.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2e9d5b" strokeWidth="4" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />;
          })}
        </svg>

        {conns.map((c, i) => [c.p1, c.p2].map((pt, j) => (
          <span key={`${i}-${j}`} className="p1r-point" style={{ left: `${pt.x}%`, top: `${pt.y}%` }} />
        )))}
        {pending && <span className="p1r-point is-pending" style={{ left: `${pending.x}%`, top: `${pending.y}%` }} />}
      </div>

      {!submitted && (
        <div className="p1r-actions">
          <button type="button" className="btn btn-secondary" onClick={undo} disabled={!pending && conns.length === 0}>↶ Hoàn tác</button>
        </div>
      )}
    </div>
  );
}
