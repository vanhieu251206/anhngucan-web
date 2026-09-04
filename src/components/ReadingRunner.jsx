import { useMemo, useRef, useState } from "react";
import ReadingReportView from "./ReadingReportView.jsx";
import { incrementAttempt } from "../lib/attempts.js";

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
export function effectiveQuestionPoints(part, question, isFlyers) {
  if (question.type === "free-writing") return 0;
  // Reading Flyers (chốt 2026-09-02): mỗi Question — kể cả TỪNG chỗ trống gapfill được tách riêng
  // (xem gapfillBlankCount()/flattenQuestions()) — luôn đúng 1 điểm cố định, bỏ hẳn partPoints/
  // questionPoints (chỉ còn áp dụng cho Starters/Movers, giữ nguyên hành vi cũ).
  if (isFlyers) return 1;
  const gradedCount = (part.questions ?? []).filter(q => q.type !== "free-writing").length;
  if (part.partPoints != null && gradedCount > 0) return part.partPoints / gradedCount;
  return questionPoints(question);
}

// Số chỗ trống THẬT (không tính chỗ trống ví dụ `firstGapIsExample`) của 1 câu gapfill — dùng để
// tách mỗi chỗ trống thành 1 "Question N" riêng cho Reading Flyers (chốt 2026-09-02, yêu cầu người
// dùng: "mỗi chỗ trống để điền, hoặc mỗi một chỗ chọn đáp án thì sẽ là một Question N").
export function gapfillBlankCount(question) {
  const offset = question.firstGapIsExample ? 1 : 0;
  return Math.max((question.answers ?? []).length - offset, 0);
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
// Test — dùng để đồng bộ số thứ tự giữa nội dung chính và sidebar. Reading Flyers (`isFlyers`):
// mỗi chỗ trống THẬT của 1 câu gapfill (xem gapfillBlankCount()) tách thành 1 phần tử riêng
// (`gapIndex` = vị trí trong `question.answers`), mỗi phần tử là 1 "Question N" độc lập — khác
// Starters/Movers vẫn gộp cả đoạn gapfill thành 1 Question duy nhất (`gapIndex: null`).
function flattenQuestions(parts, isFlyers) {
  const flat = [];
  let n = 1;
  parts.forEach((part, partIndex) => {
    (part.questions ?? []).forEach((q, qIndex) => {
      if (isFlyers && q.type === "gapfill") {
        const offset = q.firstGapIsExample ? 1 : 0;
        const answers = q.answers ?? [];
        for (let gapIndex = offset; gapIndex < answers.length; gapIndex++) {
          flat.push({ question: q, part, partIndex, qIndex, gapIndex, qNumber: n });
          n += 1;
        }
      } else {
        flat.push({ question: q, part, partIndex, qIndex, gapIndex: null, qNumber: n });
        n += 1;
      }
    });
  });
  return flat;
}

function isAnswered(question, value, gapIndex) {
  if (question.type === "gapfill") {
    if (gapIndex != null) return !!(value?.[gapIndex] ?? "").toString().trim();
    return (value ?? []).some(v => (v ?? "").trim());
  }
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

// `qNumbers` (map gapIndex -> qNumber): khi có (Reading Flyers), mỗi chỗ trống THẬT hiện badge
// "Question N" riêng ngay tại vị trí chỗ trống thay cho nhãn "(N)" cũ, KHÔNG còn 1 badge chung cho
// cả đoạn — chốt 2026-09-02. Khi không có (Starters/Movers), giữ nguyên hành vi cũ.
function GapfillQuestion({ question, qNumber, qNumbers, values, onChange, hideImage }) {
  const segments = useMemo(() => splitGapfillText(question.text), [question.text]);
  const answers = question.answers ?? [];
  const split = !!qNumbers;

  return (
    <div className="reading-question" id={split ? undefined : `rq-${qNumber}`}>
      {!split && <QuestionBadge qNumber={qNumber} />}
      <div className="reading-question-body">
        {!hideImage && question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <p className="reading-gapfill-text">
          {segments.map((seg, i) => {
            const isLast = i === segments.length - 1;
            const gapIndex = i;
            if (isLast) return <span key={i}>{seg}</span>;
            const answered = values[gapIndex] ?? "";
            const correct = answers[gapIndex];
            // Movers Part 4 (`firstGapIsExample`) — chỗ trống ĐẦU TIÊN luôn là ví dụ mẫu, hiện sẵn
            // đáp án (KHÔNG phải ô nhập), không đánh số. Từ chỗ trống thứ 2 trở đi mới là câu thật,
            // số thứ tự TỰ ĐỘNG tính theo vị trí (gapIndex, vì index 0 là ví dụ nên gapIndex đã
            // đúng là số hiển thị 1/2/3...) — KHÔNG đọc số gõ tay trong text như các Part khác nữa
            // (nút "+ Chèn chỗ trống" đã bị bỏ cho Part này, xem GapfillTextEditor) — chốt 2026-08-27.
            if (question.firstGapIsExample && gapIndex === 0) {
              const exampleChoices = question.gapMode === "choices" ? question.gapOptions?.[0]?.options : null;
              return (
                <span key={i}>
                  {seg}
                  {exampleChoices ? (
                    // gapMode="choices" — ví dụ cũng hiện ĐỦ 3 nút như câu thật, đáp án đúng tô sẵn
                    // (không bấm được, chỉ minh hoạ cách làm) thay vì chỉ hiện 1 chữ gạch chân.
                    <span className="reading-gap-choices">
                      {exampleChoices.map((opt, ci) => (
                        <span
                          key={ci}
                          className={`reading-gap-choice-btn${opt === correct && opt ? " is-selected" : ""}`}
                        >
                          {opt || `(chưa nhập lựa chọn ${ci + 1})`}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="reading-gap-nowrap">
                      <span className="reading-example-answer">{correct}</span>
                    </span>
                  )}
                </span>
              );
            }
            // Tách riêng nhãn số thứ tự "(N)" (do GapfillTextEditor tự chèn liền sát ô trống, vd
            // "...very (2)___") ra khỏi phần chữ còn lại, rồi bọc CHUNG với ô input trong 1 span
            // white-space:nowrap — tránh việc trình duyệt xuống dòng giữa "(2)" và ô trống thành 2
            // dòng tách rời trông rất rối (lỗi thực tế 2026-08-26, đoạn văn dài nhiều dòng).
            const numMatch = !question.firstGapIsExample && seg.match(/(\(\d+\))\s*$/);
            const prefix = numMatch ? seg.slice(0, numMatch.index) : seg;
            const marker = split ? "" : numMatch ? numMatch[1] : question.firstGapIsExample ? `(${gapIndex})` : "";
            const choices = question.gapMode === "choices" ? question.gapOptions?.[gapIndex]?.options : null;
            return (
              <span key={i}>
                {prefix}
                {split && (
                  <span className="reading-gap-inline-badge" id={`rq-${qNumbers[gapIndex]}`}>
                    Question {qNumbers[gapIndex]}
                  </span>
                )}
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
        <div className={`reading-mc-options${question.hideLetters ? " reading-mc-options-tickbox" : ""}`}>
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

// Khung ngân hàng đáp án ĐẦY ĐỦ CÂU, đánh chữ A-H (Flyers Part 2) — khác WordBankBox (Part 1, chip
// từ ngắn nằm ngang): đây là danh sách DỌC, mỗi dòng 1 câu trả lời đầy đủ kèm chữ cái, khớp đúng
// khung "A/B/C.../H" trong sách gốc. Chữ cái tính theo VỊ TRÍ trong mảng (không lưu riêng).
export function LetteredAnswerBox({ items }) {
  if (!items?.length) return null;
  return (
    <div className="reading-letterbank-box">
      {items.map((it, i) => (
        <div className="reading-letterbank-row" key={i}>
          <span className="reading-letterbank-letter">{optionLetter(i)}</span>
          <span className="reading-letterbank-text">{bankLabel(it) || <em>(chưa nhập)</em>}</span>
        </div>
      ))}
    </div>
  );
}

// Dropdown TỰ DỰNG (không dùng <select> mặc định trình duyệt) — bấm vào ô hiện tại thì danh sách
// đáp án xổ ra NGAY BÊN DƯỚI (đẩy nội dung phía sau xuống, không phải popup nổi của trình duyệt),
// chọn xong thu gọn lại chỉ còn đáp án đã chọn (yêu cầu người dùng 2026-08-31, thay cho <select>
// mặc định vốn mở popup theo kiểu riêng của từng hệ điều hành/trình duyệt).
function LetterDropdown({ value, onChange, wordBank }) {
  const [open, setOpen] = useState(false);
  const selectedIndex = (wordBank ?? []).findIndex(w => bankLabel(w) === value);
  return (
    <span className="reading-letter-dropdown">
      <button
        type="button"
        className={`reading-letter-dropdown-trigger${open ? " is-open" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        {selectedIndex >= 0 ? (
          <>
            <span className="reading-letterbank-letter">{optionLetter(selectedIndex)}</span>
            {value}
          </>
        ) : (
          <span className="reading-letter-dropdown-placeholder">— Chọn đáp án —</span>
        )}
        <span className="reading-letter-dropdown-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="reading-letter-dropdown-list">
          {(wordBank ?? []).map((w, i) => (
            <button
              type="button"
              key={i}
              className={`reading-letter-dropdown-option${bankLabel(w) === value ? " is-selected" : ""}`}
              onClick={() => {
                onChange(bankLabel(w));
                setOpen(false);
              }}
            >
              <span className="reading-letterbank-letter">{optionLetter(i)}</span>
              {bankLabel(w) || <em>(chưa nhập)</em>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// 1 câu hỏi Part 2 Flyers — hiện câu hỏi rồi CHỌN 1 đáp án trong ngân hàng chung qua LetterDropdown
// (bấm vào ô thì cả 8 đáp án xổ ra NGAY BÊN DƯỚI, chọn xong thu gọn lại còn đúng đáp án đã chọn) —
// KHÔNG hiện tên người hỏi/người trả lời nữa (yêu cầu người dùng 2026-08-31). readOnly dùng cho
// dòng Example (đáp án đã có sẵn, chỉ hiện chữ, không chọn được).
export function ConversationSelectRow({ askerText, value, onChange, wordBank, readOnly, badge, id }) {
  return (
    <div className="reading-question" id={id}>
      {badge}
      <div className="reading-question-body">
        <p className="reading-question-text">{askerText}</p>
        <div className="reading-conversation-line">
          {readOnly ? (
            <span className="reading-answer-row-value">{value}</span>
          ) : (
            <LetterDropdown value={value} onChange={onChange} wordBank={wordBank} />
          )}
        </div>
      </div>
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
function FreeWritingQuestion({ question, qNumber, value, onChange, rows = 2, placeholder = "Viết 1 câu về bức tranh..." }) {
  return (
    <div className="reading-question" id={`rq-${qNumber}`}>
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        <textarea
          className="reading-freewrite-input"
          rows={rows}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
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

  const answeredCount = flat.filter(({ question, partIndex, qIndex, gapIndex }) =>
    isAnswered(question, answers[partIndex]?.[qIndex], gapIndex)
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
        {flat.map(({ qNumber, question, partIndex, qIndex, gapIndex }) => {
          const answered = isAnswered(question, answers[partIndex]?.[qIndex], gapIndex);
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

// Dựng lại đoạn văn gapfill cho màn tổng kết — chỉ 1 chỗ trống ĐANG chấm (gapIndex) được đánh dấu
// nổi bật, các chỗ trống khác hiện ĐÁP ÁN ĐÚNG mờ đi làm ngữ cảnh — tránh tình trạng mỗi Question
// (Reading Flyers, mỗi chỗ trống tách riêng — xem flattenQuestions()) đều hiện y hệt cả đoạn văn
// dài, không phân biệt được đang chấm vị trí nào (phản hồi thực tế 2026-09-02).
function gapfillReviewLabel(question, gapIndex) {
  const segments = splitGapfillText(question.text);
  return segments.map((seg, i) => {
    const isLast = i === segments.length - 1;
    if (isLast) return <span key={i}>{seg}</span>;
    return (
      <span key={i}>
        {seg}
        {i === gapIndex ? (
          <mark className="review-gapfill-current">_____</mark>
        ) : (
          <span className="review-gapfill-context">{question.answers?.[i] || "___"}</span>
        )}
      </span>
    );
  });
}

// Chấm điểm TOÀN BỘ bài + dựng sẵn nội dung hiển thị cho từng câu (đáp án học sinh chọn/gõ vs đáp
// án đúng) — dùng ngay khi bấm "Nộp bài", kết quả đưa thẳng vào ReadingReportView.jsx.
function buildResults(flat, answers, isFlyers) {
  let earnedPoints = 0;
  let totalPoints = 0;
  const items = flat.map(({ question, part, partIndex, qIndex, qNumber, gapIndex }) => {
    const value = answers[partIndex]?.[qIndex];
    const qPoints = effectiveQuestionPoints(part, question, isFlyers);
    totalPoints += qPoints;

    // Reading Flyers: mỗi chỗ trống gapfill đã được tách thành 1 flat item riêng (gapIndex khác
    // null) — chấm độc lập như 1 câu-1-đáp-án bình thường, KHÔNG gộp vào mảng `blanks[]` như
    // Starters/Movers (chốt 2026-09-02).
    if (question.type === "gapfill" && gapIndex != null) {
      const correct = question.answers?.[gapIndex];
      const isCorrect = normalizeAnswer(value?.[gapIndex]) === normalizeAnswer(correct);
      const earned = isCorrect ? qPoints : 0;
      earnedPoints += earned;
      return {
        qNumber,
        question,
        isCorrect,
        earned,
        total: qPoints,
        studentAnswer: value?.[gapIndex]?.trim() || "(để trống)",
        correctAnswer: correct,
        questionLabel: gapfillReviewLabel(question, gapIndex),
      };
    }

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
      // Chỗ trống ví dụ (Part 4, `firstGapIsExample`) không tính điểm — bỏ khỏi mẫu số chia đều
      // VÀ khỏi danh sách chấm, offset +1 khi đọc lại value[] (index 0 vẫn là ví dụ trong mảng gốc).
      const offset = question.firstGapIsExample ? 1 : 0;
      const gapAnswers = (question.answers ?? []).slice(offset);
      const perGap = gapAnswers.length ? qPoints / gapAnswers.length : 0;
      let gapEarned = 0;
      const blanks = gapAnswers.map((a, gi) => {
        const ok = normalizeAnswer(value?.[gi + offset]) === normalizeAnswer(a);
        if (ok) gapEarned += perGap;
        return { correct: ok, studentAnswer: value?.[gi + offset]?.trim() || "(để trống)", correctAnswer: a };
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
export default function ReadingRunner({ parts, onFinish, studentUid, seriesId, level, testId }) {
  // Movers dùng chung quy tắc tính điểm/đánh số theo từng chỗ trống với Flyers (chốt 2026-09-04:
  // "mỗi chỗ trống điền từ hoặc chọn đáp án đều là một Question N, mỗi câu 1 điểm" — áp dụng luôn
  // cho Movers, chỉ Starters còn giữ cách gộp cả câu gapfill thành 1 Question).
  const isFlyers = seriesId === "flyers" || seriesId === "movers";
  const flat = useMemo(() => flattenQuestions(parts, isFlyers), [parts, isFlyers]);
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
    setResults(buildResults(flat, answers, isFlyers));
    // Tính 1 lượt nộp bài (chốt 2026-08-27, xem lib/attempts.js) — chỉ khi có studentUid (học
    // sinh đã đăng nhập thật, không phải admin/teacher tự test).
    if (studentUid) incrementAttempt({ uid: studentUid, mode: "reading", testId, seriesId, level });
  }

  if (!flat.length) return null;

  const unansweredCount = flat.filter(
    ({ question, partIndex, qIndex, gapIndex }) => !isAnswered(question, answers[partIndex]?.[qIndex], gapIndex)
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
            {/* Part 3 Movers: khung "Example" (ngân hàng từ CÓ ẢNH) nằm GIỮA đoạn truyện gapfill và
                câu chọn tiêu đề, KHÔNG ở đầu Part như mọi Part khác — render bên trong danh sách câu
                hỏi bên dưới (xem exampleBreakEl), không hiện ở đây. Part 2 Flyers: ngân hàng đáp án
                hiện dạng danh sách DỌC đánh chữ A-H (LetteredAnswerBox), khác chip ngang thường. */}
            {part.fixedLayout === "flyers-part2" ? (
              <LetteredAnswerBox items={part.wordBank} />
            ) : part.fixedLayout === "flyers-part3" ? (
              <>
                <h3 className="reading-subheading">Example</h3>
                <WordBankBox words={part.wordBank} />
              </>
            ) : (
              part.fixedLayout !== "movers-part3" && <WordBankBox words={part.wordBank} />
            )}
            {part.fixedLayout === "movers-part5" || part.fixedLayout === "flyers-part5" ? (
              <StoryParagraph text={part.storyParagraphs?.[0]} />
            ) : null}
            {part.fixedLayout === "movers-part6" || part.fixedLayout === "movers-part5" || part.fixedLayout === "flyers-part5" ? (
              <ExamplesPairRow examplesPair={part.examplesPair} />
            ) : part.fixedLayout === "movers-part3" || part.fixedLayout === "flyers-part3" ? null : part.fixedLayout === "flyers-part2" ? (
              <ConversationSelectRow
                askerText={part.example?.text}
                value={part.example?.answer}
                wordBank={part.wordBank}
                readOnly
                badge={<div className="reading-question-badge reading-example-badge">Example</div>}
              />
            ) : (
              <ExampleRow
                example={part.example}
                mode={
                  part.fixedLayout === "movers-part1" || part.fixedLayout === "flyers-part1"
                    ? "table-row"
                    : part.allowedTypes?.includes("multiple-choice")
                      ? "multiple-choice"
                      : "word-bank"
                }
              />
            )}
            {["movers-part6", "movers-part5", "movers-part1", "flyers-part1", "flyers-part2", "flyers-part5"].includes(part.fixedLayout) && (
              <h3 className="reading-subheading">Questions</h3>
            )}
            <div className="reading-question-list">
              {(part.questions ?? []).map((q, qIndex) => {
                const entries = flat.filter(f => f.partIndex === partIndex && f.qIndex === qIndex);
                const qNumber = entries[0].qNumber;
                // Reading Flyers: mỗi chỗ trống THẬT của gapfill có 1 flat item riêng (gapIndex khác
                // null) — dựng map gapIndex -> qNumber để GapfillQuestion hiện đúng "Question N" tại
                // từng vị trí (chốt 2026-09-02).
                const gapNumbers =
                  isFlyers && q.type === "gapfill"
                    ? Object.fromEntries(entries.map(e => [e.gapIndex, e.qNumber]))
                    : null;
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
                // Movers Part 5: truyện chia 4 đoạn CỐ ĐỊNH — đoạn 1 đã hiện ở đầu Part (trên
                // "Examples") phía trên; đoạn 2/3/4 chèn trước câu 1/3/6 (qIndex 0/2/5) — bổ sung
                // đoạn trước câu 1 (chốt 2026-09-04, sách thật có đoạn "'This is boring,' Sally
                // said..." xen giữa Examples và câu 1, trước đó code chỉ hỗ trợ 3 đoạn nên thiếu).
                const storyParagraphIndex =
                  part.fixedLayout === "movers-part5" && qIndex === 0
                    ? 1
                    : part.fixedLayout === "movers-part5" && qIndex === 2
                      ? 2
                      : part.fixedLayout === "movers-part5" && qIndex === 5
                        ? 3
                        : null;
                const storyBreak = storyParagraphIndex != null ? part.storyParagraphs?.[storyParagraphIndex] : null;
                const storyBreakEl = storyBreak && (
                  <StoryParagraph text={storyBreak} image={part.storyImages?.[storyParagraphIndex]} />
                );
                // Part 3 Movers: khung "Example" (ngân hàng từ có ảnh) chèn NGAY TRƯỚC câu
                // multiple-choice ĐẦU TIÊN — không cố định theo qIndex (khác Part 5/6) vì Test cũ có
                // thể có số câu gapfill khác 1, dò theo TYPE để không lệch vị trí.
                const isFirstMultipleChoice =
                  part.fixedLayout === "movers-part3" &&
                  q.type === "multiple-choice" &&
                  (part.questions ?? []).findIndex(qq => qq.type === "multiple-choice") === qIndex;
                const exampleBreakEl = isFirstMultipleChoice && (
                  <div className="reading-part3-example-box">
                    <h3 className="reading-subheading">Example</h3>
                    <WordBankBox words={part.wordBank} />
                  </div>
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
                      qNumbers={gapNumbers}
                      values={value ?? []}
                      hideImage={part.fixedLayout === "movers-part3" || part.fixedLayout === "flyers-part3"}
                      onChange={(gapIndex, val) =>
                        setAnswer(partIndex, qIndex, (() => {
                          const cur = [...(value ?? [])];
                          cur[gapIndex] = val;
                          return cur;
                        })())
                      }
                    />
                  );
                } else if (q.type === "word-bank" && part.fixedLayout === "flyers-part1") {
                  body = (
                    <AnswerTableRow
                      id={`rq-${qNumber}`}
                      label={qNumber}
                      text={q.text}
                      value={value}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
                    />
                  );
                } else if (q.type === "word-bank" && part.fixedLayout === "flyers-part2") {
                  body = (
                    <ConversationSelectRow
                      id={`rq-${qNumber}`}
                      badge={<QuestionBadge qNumber={qNumber} />}
                      askerText={q.text}
                      value={value}
                      wordBank={part.wordBank}
                      onChange={val => setAnswer(partIndex, qIndex, val)}
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
                      rows={part.fixedLayout === "flyers-part7" ? 6 : 2}
                      placeholder={
                        part.fixedLayout === "flyers-part7"
                          ? "Viết câu chuyện dựa theo 3 bức tranh (từ 20 từ trở lên)..."
                          : "Viết 1 câu về bức tranh..."
                      }
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
                    {exampleBreakEl}
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
