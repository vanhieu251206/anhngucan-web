import { useMemo, useRef, useState } from "react";
import ReadingReportView from "./ReadingReportView.jsx";

// Runner học sinh cho Reading & Writing — 1 TRANG SCROLL DÀI duy nhất cho cả Test (mọi Part nối
// tiếp nhau), có sidebar trái "Danh sách câu hỏi" để nhảy nhanh đến từng câu, giống bố cục các
// nền tảng luyện thi thật (vd YourHomework) — khác với SceneRunner của Speaking (chạy tuần tự
// từng scene kiểu Duolideo, không cuộn được cả bài 1 lượt). Nộp bài 1 LẦN cho toàn bộ Test, sau đó
// chuyển hẳn sang màn tổng kết (ReadingReportView.jsx) — cùng luồng với Speaking (chốt 2026-08-26).

// Yêu cầu tiếng Anh mặc định cho dạng "Xáo chữ cái đoán từ vựng" — hiện ngay sau "Question N."
// giống các dạng câu hỏi Cambridge YLE khác đều có câu hướng dẫn cố định (vd gapfill "Look and
// read. Write yes or no."). Giáo viên có thể sửa lại trong CMS nếu muốn, nhưng luôn có sẵn từ đầu
// thay vì để trống (yêu cầu người dùng 2026-08-26). Dùng CHUNG với ReadingStudio.jsx (blankQuestion)
// để câu mặc định lúc soạn và lúc học sinh xem luôn khớp nhau.
export const WORD_SCRAMBLE_DEFAULT_TEXT = "Look and read. Write the word.";

function normalizeAnswer(s) {
  return (s ?? "").trim().toLowerCase();
}

function splitGapfillText(text) {
  return (text ?? "").split("___");
}

// Tổng điểm của 1 câu — mặc định 1 nếu giáo viên chưa nhập (dữ liệu cũ trước khi có tính năng
// điểm số, hoặc lỡ để trống/nhập số âm) cũng rơi vào trường hợp này, tránh câu 0 điểm ngoài ý muốn.
export function questionPoints(question) {
  const n = Number(question.points);
  return n > 0 ? n : 1;
}

// Điểm của TỪNG chỗ trống trong câu gapfill — tổng điểm câu chia đều cho số chỗ trống (yêu cầu
// người dùng 2026-08-26: "dạng điền chỗ trống thì điểm của question đó tự chia đều cho các vị trí
// trống cần điền trong câu"). blankCount=0 (chưa có chỗ trống nào) trả về 0, tránh chia cho 0.
export function gapPoints(question, blankCount) {
  if (!blankCount) return 0;
  return questionPoints(question) / blankCount;
}

// Xáo chữ cái THẬT MẠNH: lặp lại tới khi KHÔNG CÒN chữ cái nào đứng đúng vị trí gốc (derangement),
// không chỉ đơn thuần khác thứ tự gốc — tránh tình trạng xáo yếu chỉ đổi chỗ 1-2 chữ khiến từ vẫn
// nhìn gần giống bản gốc (phản hồi thực tế 2026-08-26, vd "APPLE" xáo ra y hệt "APPLE"). Giới hạn
// 30 lần thử — từ có toàn chữ cái giống nhau (vd "OOO") không thể derange thật sự thì dùng bản xáo
// cuối cùng, không lặp vô hạn.
export function scrambleWord(word) {
  const chars = word.split("");
  if (chars.length < 2) return word;
  let attempt = [...chars];
  for (let tries = 0; tries < 30; tries++) {
    for (let i = attempt.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [attempt[i], attempt[j]] = [attempt[j], attempt[i]];
    }
    if (attempt.every((c, i) => c !== chars[i])) break;
  }
  return attempt.join("");
}

// Gộp mọi câu hỏi của mọi Part thành 1 danh sách phẳng, đánh số "Question N." liên tục xuyên suốt
// Test — dùng để đồng bộ số thứ tự giữa nội dung chính và sidebar.
function flattenQuestions(parts) {
  const flat = [];
  let n = 1;
  parts.forEach((part, partIndex) => {
    (part.questions ?? []).forEach((q, qIndex) => {
      flat.push({ question: q, partIndex, qIndex, qNumber: n });
      n += 1;
    });
  });
  return flat;
}

function isAnswered(question, value) {
  if (question.type === "gapfill") return (value ?? []).some(v => (v ?? "").trim());
  return !!(value ?? "").toString().trim();
}

// Số thứ tự tròn — hiện đầu mỗi câu. Export để ReadingStudio.jsx (xem trước trong CMS) dùng lại,
// cho preview giống hệt màn học sinh.
export function QuestionBadge({ qNumber }) {
  return (
    <div className="reading-question-badge">
      <span className="reading-question-num">{qNumber}</span>
    </div>
  );
}

function YesNoQuestion({ question, qNumber, value, onChange }) {
  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        <p className="reading-question-text">{question.text}</p>
        {question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <div className="reading-yesno-btns">
          {["yes", "no"].map(opt => (
            <button
              key={opt}
              type="button"
              className={`reading-yesno-btn${value === opt ? " is-selected" : ""}`}
              onClick={() => onChange(opt)}
            >
              {opt === "yes" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GapfillQuestion({ question, qNumber, values, onChange }) {
  const segments = useMemo(() => splitGapfillText(question.text), [question.text]);
  const answers = question.answers ?? [];

  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        {question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <p className="reading-gapfill-text">
          {segments.map((seg, i) => {
            const isLast = i === segments.length - 1;
            const gapIndex = i;
            if (isLast) return <span key={i}>{seg}</span>;
            const answered = values[gapIndex] ?? "";
            const correct = answers[gapIndex];
            return (
              <span key={i}>
                {seg}
                <input
                  className="reading-gap-input"
                  value={answered}
                  onChange={e => onChange(gapIndex, e.target.value)}
                  size={Math.max(4, (correct?.length ?? 6) + 2)}
                />
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}

function ShortAnswerQuestion({ question, qNumber, value, onChange }) {
  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        {question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <p className="reading-question-text">
          {(question.prompt ?? "").includes("___") ? (
            (question.prompt ?? "").split("___").map((seg, i, arr) => (
              <span key={i}>
                {seg}
                {i < arr.length - 1 && (
                  <input
                    className="reading-gap-input"
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    size={10}
                  />
                )}
              </span>
            ))
          ) : (
            <>
              {question.prompt}{" "}
              <input
                className="reading-gap-input"
                value={value ?? ""}
                onChange={e => onChange(e.target.value)}
                size={10}
              />
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// Xáo chữ cái đoán từ vựng qua ảnh minh hoạ: đề bài hiện SẴN từ đã xáo trộn mạnh (scrambleWord —
// không còn chữ nào đứng đúng vị trí gốc), học sinh GÕ TỪNG CHỮ CÁI vào dãy ô trống bằng bàn phím,
// gõ xong 1 ô tự nhảy sang ô kế tiếp (kiểu nhập mã PIN/OTP — chốt 2026-08-26, thay cho cách bấm-
// chọn ô chữ cái trước đó). `value` lưu mảng ký tự học sinh đã gõ theo đúng vị trí (value[i] = ký
// tự ở ô thứ i), không liên quan tới thứ tự xáo trộn hiển thị.
function WordScrambleQuestion({ question, qNumber, value, onChange }) {
  const answer = question.answer ?? "";
  const scrambled = useMemo(() => scrambleWord(answer), [answer]);
  const typed = value ?? [];
  const inputRefs = useRef([]);

  function setChar(pos, rawValue) {
    const char = rawValue.slice(-1); // chỉ giữ ký tự cuối gõ vào (phòng IME/trình duyệt gộp)
    const next = [...typed];
    next[pos] = char;
    onChange(next);
    if (char && pos < answer.length - 1) inputRefs.current[pos + 1]?.focus();
  }

  function handleKeyDown(pos, e) {
    if (e.key === "Backspace" && !typed[pos] && pos > 0) {
      const next = [...typed];
      next[pos - 1] = "";
      onChange(next);
      inputRefs.current[pos - 1]?.focus();
    }
  }

  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        <p className="reading-question-text">{question.text || WORD_SCRAMBLE_DEFAULT_TEXT}</p>
        {/* Đề bài: từ đã xáo trộn, chỉ để ĐỌC, không tương tác được — đặt TRÊN ảnh minh hoạ. */}
        <div className="reading-scramble-prompt">
          {scrambled.split("").map((c, i) => (
            <span className="reading-scramble-prompt-tile" key={i}>{c}</span>
          ))}
        </div>

        {question.image && <img src={question.image} alt="" className="reading-question-img" />}

        {/* Ô trả lời kiểu nhập mã PIN — mỗi ô 1 ký tự, gõ xong tự nhảy ô kế tiếp. */}
        <div className="reading-scramble-pin-row">
          {answer.split("").map((_, pos) => (
            <input
              key={pos}
              ref={el => (inputRefs.current[pos] = el)}
              className="reading-scramble-pin-input"
              value={typed[pos] ?? ""}
              maxLength={1}
              autoCapitalize="characters"
              autoComplete="off"
              onFocus={e => e.target.select()}
              onChange={e => setChar(pos, e.target.value)}
              onKeyDown={e => handleKeyDown(pos, e)}
            />
          ))}
        </div>

        {typed.some(c => c) && (
          <button type="button" className="reading-scramble-clear" onClick={() => onChange([])}>
            ↺ Xoá hết, làm lại
          </button>
        )}
      </div>
    </div>
  );
}

// Sidebar trái — danh sách số thứ tự câu hỏi, bấm vào nhảy (scroll) đến đúng câu trong trang, kèm
// thanh tiến độ "đã làm X/Y câu" ở đầu để học sinh biết còn bao nhiêu câu chưa làm.
function QuestionListSidebar({ flat, answers }) {
  function goTo(qNumber) {
    document.getElementById(`rq-${qNumber}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const answeredCount = flat.filter(({ question, partIndex, qIndex }) =>
    isAnswered(question, answers[partIndex]?.[qIndex])
  ).length;
  const pct = flat.length ? Math.round((answeredCount / flat.length) * 100) : 0;

  return (
    <div className="reading-sidebar">
      <h3 className="reading-sidebar-title">Danh sách câu hỏi</h3>
      <div className="reading-sidebar-progress">
        <div className="reading-sidebar-progress-bar">
          <div className="reading-sidebar-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span>{answeredCount}/{flat.length} câu</span>
      </div>
      <div className="reading-sidebar-grid">
        {flat.map(({ qNumber, question, partIndex, qIndex }) => {
          const answered = isAnswered(question, answers[partIndex]?.[qIndex]);
          return (
            <button
              key={qNumber}
              type="button"
              className={`reading-sidebar-dot${answered ? " is-answered" : ""}`}
              onClick={() => goTo(qNumber)}
            >
              {qNumber}
            </button>
          );
        })}
      </div>
      <p className="reading-sidebar-hint">● Đã làm</p>
    </div>
  );
}

// Chấm điểm TOÀN BỘ bài + dựng sẵn nội dung hiển thị cho từng câu (đáp án học sinh chọn/gõ vs đáp
// án đúng) — dùng ngay khi bấm "Nộp bài", kết quả đưa thẳng vào ReadingReportView.jsx.
function buildResults(flat, answers) {
  let earnedPoints = 0;
  let totalPoints = 0;
  const items = flat.map(({ question, partIndex, qIndex, qNumber }) => {
    const value = answers[partIndex]?.[qIndex];
    const qPoints = questionPoints(question);
    totalPoints += qPoints;

    if (question.type === "yesno") {
      const isCorrect = value === question.answer;
      const earned = isCorrect ? qPoints : 0;
      earnedPoints += earned;
      return {
        qNumber,
        question,
        isCorrect,
        earned,
        total: qPoints,
        studentAnswer: value ? (value === "yes" ? "Yes" : "No") : "(chưa trả lời)",
        correctAnswer: question.answer === "yes" ? "Yes" : "No",
      };
    }

    if (question.type === "gapfill") {
      const gapAnswers = question.answers ?? [];
      const perGap = gapPoints(question, gapAnswers.length);
      let gapEarned = 0;
      const blanks = gapAnswers.map((a, gi) => {
        const ok = normalizeAnswer(value?.[gi]) === normalizeAnswer(a);
        if (ok) gapEarned += perGap;
        return { correct: ok, studentAnswer: value?.[gi]?.trim() || "(để trống)", correctAnswer: a };
      });
      earnedPoints += gapEarned;
      return {
        qNumber,
        question,
        isCorrect: gapAnswers.length > 0 && blanks.every(b => b.correct),
        earned: Math.round(gapEarned * 100) / 100,
        total: qPoints,
        blanks,
      };
    }

    if (question.type === "short-answer") {
      const isCorrect = normalizeAnswer(value) === normalizeAnswer(question.answer);
      const earned = isCorrect ? qPoints : 0;
      earnedPoints += earned;
      return {
        qNumber,
        question,
        isCorrect,
        earned,
        total: qPoints,
        studentAnswer: (value ?? "").trim() || "(chưa trả lời)",
        correctAnswer: question.answer,
      };
    }

    // word-scramble
    const built = (value ?? []).join("");
    const isCorrect = normalizeAnswer(built) === normalizeAnswer(question.answer);
    const earned = isCorrect ? qPoints : 0;
    earnedPoints += earned;
    return {
      qNumber,
      question,
      isCorrect,
      earned,
      total: qPoints,
      studentAnswer: built || "(chưa trả lời)",
      correctAnswer: (question.answer ?? "").toUpperCase(),
    };
  });

  return { items, earnedPoints: Math.round(earnedPoints * 100) / 100, totalPoints };
}

// Component chính — hiện TOÀN BỘ Test (mọi Part nối tiếp) trên 1 trang cuộn được, nộp bài 1 lần
// rồi chuyển hẳn sang màn tổng kết (không còn chấm màu ngay trong lúc làm — cùng luồng Speaking).
export default function ReadingRunner({ parts, onFinish }) {
  const flat = useMemo(() => flattenQuestions(parts), [parts]);
  // answers[partIndex][qIndex] = giá trị trả lời — giữ cấu trúc lồng theo Part/câu để khớp đúng
  // dữ liệu gốc (parts[].questions[]), dễ tính điểm theo từng Part nếu cần sau này.
  const [answers, setAnswers] = useState(() => parts.map(p => (p.questions ?? []).map(() => undefined)));
  const [results, setResults] = useState(null); // null = chưa nộp bài
  // Bấm "Nộp bài" KHÔNG nộp ngay — luôn phải xác nhận qua modal (nếu còn câu chưa làm thì cảnh báo
  // rõ số câu còn thiếu), tránh nộp nhầm do lỡ tay (yêu cầu người dùng 2026-08-26).
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const startedAtRef = useRef(Date.now());

  function setAnswer(partIndex, qIndex, val) {
    setAnswers(a => {
      const next = a.map(row => [...row]);
      next[partIndex][qIndex] = val;
      return next;
    });
  }

  function submit() {
    setConfirmingSubmit(false);
    setResults(buildResults(flat, answers));
  }

  if (!flat.length) return null;

  const unansweredCount = flat.filter(
    ({ question, partIndex, qIndex }) => !isAnswered(question, answers[partIndex]?.[qIndex])
  ).length;

  if (results) {
    return (
      <ReadingReportView
        items={results.items}
        earnedPoints={results.earnedPoints}
        totalPoints={results.totalPoints}
        elapsedMs={Date.now() - startedAtRef.current}
        onDone={onFinish}
      />
    );
  }

  return (
    <div className="reading-runner reading-runner-page">
      <QuestionListSidebar flat={flat} answers={answers} />

      <div className="reading-runner-main">
        {parts.map((part, partIndex) => (
          <div className="reading-part" key={partIndex}>
            <div className="reading-part-head">
              <h2>{part.title}</h2>
              {part.instruction && <p className="reading-part-instruction">{part.instruction}</p>}
            </div>
            <div className="reading-question-list">
              {(part.questions ?? []).map((q, qIndex) => {
                const { qNumber } = flat.find(f => f.partIndex === partIndex && f.qIndex === qIndex);
                const value = answers[partIndex]?.[qIndex];
                if (q.type === "yesno") {
                  return (
                    <YesNoQuestion
                      key={qIndex}
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                }
                if (q.type === "gapfill") {
                  return (
                    <GapfillQuestion
                      key={qIndex}
                      question={q}
                      qNumber={qNumber}
                      values={value ?? []}
                      onChange={(gapIndex, val) =>
                        setAnswer(partIndex, qIndex, (() => {
                          const cur = [...(value ?? [])];
                          cur[gapIndex] = val;
                          return cur;
                        })())
                      }
                    />
                  );
                }
                if (q.type === "word-scramble") {
                  return (
                    <WordScrambleQuestion
                      key={qIndex}
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                }
                return (
                  <ShortAnswerQuestion
                    key={qIndex}
                    question={q}
                    qNumber={qNumber}
                    value={value}
                    onChange={val => setAnswer(partIndex, qIndex, val)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="reading-part-footer reading-runner-footer">
          <button type="button" className="btn btn-primary" onClick={() => setConfirmingSubmit(true)}>
            Nộp bài
          </button>
        </div>
      </div>

      {confirmingSubmit && (
        <SubmitConfirmDialog
          unansweredCount={unansweredCount}
          onCancel={() => setConfirmingSubmit(false)}
          onConfirm={submit}
        />
      )}
    </div>
  );
}

// Modal xác nhận nộp bài — tự thiết kế theo đúng theme cam san hô/xanh ngọc của site (KHÔNG dùng
// window.confirm() mặc định, cũng không dùng lại ConfirmDialog.jsx của khu vực admin vì nó gắn với
// theme --admin-accent màu xanh dương riêng của Dashboard, không hợp màu với trang học sinh).
function SubmitConfirmDialog({ unansweredCount, onCancel, onConfirm }) {
  const hasUnanswered = unansweredCount > 0;
  return (
    <div className="reading-submit-overlay" role="presentation" onClick={onCancel}>
      <div className="reading-submit-dialog" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        {hasUnanswered ? (
          <>
            <p className="reading-submit-dialog-icon" aria-hidden="true">⚠️</p>
            <p className="reading-submit-dialog-title">Còn {unansweredCount} câu chưa làm!</p>
            <p className="reading-submit-dialog-note">Bạn có chắc chắn muốn nộp bài luôn không?</p>
          </>
        ) : (
          <>
            <p className="reading-submit-dialog-icon" aria-hidden="true">✅</p>
            <p className="reading-submit-dialog-title">Bạn đã làm xong tất cả các câu.</p>
            <p className="reading-submit-dialog-note">Xác nhận nộp bài chứ?</p>
          </>
        )}
        <div className="reading-submit-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Làm tiếp
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Nộp bài
          </button>
        </div>
      </div>
    </div>
  );
}
