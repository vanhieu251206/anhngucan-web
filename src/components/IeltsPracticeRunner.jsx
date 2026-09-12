import { useEffect, useMemo, useRef, useState } from "react";
import { deriveTableDiagramBlanks, normalizeBlankHolder, textBlankCount } from "../lib/tableDiagramBlanks.js";

// Màn làm bài "LUYỆN ĐỀ" IELTS Reading — mô phỏng giao diện đề thi thật: đồng hồ đếm giờ, khung
// đoạn văn cuộn riêng bên trái, khung câu hỏi cuộn riêng bên phải, ô điều hướng số câu hỏi, bật/tắt
// highlight, nộp bài rồi xem điểm + đáp án đúng. KHÁC ReadingRunner (Reading & Writing YLE, không
// timer/không highlight) — đây là màn CÓ chấm điểm nhưng KHÔNG dùng attempts.js (mục Luyện đề cho
// làm lại thoải mái để luyện tập, không giới hạn lượt như Speaking/Reading YLE — chốt 2026-09-10).

function normalizeAnswer(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}

// Đánh số câu hỏi liên tục xuyên suốt cả Test (giống đề thi thật, không reset về 1 ở mỗi passage).
// Dạng "table-diagram" không có `group.questions` tường minh — danh sách chỗ trống được TÍNH TỰ
// ĐỘNG từ số dấu "___" tìm thấy trong bảng/đoạn văn/sơ đồ, xem lib/tableDiagramBlanks.js.
function flattenQuestions(passages) {
  const flat = [];
  let n = 1;
  (passages ?? []).forEach((passage, pi) => {
    (passage.groups ?? []).forEach((group, gi) => {
      const qs = group.type === "table-diagram" ? deriveTableDiagramBlanks(group)
        : group.type === "diagram" ? (group.diagramPoints ?? []).map(p => ({ acceptedAnswers: p.answer ?? "" }))
        : (group.questions ?? []);
      qs.forEach((q, qi) => {
        flat.push({ number: n, passageIndex: pi, groupIndex: gi, questionIndex: qi, type: group.type, q });
        n++;
      });
    });
  });
  return flat;
}

export function isCorrect(entry, value) {
  const { type, q } = entry;
  if (value == null || value === "") return false;
  if (type === "multiple-choice") return Number(value) === q.answerIndex;
  if (type === "tfng") return value === q.answer;
  const accepted = String(q.acceptedAnswers ?? "").split("|").map(normalizeAnswer).filter(Boolean);
  return accepted.includes(normalizeAnswer(value));
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Gộp các câu liền mạch thành từng đoạn văn (đoạn mới bắt đầu khi câu có cờ `newParagraph`),
// đúng cách sách in xuống dòng chia đoạn, thay vì dồn cả bài thành 1 khối văn bản liền.
function groupIntoParagraphs(sentences) {
  const paragraphs = [];
  (sentences ?? []).forEach(s => {
    if (s.newParagraph || paragraphs.length === 0) paragraphs.push([]);
    paragraphs[paragraphs.length - 1].push(s.en);
  });
  return paragraphs.map(p => p.join(" "));
}

// Hỗ trợ in đậm trong đoạn văn: soạn trong CMS bằng cú pháp **chữ cần in đậm** (giống markdown),
// tách thành mảng text/<strong> để render — dùng cho tiêu đề phụ kiểu "Bad behaviour" trong bài gốc.
function renderWithBold(text) {
  const parts = String(text ?? "").split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

function HighlightablePassage({ sentences, highlightOn }) {
  const ref = useRef(null);
  const paragraphs = useMemo(() => groupIntoParagraphs(sentences), [sentences]);

  function handleMouseUp() {
    if (!highlightOn) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !ref.current) return;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;
    try {
      const mark = document.createElement("mark");
      mark.className = "ielts-practice-highlight";
      range.surroundContents(mark);
      sel.removeAllRanges();
    } catch {
      // Vùng chọn chạy qua nhiều thẻ (không đơn giản) — bỏ qua, không chặn thao tác đọc.
    }
  }

  return (
    <div ref={ref} onMouseUp={handleMouseUp}>
      {paragraphs.map((text, i) => (
        <p key={i}>{renderWithBold(text)}</p>
      ))}
    </div>
  );
}

// Chế độ "Từ vựng & dịch" — mỗi câu bấm để hiện bản dịch + danh sách từ vựng/từ đồng nghĩa xuất
// hiện trong câu đó (gộp từ IeltsReadingPassage.jsx cũ, chốt 2026-09-11 gộp "ĐỌC HIỂU" vào đây).
function SentenceVocabRow({ sentence }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ielts-sentence-row">
      <div className="ielts-sentence-main">
        <button type="button" className="ielts-sentence-en" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          {renderWithBold(sentence.en)}
        </button>
        {open && sentence.vi && <p className="ielts-sentence-vi">→ {sentence.vi}</p>}
      </div>
      {(sentence.vocab ?? []).length > 0 && (
        <div className="ielts-sentence-vocab">
          {sentence.vocab.map((v, i) => (
            <p key={i} className="ielts-vocab-item">
              <span className="ielts-vocab-term">{v.termDef}</span>
              <span className="ielts-vocab-arrow">→</span>
              <span className="ielts-vocab-meaning">{v.meaning}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Ô input 1 chỗ trống — dùng cho điểm đè lên sơ đồ (vị trí cố định theo % toạ độ nên input phải nằm
// ngay tại đó) VÀ cho danh sách "Trả lời" tách riêng bên dưới bảng/đoạn văn (xem `AnswerList`).
function InlineBlankInput({ entry, value, submitted, onChange, numberRef }) {
  const correct = submitted ? isCorrect(entry, value) : null;
  return (
    <span className="ielts-practice-inline-blank" ref={numberRef}>
      <span className="ielts-practice-qnum-inline">{entry.number}</span>
      <input
        className={`ielts-practice-inline-input${submitted ? (correct ? " is-correct" : " is-wrong") : ""}`}
        value={value ?? ""}
        disabled={submitted}
        onChange={e => onChange(entry.number, e.target.value)}
      />
    </span>
  );
}

// Tách 1 ô bảng/đoạn văn theo dấu "___" (giáo viên gõ trực tiếp, xem lib/tableDiagramBlanks.js)
// thành chữ thường + Ô NHẬP THẬT ngay tại đúng vị trí (giữ nguyên chữ xung quanh giống bố cục thật
// trong sách, vd "Glass remained ___" → "Glass remained [số][ô nhập]") — điền trực tiếp trên bảng
// thay vì tách riêng thành danh sách bên dưới (chốt 2026-09-12, theo yêu cầu người dùng: điền ngay
// tại chỗ dễ dùng hơn). `counter` là biến đếm DÙNG CHUNG xuyên suốt cả group (truyền qua tham chiếu
// object `{ current }`) để thứ tự chỗ trống tính đúng liên tục qua nhiều ô/đoạn văn, khớp với
// `deriveTableDiagramBlanks`.
function renderTextWithBlanks(text, counter, gi, activePassage, flat, answers, submitted, setAnswer, questionRefs) {
  const parts = String(text ?? "").split(/(_{3,})/g);
  return parts.map((part, idx) => {
    if (!/^_{3,}$/.test(part)) return part ? <span key={idx}>{part}</span> : null;
    const questionIndex = counter.current++;
    const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === questionIndex);
    if (!entry) return <span key={idx} className="ielts-practice-inline-blank-missing">{part}</span>;
    return (
      <InlineBlankInput
        key={idx}
        entry={entry}
        value={answers[entry.number]}
        submitted={submitted}
        onChange={setAnswer}
        numberRef={el => (questionRefs.current[entry.number] = el)}
      />
    );
  });
}

// Nhóm dạng "table-diagram" (bảng + sơ đồ điền từ, dựng lại y hệt sách — chốt 2026-09-11) — thay
// cho vòng lặp g.questions.map hiển thị mỗi câu 1 khối riêng của các dạng khác, vì ở đây các chỗ
// trống nằm LỒNG trong ô bảng/trên ảnh sơ đồ theo đúng vị trí giáo viên đã soạn.
// Hộp "danh sách đáp án dùng chung" — List of Headings (roman số + có viền) hoặc word bank/danh
// sách phân loại (chữ cái, có thể không viền, xem `boxed`). Dùng ở cả TableDiagramGroup (word bank
// chỉ để tham khảo, mặc định 3 mục/hàng giống sách gốc) và MatchingGroup (đáp án học sinh thực sự
// chọn, danh sách dài nên vẫn giữ 1 mục/hàng, xem `columns`).
export function OptionsBox({ title, options, boxed = true, columns = 1 }) {
  if (!options || options.length === 0) return null;
  return (
    <div className={`ielts-options-box${boxed ? " is-boxed" : ""}`}>
      {title && <p className="ielts-options-box-title">{title}</p>}
      <div className="ielts-options-box-grid" style={columns > 1 ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}>
        {options.map((o, i) => (
          <p key={i} className="ielts-options-box-row"><strong>{o.key}</strong>&nbsp;&nbsp;{o.text}</p>
        ))}
      </div>
    </div>
  );
}

// Nhóm dạng "diagram" (Điền trên ảnh — chốt 2026-09-12, ĐƠN GIẢN HOÁ lần 2: bỏ hẳn cơ chế đặt điểm
// theo toạ độ %/% đè lên ảnh — ảnh giáo viên upload đã tự in sẵn số thứ tự (6, 7, 8...), chỉ cần
// hiện ảnh THẬT (không overlay gì) rồi tới danh sách ô đáp án đánh số bên dưới, giáo viên tự canh
// đúng số lượng khớp với ảnh khi soạn). `g.diagramPoints[pi].answer` là đáp án đúng, thứ tự trong
// mảng = đúng thứ tự hiển thị Question N.
export function DiagramGroup({ g, gi, activePassage, flat, answers, submitted, setAnswer, questionRefs }) {
  const points = g.diagramPoints ?? [];
  return (
    <>
      {g.diagramTitle && <p className="ielts-practice-table-title">{g.diagramTitle}</p>}
      {g.diagramImage && (
        <div className="ielts-practice-diagram">
          <img src={g.diagramImage} alt="" />
        </div>
      )}
      {points.length > 0 && (
        <div className="ielts-practice-answer-list">
          {points.map((p, pi) => {
            const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === pi);
            if (!entry) return null;
            return (
              <InlineBlankInput
                key={pi}
                entry={entry}
                value={answers[entry.number]}
                submitted={submitted}
                onChange={setAnswer}
                numberRef={el => (questionRefs.current[entry.number] = el)}
              />
            );
          })}
        </div>
      )}
      {submitted && points.some((_, pi) => {
        const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === pi);
        return entry && !isCorrect(entry, answers[entry.number]);
      }) && (
        <div className="ielts-practice-table-answers">
          {points.map((p, pi) => {
            const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === pi);
            if (!entry || isCorrect(entry, answers[entry.number])) return null;
            return (
              <p key={pi} className="ielts-practice-correct-answer">
                Câu {entry.number}: {String(p.answer ?? "").split("|")[0]}
              </p>
            );
          })}
        </div>
      )}
    </>
  );
}

export function TableDiagramGroup({ g, gi, activePassage, flat, answers, submitted, setAnswer, questionRefs }) {
  // counter dùng chung cho cả bảng lẫn đoạn văn — PHẢI quét bảng trước rồi mới tới đoạn văn (khớp
  // đúng thứ tự deriveTableDiagramBlanks quy định), không được đảo ngược.
  const counter = { current: 0 };
  const blanks = deriveTableDiagramBlanks(g);
  return (
    <>
      {g.tableTitle && <p className="ielts-practice-table-title">{g.tableTitle}</p>}
      {g.table && (
        <table className="ielts-practice-table">
          <thead>
            <tr>{g.table.columns.map((c, ci) => <th key={ci}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {g.table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.cells.map((cell, ci) => (
                  <td key={ci}>{renderTextWithBlanks(normalizeBlankHolder(cell).text, counter, gi, activePassage, flat, answers, submitted, setAnswer, questionRefs)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Word bank hiện DƯỚI đoạn văn (chốt 2026-09-12, khớp bố cục sách gốc: đoạn tóm tắt trước,
          hộp từ cho sẵn ngay dưới) — đảo thứ tự so với trước (từng để trên cùng). */}
      {(g.paragraphs ?? []).map((p, pi) => (
        <p key={pi} className="ielts-practice-summary-paragraph">
          {renderTextWithBlanks(normalizeBlankHolder(p).text, counter, gi, activePassage, flat, answers, submitted, setAnswer, questionRefs)}
        </p>
      ))}
      <OptionsBox title={g.optionsTitle} options={g.optionsList} columns={3} />
      {g.diagramImage && g.diagramTitle && <p className="ielts-practice-table-title">{g.diagramTitle}</p>}
      {g.diagramImage && (
        <div className="ielts-practice-diagram">
          <img src={g.diagramImage} alt="" />
          {(g.diagramPoints ?? []).map((p, pi) => {
            const questionIndex = textBlankCount(g) + pi;
            const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === questionIndex);
            if (!entry) return null;
            return (
              <span key={pi} className="ielts-practice-diagram-point" style={{ left: `${p.xPercent}%`, top: `${p.yPercent}%` }}>
                <InlineBlankInput
                  entry={entry}
                  value={answers[entry.number]}
                  submitted={submitted}
                  onChange={setAnswer}
                  numberRef={el => (questionRefs.current[entry.number] = el)}
                />
              </span>
            );
          })}
        </div>
      )}
      {submitted && blanks.some((_, qi) => {
        const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === qi);
        return entry && !isCorrect(entry, answers[entry.number]);
      }) && (
        <div className="ielts-practice-table-answers">
          {blanks.map((q, qi) => {
            const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === qi);
            if (!entry || isCorrect(entry, answers[entry.number])) return null;
            return (
              <p key={qi} className="ielts-practice-correct-answer">
                Câu {entry.number}: {String(q.acceptedAnswers ?? "").split("|")[0]}
              </p>
            );
          })}
        </div>
      )}
    </>
  );
}

// Nhóm dạng "matching" (Matching Headings / Classify — chọn theo danh sách chung, xem
// PracticeStudio.jsx `MatchingEditor`) — hiện hộp đáp án dùng chung 1 lần, rồi từng mục: "Ví dụ"
// (`isExample`, chỉ hiện đáp án mẫu, không chấm điểm) hoặc câu hỏi thật (dropdown chọn 1 đáp án
// trong danh sách, chấm điểm như các dạng khác). `qi` chỉ tăng ở mục KHÔNG phải ví dụ vì
// `group.questions` (nguồn đánh số toàn Test) được sinh từ đúng các mục đó theo thứ tự.
export function MatchingGroup({ g, gi, activePassage, flat, answers, submitted, setAnswer, questionRefs }) {
  let qi = -1;
  return (
    <>
      <OptionsBox title={g.optionsTitle} options={g.optionsList} boxed={g.boxed !== false} />
      {(g.items ?? []).map((it, ii) => {
        if (it.isExample) {
          return (
            <p key={ii} className="ielts-matching-example">
              <strong>{it.label}</strong> <em>(Example)</em> — {it.answerKey}
            </p>
          );
        }
        qi++;
        const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === qi);
        if (!entry) return null;
        const number = entry.number;
        const value = answers[number];
        const correct = submitted ? isCorrect(entry, value) : null;
        return (
          <div
            className={`ielts-practice-question${submitted ? (correct ? " is-correct" : " is-wrong") : ""}`}
            key={ii}
            ref={el => (questionRefs.current[number] = el)}
          >
            <span className="ielts-practice-qnum">{number}</span>
            <div className="ielts-practice-qbody">
              <p>{it.label}</p>
              <select className="admin-input" value={value ?? ""} disabled={submitted} onChange={e => setAnswer(number, e.target.value)}>
                <option value="" disabled>— Chọn —</option>
                {(g.optionsList ?? []).map((o, oi) => <option key={oi} value={o.key}>{o.key}. {o.text}</option>)}
              </select>
              {submitted && !correct && (
                <p className="ielts-practice-correct-answer">Đáp án đúng: {String(it.answerKey ?? "").split("|")[0]}</p>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// Nhóm 3 dạng "chuẩn" (multiple-choice / tfng / short-answer) — mỗi câu 1 khối riêng, có q.text/
// q.options/q.answer/q.label/q.acceptedAnswers tuỳ dạng. Tách thành component riêng (thay vì viết
// thẳng trong vòng lặp .map ở IeltsPracticeRunner) để dùng lại được cho GroupPreviewModal.jsx (nút
// "Preview" trong CMS, xem PracticeStudio.jsx — chốt 2026-09-12).
export function StandardQuestionGroup({ g, gi, activePassage, flat, answers, submitted, setAnswer, questionRefs }) {
  return g.questions.map((q, qi) => {
    const entry = flat.find(e => e.passageIndex === activePassage && e.groupIndex === gi && e.questionIndex === qi);
    const number = entry.number;
    const value = answers[number];
    const correct = submitted ? isCorrect(entry, value) : null;
    return (
      <div
        className={`ielts-practice-question${submitted ? (correct ? " is-correct" : " is-wrong") : ""}`}
        key={qi}
        ref={el => questionRefs && (questionRefs.current[number] = el)}
      >
        <span className="ielts-practice-qnum">{number}</span>
        <div className="ielts-practice-qbody">
          {g.type === "multiple-choice" && (
            <>
              <p>{q.text}</p>
              {q.options.map((opt, oi) => (
                <label className="ielts-practice-option" key={oi}>
                  <input
                    type="radio"
                    name={`q-${number}`}
                    checked={value === oi}
                    disabled={submitted}
                    onChange={() => setAnswer(number, oi)}
                  />
                  {String.fromCharCode(65 + oi)}. {opt}
                </label>
              ))}
              {submitted && !correct && (
                <p className="ielts-practice-correct-answer">Đáp án đúng: {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}</p>
              )}
            </>
          )}
          {g.type === "tfng" && (
            <>
              <p>{q.text}</p>
              <select className="admin-input" value={value ?? ""} disabled={submitted} onChange={e => setAnswer(number, e.target.value)}>
                <option value="" disabled>— Chọn —</option>
                {g.tfngScheme === "YNNG" ? (
                  <>
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                  </>
                ) : (
                  <>
                    <option value="TRUE">TRUE</option>
                    <option value="FALSE">FALSE</option>
                  </>
                )}
                <option value="NOT GIVEN">NOT GIVEN</option>
              </select>
              {submitted && !correct && <p className="ielts-practice-correct-answer">Đáp án đúng: {q.answer}</p>}
            </>
          )}
          {g.type === "short-answer" && (
            <>
              {/_{3,}/.test(String(q.label ?? "")) ? (
                <p>
                  {String(q.label ?? "").split(/(_{3,})/g).map((part, pi) =>
                    /^_{3,}$/.test(part) ? (
                      <input
                        key={pi}
                        className={`ielts-practice-inline-input${submitted ? (correct ? " is-correct" : " is-wrong") : ""}`}
                        value={value ?? ""}
                        disabled={submitted}
                        onChange={e => setAnswer(number, e.target.value)}
                      />
                    ) : (
                      part
                    )
                  )}
                </p>
              ) : (
                <>
                  {q.label && <p>{q.label}</p>}
                  <input
                    className="admin-input"
                    value={value ?? ""}
                    disabled={submitted}
                    onChange={e => setAnswer(number, e.target.value)}
                  />
                </>
              )}
              {submitted && !correct && (
                <p className="ielts-practice-correct-answer">
                  Đáp án đúng: {String(q.acceptedAnswers ?? "").split("|")[0]}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  });
}

// mode: "practice" (mặc định, card "LUYỆN ĐỀ" — có giờ + cột câu hỏi chấm điểm) hoặc
// "comprehension" (card "ĐỌC HIỂU" — chỉ đọc từng câu + dịch + từ vựng, không giờ/không câu hỏi).
// readOnly: dùng cho nút "👁 Preview" trong CMS (LuyenDePage) — mở ĐÚNG trang này (full-screen,
// không phải modal riêng) nhưng khoá mọi input/select (không làm bài thật được) và tự coi như đã
// "Nộp bài" ngay từ đầu để hiện sẵn đáp án đúng cho giáo viên rà lại — không có đồng hồ đếm giờ/nút
// Nộp bài/khung điểm (không có ý nghĩa khi chưa ai làm bài thật), chỉ còn nút "⬅ Quay lại" ở topbar
// để đóng và về CMS (chốt 2026-09-12).
export default function IeltsPracticeRunner({ test, onBack, mode = "practice", readOnly = false }) {
  const isComprehension = mode === "comprehension";
  const flat = useMemo(() => flattenQuestions(test.passages), [test]);
  const [activePassage, setActivePassage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [highlightOn, setHighlightOn] = useState(false);
  // Chế độ đọc: "plain" = đọc liền mạch như đề thi thật (bấm chọn để highlight); "vocab" = chia
  // theo từng câu, bấm để xem dịch + từ vựng/từ đồng nghĩa (gộp "ĐỌC HIỂU" cũ vào đây, 2026-09-11).
  const [readMode, setReadMode] = useState(isComprehension ? "vocab" : "plain");
  const [submitted, setSubmitted] = useState(readOnly);
  const [secondsLeft, setSecondsLeft] = useState(
    !isComprehension && !readOnly && test.timeLimitMinutes ? test.timeLimitMinutes * 60 : null
  );
  const questionRefs = useRef({});

  useEffect(() => {
    if (readOnly || secondsLeft == null || submitted) return;
    if (secondsLeft <= 0) {
      setSubmitted(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted, readOnly]);

  function setAnswer(number, value) {
    setAnswers(a => ({ ...a, [number]: value }));
  }

  function jumpTo(number) {
    const entry = flat.find(e => e.number === number);
    if (!entry) return;
    setActivePassage(entry.passageIndex);
    setTimeout(() => {
      questionRefs.current[number]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  const score = useMemo(() => {
    if (!submitted) return null;
    let correct = 0;
    flat.forEach(entry => {
      if (isCorrect(entry, answers[entry.number])) correct++;
    });
    return { correct, total: flat.length };
  }, [submitted, flat, answers]);

  const passage = test.passages[activePassage];
  const passageQuestions = flat.filter(e => e.passageIndex === activePassage);

  return (
    <div className="ielts-practice-screen">
      <div className="ielts-practice-topbar">
        <button className="speaking-fullscreen-back" onClick={onBack}>⬅ Quay lại</button>
        <h1 className="ielts-practice-title">{test.title}</h1>
        {isComprehension && (
          <>
            <div className="ielts-practice-readmode-toggle" role="group" aria-label="Chế độ đọc">
              <button type="button" className={`ielts-practice-readmode-btn${readMode === "plain" ? " is-active" : ""}`} onClick={() => setReadMode("plain")}>Đọc thường</button>
              <button type="button" className={`ielts-practice-readmode-btn${readMode === "vocab" ? " is-active" : ""}`} onClick={() => setReadMode("vocab")}>Từ vựng &amp; dịch</button>
            </div>
            {readMode === "plain" && (
              <label className="ielts-practice-highlight-toggle">
                <input type="checkbox" checked={highlightOn} onChange={e => setHighlightOn(e.target.checked)} />
                Highlight nội dung
              </label>
            )}
          </>
        )}
      </div>

      <div className={`ielts-practice-body${isComprehension || readOnly ? " ielts-practice-body-solo" : ""}`}>
        <div className="ielts-practice-passage-tabs">
          {test.passages.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`ielts-practice-tab${activePassage === i ? " is-active" : ""}`}
              onClick={() => setActivePassage(i)}
            >
              Passage {i + 1}
            </button>
          ))}
        </div>

        <div className={`ielts-practice-columns${isComprehension ? " ielts-practice-columns-solo" : ""}`}>
          <div className="ielts-practice-passage-col">
            <p className="ielts-practice-passage-label">READING PASSAGE {activePassage + 1}</p>
            {!isComprehension && passageQuestions.length > 0 && (
              <p className="ielts-practice-passage-instruction">
                You should spend about {test.timeLimitMinutes ? Math.round(test.timeLimitMinutes / test.passages.length) : 20} minutes on{" "}
                <strong>
                  Questions {passageQuestions[0].number}
                  {passageQuestions.length > 1 ? `–${passageQuestions[passageQuestions.length - 1].number}` : ""}
                </strong>
                , which are based on Reading Passage {activePassage + 1} below.
              </p>
            )}
            <h2>{passage.title}</h2>
            {passage.titleVi && <p className="ielts-practice-title-vi">{passage.titleVi}</p>}
            {readMode === "plain" ? (
              <HighlightablePassage
                sentences={passage.sentences}
                highlightOn={highlightOn}
              />
            ) : (
              (passage.sentences ?? []).map((s, i) => <SentenceVocabRow key={i} sentence={s} />)
            )}
          </div>

          {!isComprehension && (
          <div className="ielts-practice-questions-col">
            {(passage.groups ?? []).map((g, gi) => (
              <div className="ielts-practice-group" key={gi}>
                {g.instruction && <p className="ielts-practice-instruction">{g.instruction}</p>}
                {g.type === "table-diagram" ? (
                  <TableDiagramGroup
                    g={g}
                    gi={gi}
                    activePassage={activePassage}
                    flat={flat}
                    answers={answers}
                    submitted={submitted}
                    setAnswer={setAnswer}
                    questionRefs={questionRefs}
                  />
                ) : g.type === "diagram" ? (
                  <DiagramGroup
                    g={g}
                    gi={gi}
                    activePassage={activePassage}
                    flat={flat}
                    answers={answers}
                    submitted={submitted}
                    setAnswer={setAnswer}
                    questionRefs={questionRefs}
                  />
                ) : g.type === "matching" ? (
                  <MatchingGroup
                    g={g}
                    gi={gi}
                    activePassage={activePassage}
                    flat={flat}
                    answers={answers}
                    submitted={submitted}
                    setAnswer={setAnswer}
                    questionRefs={questionRefs}
                  />
                ) : (
                  <StandardQuestionGroup
                    g={g}
                    gi={gi}
                    activePassage={activePassage}
                    flat={flat}
                    answers={answers}
                    submitted={submitted}
                    setAnswer={setAnswer}
                    questionRefs={questionRefs}
                  />
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {!isComprehension && !readOnly && (
      <div className="ielts-practice-sidebar">
        {secondsLeft != null && (
          <div className="ielts-practice-timer">
            <span>Thời gian làm bài:</span>
            <strong>{formatTime(Math.max(secondsLeft, 0))}</strong>
          </div>
        )}
        {!submitted ? (
          <button type="button" className="btn btn-primary ielts-practice-submit" onClick={() => setSubmitted(true)}>
            NỘP BÀI
          </button>
        ) : (
          <div className="ielts-practice-score">
            Điểm: {score.correct}/{score.total}
          </div>
        )}
        <div className="ielts-practice-navgrid">
          {flat.map(entry => (
            <button
              key={entry.number}
              type="button"
              className={`ielts-practice-navbtn${answers[entry.number] != null && answers[entry.number] !== "" ? " is-answered" : ""}${submitted ? (isCorrect(entry, answers[entry.number]) ? " is-correct" : " is-wrong") : ""}`}
              onClick={() => jumpTo(entry.number)}
            >
              {entry.number}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
