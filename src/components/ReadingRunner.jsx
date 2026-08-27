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

// Điểm THẬT SỰ dùng để chấm 1 câu — nếu Part có `partPoints` (tổng điểm cố định cho cả Part, chia
// đều cho các câu bên trong), điểm riêng từng câu (question.points) bị BỎ QUA hoàn toàn, dùng
// part.partPoints / số câu trong Part thay thế (yêu cầu người dùng 2026-08-26, vd Movers Part 1
// chấm theo tổng điểm cả Part chứ không theo từng câu riêng). Không có partPoints thì giữ nguyên
// cách cũ (questionPoints(question)). Câu "free-writing" (viết tự do, không có đáp án đúng/sai —
// Movers Part 6 câu 5-6) LUÔN 0 điểm và KHÔNG tính vào mẫu số chia đều của partPoints (yêu cầu
// người dùng 2026-08-27).
export function effectiveQuestionPoints(part, question) {
  if (question.type === "free-writing") return 0;
  const gradedCount = (part.questions ?? []).filter(q => q.type !== "free-writing").length;
  if (part.partPoints != null && gradedCount > 0) return part.partPoints / gradedCount;
  return questionPoints(question);
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
      flat.push({ question: q, part, partIndex, qIndex, qNumber: n });
      n += 1;
    });
  });
  return flat;
}

function isAnswered(question, value) {
  if (question.type === "gapfill") return (value ?? []).some(v => (v ?? "").trim());
  if (question.type === "multiple-choice") return value !== undefined && value !== null;
  return !!(value ?? "").toString().trim();
}

// Số thứ tự tròn — hiện đầu mỗi câu. Export để ReadingStudio.jsx (xem trước trong CMS) dùng lại,
// cho preview giống hệt màn học sinh.
export function QuestionBadge({ qNumber }) {
  return (
    <div className="reading-question-badge">
      <span className="reading-question-num">Question {qNumber}</span>
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
            // Tách riêng nhãn số thứ tự "(N)" (do GapfillTextEditor tự chèn liền sát ô trống, vd
            // "...very (2)___") ra khỏi phần chữ còn lại, rồi bọc CHUNG với ô input trong 1 span
            // white-space:nowrap — tránh việc trình duyệt xuống dòng giữa "(2)" và ô trống thành 2
            // dòng tách rời trông rất rối (lỗi thực tế 2026-08-26, đoạn văn dài nhiều dòng).
            const numMatch = seg.match(/(\(\d+\))\s*$/);
            const prefix = numMatch ? seg.slice(0, numMatch.index) : seg;
            const marker = numMatch ? numMatch[1] : "";
            const choices = question.gapMode === "choices" ? question.gapOptions?.[gapIndex]?.options : null;
            return (
              <span key={i}>
                {prefix}
                {choices ? (
                  // Chế độ bấm chọn (khác gõ tự do) — 3 nút cho từng chỗ trống, bấm vào thì
                  // highlight (khớp đáp án đúng hay không tính lúc chấm điểm, không tô màu ngay khi
                  // chọn — tránh lộ đáp án trước khi nộp bài).
                  <span className="reading-gap-choices">
                    {marker}
                    {choices.map((opt, ci) => (
                      <button
                        key={ci}
                        type="button"
                        className={`reading-gap-choice-btn${answered === opt ? " is-selected" : ""}`}
                        onClick={() => onChange(gapIndex, opt)}
                        disabled={!opt}
                      >
                        {opt || `(chưa nhập lựa chọn ${ci + 1})`}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="reading-gap-nowrap">
                    {marker}
                    <input
                      className="reading-gap-input"
                      value={answered}
                      onChange={e => onChange(gapIndex, e.target.value)}
                      size={Math.max(4, (correct?.length ?? 6) + 2)}
                    />
                  </span>
                )}
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

// Chọn 1 trong nhiều đáp án (radio) — dùng cho Part hội thoại (chọn câu trả lời đúng) và Part chọn
// tiêu đề câu chuyện của Movers. `value` lưu index đáp án học sinh chọn (number), khớp với
// `question.answerIndex` (index đáp án đúng) khi chấm điểm.
// Nhãn chữ cái A/B/C... cho từng đáp án multiple-choice — khớp đúng cách đề Cambridge YLE thật
// luôn đánh A/B/C cạnh đáp án (yêu cầu người dùng 2026-08-26), tính theo index nên tự đúng dù có
// nhiều hơn/ít hơn 3 đáp án.
export function optionLetter(i) {
  return String.fromCharCode(65 + i) + ".";
}

function MultipleChoiceQuestion({ question, qNumber, value, onChange }) {
  const options = question.options ?? [];
  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        {question.text && <p className="reading-question-text">{question.text}</p>}
        <div className="reading-mc-options">
          {options.map((opt, i) => (
            <label key={i} className={`reading-mc-option${value === i ? " is-selected" : ""}`}>
              <input
                type="radio"
                name={`mc-${qNumber}`}
                checked={value === i}
                onChange={() => onChange(i)}
              />
              {!question.hideLetters && <span className="reading-mc-option-letter">{optionLetter(i)}</span>}
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mục ngân hàng từ có thể là string trơn (Movers/Flyers Part 1/2 — chỉ chữ) HOẶC object {text, image}
// (Movers Part 3 — mỗi từ kèm ảnh minh hoạ, xem sách gốc trang "Example" có 9 ô ảnh+chữ). 2 hàm này
// đọc thống nhất bất kể dữ liệu cũ (string) hay mới (object), dùng chung ở CMS lẫn màn học sinh.
export function bankLabel(item) {
  return typeof item === "string" ? item : (item?.text ?? "");
}
export function bankImage(item) {
  return typeof item === "string" ? null : (item?.image ?? null);
}

// Khung hiện TOÀN BỘ ngân hàng từ ở đầu Part — giống hệt trang sách thật (các từ bày sẵn để học
// sinh đọc qua trước khi làm câu), CHỈ ĐỌC, không tương tác (chọn đáp án vẫn qua dropdown ở từng
// câu bên dưới, xem WordBankQuestion) — yêu cầu người dùng 2026-08-26.
export function WordBankBox({ words }) {
  if (!words?.length) return null;
  return (
    <div className="reading-wordbank-box">
      {words.map((w, i) => {
        const img = bankImage(w);
        return (
          <span key={i} className={`reading-wordbank-chip${img ? " has-img" : ""}`}>
            {img && <img src={img} alt="" className="reading-wordbank-chip-img" />}
            {bankLabel(w)}
          </span>
        );
      })}
    </div>
  );
}

// Dòng "Example" mẫu trước các câu hỏi thật — chỉ minh hoạ cách làm, KHÔNG tính điểm, KHÔNG tương
// tác được (khớp sách gốc luôn có sẵn 1 ví dụ đã điền đáp án). Dùng cho type word-bank.
// mode="multiple-choice" (Movers Part 2...) hiện luôn 3 đáp án, đáp án đúng khoanh sẵn — khớp cách
// sách gốc luôn đánh dấu sẵn đáp án đúng ở dòng Example (vd khoanh tròn "B  Is it?").
// Câu định nghĩa ↔ chỗ trống điền từ (Movers Part 1) — GIỮ NGUYÊN khung thẻ ".reading-question"
// giống mọi Part khác (viền, bo góc, đổ bóng hover, số thứ tự tròn) để đồng bộ giao diện cả bài,
// chỉ khác ở chỗ bên TRONG thẻ chia 2 cột cố định (chữ trái, ô điền từ phải) để chỗ trống các câu
// THẲNG CỘT với nhau — khớp đúng layout sách gốc mà vẫn đồng bộ style với Part 2/3/5/6.
export function AnswerTableRow({ label, text, value, onChange, readOnly, id }) {
  const isExample = label === "Example";
  return (
    <div className="reading-question" id={id}>
      {isExample ? (
        <div className="reading-question-badge reading-example-badge">Example</div>
      ) : (
        <QuestionBadge qNumber={label} />
      )}
      <div className="reading-question-body">
        <div className="reading-answer-row">
          <p className="reading-question-text reading-answer-row-text">{text}</p>
          <div className="reading-answer-row-answer">
            {readOnly ? (
              <span className="reading-answer-row-value">{value}</span>
            ) : (
              <input
                className="reading-answer-input"
                value={value ?? ""}
                onChange={e => onChange(e.target.value)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExampleRow({ example, mode }) {
  if (!example?.text) return null;
  if (mode === "table-row") {
    return <AnswerTableRow label="Example" text={example.text} value={example.answer} readOnly />;
  }
  if (mode === "multiple-choice") {
    return (
      <div className="reading-question reading-example-row">
        <div className="reading-question-badge reading-example-badge">Example</div>
        <div className="reading-question-body">
          <p className="reading-question-text">{example.text}</p>
          <div className="reading-mc-options">
            {(example.options ?? []).map((opt, i) => (
              <span key={i} className={`reading-mc-option${example.answerIndex === i ? " is-selected" : ""}`}>
                <span className="reading-mc-option-letter">{optionLetter(i)}</span>
                {opt}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="reading-question reading-example-row">
      <div className="reading-question-badge reading-example-badge">Example</div>
      <div className="reading-question-body">
        <p className="reading-question-text">
          {example.text} <span className="reading-example-answer">{example.answer}</span>
        </p>
      </div>
    </div>
  );
}

// 2 ví dụ mẫu CỐ ĐỊNH của Movers Part 6 (Cambridge YLE) — luôn ĐÚNG 2 dòng: 1 câu hỏi vị trí kiểu
// "Where is...?" và 1 câu điền từ có sẵn đáp án ("The ___ is..."), khác ExampleRow (chỉ 1 dòng,
// dùng cho Part 1/2/3). CHỈ ĐỌC, không tính điểm, không tương tác — export dùng chung cho cả màn
// học sinh (ReadingRunner) lẫn preview trong CMS (ReadingStudio.jsx).
export function ExamplesPairRow({ examplesPair }) {
  const pair = examplesPair ?? [];
  if (!pair.some(ex => ex?.prompt)) return null;
  return (
    <div className="reading-examples-pair">
      <h3 className="reading-subheading">Examples</h3>
      {pair.map((ex, i) => {
        if (!ex?.prompt) return null;
        const hasBlank = ex.prompt.includes("___");
        return (
          <p className="reading-example-line" key={i}>
            {hasBlank
              ? ex.prompt.split("___").map((seg, si, arr) => (
                  <span key={si}>
                    {seg}
                    {si < arr.length - 1 && <span className="reading-example-answer">{ex.answer}</span>}
                  </span>
                ))
              : <>{ex.prompt} <span className="reading-example-answer">{ex.answer}</span></>}
          </p>
        );
      })}
    </div>
  );
}

// 1 đoạn truyện (Movers Part 5) — giữ nguyên xuống dòng giáo viên gõ (mỗi đoạn văn cách nhau 1
// dòng trống), CHỈ ĐỌC, không tính điểm. Truyện chia 3 đoạn xen giữa các nhóm câu hỏi (2+3+2 câu,
// khớp đúng cấu trúc 7 câu cố định của đề Movers Part 5 thật — xem MOVERS_PART_TEMPLATES).
export function StoryParagraph({ text, image }) {
  if (!text?.trim()) return null;
  return (
    <>
      {image && <img src={image} alt="" className="reading-part-img" />}
      <p className="reading-story-text">{text}</p>
    </>
  );
}

// Câu viết tự do — Movers Part 6 câu 5-6 ("Now write two sentences about the picture."), KHÔNG có
// đáp án đúng/sai, chỉ ghi lại nội dung học sinh viết để giáo viên đọc lại (xem ReadingReportView.jsx).
function FreeWritingQuestion({ question, qNumber, value, onChange }) {
  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        <textarea
          className="reading-freewrite-input"
          rows={2}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder="Viết 1 câu về bức tranh..."
        />
      </div>
    </div>
  );
}

// Đọc câu mô tả, GÕ TỰ DO từ đúng vào ô trống (khớp đúng cách làm bài thật "write the word on the
// line") — ngân hàng từ vẫn hiện sẵn ở khung WordBankBox đầu Part để học sinh tham khảo/chọn từ đó
// mà gõ lại, không phải chọn qua dropdown (đổi lại theo yêu cầu người dùng 2026-08-26).
function WordBankQuestion({ question, qNumber, value, onChange }) {
  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        <p className="reading-question-text">
          {question.text}{" "}
          <input
            className="reading-gap-input"
            value={value ?? ""}
            onChange={e => onChange(e.target.value)}
            size={Math.max(6, (question.answer?.length ?? 8) + 2)}
          />
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
  const items = flat.map(({ question, part, partIndex, qIndex, qNumber }) => {
    const value = answers[partIndex]?.[qIndex];
    const qPoints = effectiveQuestionPoints(part, question);
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
      const perGap = gapAnswers.length ? qPoints / gapAnswers.length : 0;
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

    if (question.type === "word-bank") {
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

    if (question.type === "multiple-choice") {
      const options = question.options ?? [];
      const isCorrect = value === question.answerIndex;
      const earned = isCorrect ? qPoints : 0;
      earnedPoints += earned;
      return {
        qNumber,
        question,
        isCorrect,
        earned,
        total: qPoints,
        studentAnswer: value !== undefined && value !== null ? options[value] ?? "(chưa trả lời)" : "(chưa trả lời)",
        correctAnswer: options[question.answerIndex] ?? "",
      };
    }

    if (question.type === "free-writing") {
      // Không có đáp án đúng/sai — chỉ ghi lại nội dung học sinh viết, KHÔNG cộng vào
      // totalPoints/earnedPoints (đã loại trừ ở effectiveQuestionPoints, qPoints luôn = 0 ở đây).
      return {
        qNumber,
        question,
        ungraded: true,
        studentAnswer: (value ?? "").trim() || "(chưa viết)",
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
              {part.fixedLayout !== "movers-part1" && part.image && (
                <img src={part.image} alt="" className="reading-part-img" />
              )}
              {part.caption && <p className="reading-part-caption">{part.caption}</p>}
            </div>
            {part.fixedLayout === "movers-part1" && (part.partImages?.[0] || part.partImages?.[1]) && (
              <div className="reading-part-images-pair">
                {part.partImages?.[0] && <img src={part.partImages[0]} alt="" />}
                {part.partImages?.[1] && <img src={part.partImages[1]} alt="" />}
              </div>
            )}
            <WordBankBox words={part.wordBank} />
            {part.fixedLayout === "movers-part5" && (
              <StoryParagraph text={part.storyParagraphs?.[0]} />
            )}
            {part.fixedLayout === "movers-part6" || part.fixedLayout === "movers-part5" ? (
              <ExamplesPairRow examplesPair={part.examplesPair} />
            ) : (
              <ExampleRow
                example={part.example}
                mode={
                  part.fixedLayout === "movers-part1"
                    ? "table-row"
                    : part.allowedTypes?.includes("multiple-choice")
                      ? "multiple-choice"
                      : "word-bank"
                }
              />
            )}
            {(part.fixedLayout === "movers-part6" || part.fixedLayout === "movers-part5" || part.fixedLayout === "movers-part1") && (
              <h3 className="reading-subheading">Questions</h3>
            )}
            <div className="reading-question-list">
              {(part.questions ?? []).map((q, qIndex) => {
                const { qNumber } = flat.find(f => f.partIndex === partIndex && f.qIndex === qIndex);
                const value = answers[partIndex]?.[qIndex];
                // 3 nhãn nhóm CỐ ĐỊNH của Movers Part 6, chèn đúng trước câu 0/2/4 (2 câu điền chỗ
                // trống + 2 câu trả lời mở + 2 câu viết tự do) — khớp y hệt sách gốc.
                const groupLabel =
                  part.fixedLayout === "movers-part6" && qIndex === 0
                    ? "Complete the sentences."
                    : part.fixedLayout === "movers-part6" && qIndex === 2
                      ? "Answer the questions."
                      : part.fixedLayout === "movers-part6" && qIndex === 4
                        ? "Now write two sentences about the picture."
                        : null;
                const groupHeader = groupLabel && <h4 className="reading-group-label">{groupLabel}</h4>;
                // Movers Part 5: truyện chia 3 đoạn CỐ ĐỊNH, đoạn 2/3 chèn trước câu 3 (qIndex 2)
                // và câu 6 (qIndex 5) — đoạn 1 đã hiện ở đầu Part (trên "Examples") phía trên.
                const storyParagraphIndex =
                  part.fixedLayout === "movers-part5" && qIndex === 2
                    ? 1
                    : part.fixedLayout === "movers-part5" && qIndex === 5
                      ? 2
                      : null;
                const storyBreak = storyParagraphIndex != null ? part.storyParagraphs?.[storyParagraphIndex] : null;
                const storyBreakEl = storyBreak && (
                  <StoryParagraph text={storyBreak} image={part.storyImages?.[storyParagraphIndex]} />
                );

                let body;
                if (q.type === "yesno") {
                  body = (
                    <YesNoQuestion
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                } else if (q.type === "gapfill") {
                  body = (
                    <GapfillQuestion
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
                } else if (q.type === "word-bank") {
                  body = (
                    <WordBankQuestion
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                } else if (q.type === "multiple-choice") {
                  body = (
                    <MultipleChoiceQuestion
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                } else if (q.type === "word-scramble") {
                  body = (
                    <WordScrambleQuestion
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                } else if (q.type === "free-writing") {
                  body = (
                    <FreeWritingQuestion
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                } else if (part.fixedLayout === "movers-part1") {
                  body = (
                    <AnswerTableRow
                      id={`rq-${qNumber}`}
                      label={qNumber}
                      text={q.prompt}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                } else {
                  body = (
                    <ShortAnswerQuestion
                      question={q}
                      qNumber={qNumber}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                }

                return (
                  <div className="reading-question-group" key={qIndex}>
                    {groupHeader}
                    {storyBreakEl}
                    {body}
                  </div>
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
