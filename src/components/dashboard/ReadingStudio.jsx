import { useEffect, useMemo, useRef, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";
import { WORD_SCRAMBLE_DEFAULT_TEXT, scrambleWord, questionPoints, gapPoints, QuestionBadge, WordBankBox, ExampleRow, optionLetter, bankLabel, bankImage } from "../ReadingRunner.jsx";

// Mỗi loại câu hỏi gắn với `series` — danh sách seriesId được PHÉP dùng type này. Khi soạn bài,
// menu "+ Thêm câu hỏi" chỉ hiện type khớp seriesId của bài đang soạn (xem questionTypesFor()) —
// tránh nhầm lẫn giữa các dạng bài đặc thù của từng cấp Cambridge YLE (vd Flyers có multiple-choice/
// word-bank không tồn tại trong đề Starters thật, ngược lại word-scramble chỉ có ở Starters).
const QUESTION_TYPES = [
  { type: "yesno", icon: "✅", label: "Đúng/Sai (Yes/No)", desc: "Xem tranh, đọc câu, chọn Yes hoặc No", series: ["starters"] },
  { type: "gapfill", icon: "📝", label: "Điền từ vào đoạn văn", desc: "Đoạn văn có nhiều chỗ trống, mỗi chỗ điền 1 từ", series: ["starters", "flyers", "movers"] },
  { type: "short-answer", icon: "✏️", label: "Trả lời ngắn", desc: "Điền 1 từ để hoàn thành câu trả lời", series: ["starters", "flyers", "movers"] },
  { type: "word-scramble", icon: "🔤", label: "Xáo chữ cái đoán từ vựng", desc: "Xem ảnh, ghép lại các ô chữ cái bị xáo trộn thành đúng từ", series: ["starters"] },
  { type: "multiple-choice", icon: "🔘", label: "Chọn 1 đáp án đúng", desc: "Hiện nhiều đáp án (radio), học sinh chọn 1 đáp án đúng", series: ["flyers", "movers"] },
  { type: "word-bank", icon: "🗂️", label: "Chọn từ trong ngân hàng từ", desc: "Đọc câu, gõ đúng từ có trong ngân hàng từ chung của cả Part", series: ["flyers"] },
];

// Khung 7 Part cố định của 1 Test Reading & Writing Flyers thật (Cambridge YLE) — tạo sẵn tự động
// khi mở 1 Test Flyers mới CHƯA có Part nào, giáo viên chỉ điền nội dung chứ không tự thêm/xoá/đổi
// tên Part hay tự chọn loại câu hỏi nữa (yêu cầu người dùng 2026-08-26). `allowedTypes` khoá cứng
// loại câu hỏi được phép thêm ở từng Part — PartEditor dựa vào đây để ẩn hẳn menu chọn dạng khi chỉ
// có 1 lựa chọn, hoặc thu hẹp menu khi Part có nhiều hơn 1 dạng (vd Part 3: vừa gapfill vừa multiple-
// choice). Part 7 (viết đoạn văn tự do, "story-writing") CHƯA lập trình xong — để trống tạm thời.
const FLYERS_PART_TEMPLATES = [
  {
    title: "Part 1 – Reading and Writing",
    instruction: "Look and read. Choose the correct words and write them on the lines. There is one example.",
    allowedTypes: ["word-bank"],
  },
  {
    title: "Part 2 – Reading and Writing",
    instruction: "Read the conversation. Choose the correct answer. Write a letter (A-H) for each answer. You do not need to use all the letters. There is one example.",
    allowedTypes: ["word-bank"],
  },
  {
    title: "Part 3 – Reading and Writing",
    instruction: "Read the story. Choose a word for each gap, then choose the best name for the story.",
    allowedTypes: ["gapfill", "multiple-choice"],
    hasWordBank: true,
  },
  {
    title: "Part 4 – Reading and Writing",
    instruction: "Read the text. Choose the right words and write them on the lines.",
    allowedTypes: ["gapfill"],
  },
  {
    title: "Part 5 – Reading and Writing",
    instruction: "Look at the picture and read the story. Write some words to complete the sentences. You can use 1, 2, 3 or 4 words.",
    allowedTypes: ["short-answer"],
  },
  {
    title: "Part 6 – Reading and Writing",
    instruction: "Read the diary and write the missing words. Write one word on each line.",
    allowedTypes: ["gapfill"],
  },
  {
    title: "Part 7 – Reading and Writing",
    instruction: "Look at the three pictures. Write about this story. Write 20 or more words.",
    allowedTypes: ["story-writing"],
  },
];

// Movers có đủ 6 Part/bài (khác Flyers 7 Part) — mới chốt được cấu trúc Part 1 (câu đơn: ảnh + câu
// mô tả có chỗ trống + đáp án, dùng type "short-answer"), Part 2 (hội thoại 2 nhân vật, mỗi dòng là
// 1 câu multiple-choice 3 đáp án, có ảnh + 1 dòng giới thiệu ngữ cảnh riêng — xem field `caption`
// trong PartEditor) và Part 3 (mỗi câu tự chọn 1 trong 2 dạng: gapfill kiểu Starters — gõ tự do, có
// nút đục lỗ — hoặc multiple-choice cho câu chọn tiêu đề đúng; ngân hàng từ chỉ để HIỆN THAM KHẢO,
// chỉ chữ giống hệt Part 1 — `hasWordBank: true`, KHÔNG có ảnh) và Part 4 (gapfill khoá cứng, 1
// đoạn văn dài duy nhất, KHÔNG có ngân hàng từ tham khảo — ảnh minh hoạ dùng field ảnh sẵn có của
// chính câu gapfill đó). Part 5-6 CHƯA rõ cấu trúc, để trống + không khoá allowedTypes (giáo viên
// tạm chọn type tự do trong số type đã gắn series "movers") — sẽ khoá cứng khi có đề thật.
const MOVERS_PART_TEMPLATES = [
  {
    title: "Part 1 – Reading and Writing",
    instruction: "Look and read. Write the correct word next to numbers 1-5.",
    allowedTypes: ["short-answer"],
  },
  {
    title: "Part 2 – Reading and Writing",
    instruction: "Read the text and choose the best answer.",
    allowedTypes: ["multiple-choice"],
  },
  {
    title: "Part 3 – Reading and Writing",
    instruction: "Read the story. Choose a word from the box. Write the correct word next to numbers 1-5. Then choose the best name for the story.",
    allowedTypes: ["gapfill", "multiple-choice"],
    hasWordBank: true,
  },
  {
    title: "Part 4 – Reading and Writing",
    instruction: "Read the text. Write the missing words.",
    allowedTypes: ["gapfill"],
  },
  { title: "Part 5 – Reading and Writing", instruction: "", allowedTypes: null },
  { title: "Part 6 – Reading and Writing", instruction: "", allowedTypes: null },
];

// Map seriesId -> khung Part dựng sẵn (nếu có) — dùng cho nút "+ Tạo N Part mẫu" ở màn rỗng.
const SERIES_PART_TEMPLATES = {
  flyers: FLYERS_PART_TEMPLATES,
  movers: MOVERS_PART_TEMPLATES,
};

function blankPartsFromTemplates(templates) {
  return templates.map(t => ({
    title: t.title,
    instruction: t.instruction,
    allowedTypes: t.allowedTypes,
    hasWordBank: t.hasWordBank ?? false,
    wordBankImages: t.wordBankImages ?? false,
    questions: [],
    wordBank: [],
    example: null,
    partPoints: null,
    caption: null,
  }));
}

function typeInfo(type) {
  return QUESTION_TYPES.find(t => t.type === type);
}

// Danh sách type được phép hiện trong menu "+ Thêm câu hỏi" của 1 bài — lọc theo seriesId. Không
// nhận diện được seriesId (dữ liệu cũ/series khác) thì hiện tất cả, tránh khoá nhầm khi mở rộng
// sang series mới chưa kịp gắn nhãn.
function questionTypesFor(seriesId) {
  if (!seriesId) return QUESTION_TYPES;
  const filtered = QUESTION_TYPES.filter(t => t.series.includes(seriesId));
  return filtered.length ? filtered : QUESTION_TYPES;
}

// Điểm mặc định khi tạo câu mới — 1 điểm/câu. Giáo viên sửa lại tổng điểm câu bất kỳ lúc nào qua
// ô "Điểm" (riêng gapfill: tổng điểm câu tự chia đều cho các chỗ trống, xem gapPoints() trong
// ReadingRunner.jsx).
function blankQuestion(type) {
  if (type === "yesno") return { type, image: null, text: "", answer: "yes", points: 1 };
  if (type === "gapfill") return { type, image: null, text: "", answers: [], points: 1 };
  if (type === "word-scramble") return { type, image: null, text: WORD_SCRAMBLE_DEFAULT_TEXT, answer: "", points: 1 };
  if (type === "multiple-choice") return { type, text: "", options: ["", "", ""], answerIndex: 0, points: 1 };
  if (type === "word-bank") return { type, text: "", answer: "", points: 1 };
  return { type: "short-answer", image: null, prompt: "", answer: "", points: 1 };
}

function blankPart(order) {
  return { title: `Part ${order} – Reading and Writing`, instruction: "", questions: [], wordBank: [], example: null, partPoints: null, caption: null };
}

// Câu ví dụ mẫu (Example) — CHỈ hiện cho học sinh xem cách làm, không tính điểm, không phải câu
// hỏi thật (khớp đúng sách gốc luôn có 1 dòng "Example" trước các câu hỏi thật) — cấu trúc lưu tuỳ
// theo `mode` (loại câu hỏi chính của Part): "word-bank" lưu {text, answer} (chọn từ ngân hàng
// chung của Part), "multiple-choice" lưu {text, options, answerIndex} y hệt 1 câu multiple-choice
// thật (yêu cầu người dùng 2026-08-26, vd Movers Part 2 hội thoại 3 đáp án A/B/C).
function ExampleEditor({ example, wordBank, mode, onChange }) {
  if (mode === "multiple-choice") {
    const value = example ?? { text: "", options: ["", "", ""], answerIndex: 0 };
    return (
      <fieldset className="admin-fieldset">
        <legend>💡 Câu ví dụ mẫu (Example)</legend>
        <label className="admin-mini-field">
          <span>Câu thoại ví dụ</span>
          <input
            className="admin-input"
            value={value.text}
            onChange={e => onChange({ ...value, text: e.target.value })}
            placeholder="vd: Fred: Our new kitten is so funny!"
          />
        </label>
        {(value.options ?? []).map((opt, i) => (
          <div className="admin-mc-option-row" key={i}>
            <span className="reading-mc-option-letter">{optionLetter(i)}</span>
            <input
              type="radio"
              name="example-mc-answer"
              checked={value.answerIndex === i}
              onChange={() => onChange({ ...value, answerIndex: i })}
            />
            <input
              className="admin-input"
              value={opt}
              onChange={e => {
                const next = [...value.options];
                next[i] = e.target.value;
                onChange({ ...value, options: next });
              }}
              placeholder={`Đáp án ${i + 1}`}
            />
          </div>
        ))}
      </fieldset>
    );
  }

  const value = example ?? { text: "", answer: "" };
  return (
    <fieldset className="admin-fieldset">
      <legend>💡 Câu ví dụ mẫu (Example)</legend>
      <label className="admin-mini-field">
        <span>Câu mô tả ví dụ</span>
        <input
          className="admin-input"
          value={value.text}
          onChange={e => onChange({ ...value, text: e.target.value })}
          placeholder="vd: If your car engine is making a strange noise, call this person!"
        />
      </label>
      <label className="admin-mini-field">
        <span>Đáp án ví dụ (chọn trong ngân hàng từ)</span>
        <select
          className="admin-input"
          value={value.answer}
          onChange={e => onChange({ ...value, answer: e.target.value })}
        >
          <option value="">— Chọn từ —</option>
          {(wordBank ?? []).map((w, i) => (
            <option key={i} value={bankLabel(w)}>{bankLabel(w) || `(từ ${i + 1} chưa nhập)`}</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

// Ngân hàng từ dùng chung cho cả Part — các câu "word-bank" bên trong Part đọc chung danh sách
// này (giáo viên nhập 1 lần, khỏi gõ lặp lại ở từng câu — yêu cầu người dùng khi soạn Flyers Part 1
// có 10 câu cùng dùng chung 15 từ).
// withImages=true (Movers Part 3 — mỗi từ kèm ảnh minh hoạ, xem sách gốc) hiện thêm 1
// ImageUploadField dưới mỗi từ; false (Part 1/2 — chỉ chữ) giữ nguyên giao diện gọn cũ. Dữ liệu
// mỗi mục có thể là string (cũ) hoặc {text, image} (mới) — đọc/ghi qua bankLabel()/bankImage().
function WordBankEditor({ words, onChange, withImages = false }) {
  const [bulkText, setBulkText] = useState("");

  function setWord(i, val) {
    const next = [...words];
    next[i] = withImages ? { text: val, image: bankImage(next[i]) } : val;
    onChange(next);
  }
  function setWordImage(i, image) {
    const next = [...words];
    next[i] = { text: bankLabel(next[i]), image };
    onChange(next);
  }
  function removeWord(i) {
    onChange(words.filter((_, idx) => idx !== i));
  }
  // Dán 1 lần nhiều từ (mỗi từ 1 dòng hoặc ngăn cách bằng dấu phẩy) thay vì bấm "+ Thêm từ" từng
  // cái — nhanh hơn hẳn khi 1 Part có tới 10-15 từ như đề Flyers thật (yêu cầu người dùng 2026-08-26).
  function addBulk() {
    const words2 = bulkText.split(/[\n,]/).map(w => w.trim()).filter(Boolean);
    if (!words2.length) return;
    onChange([...words, ...words2]);
    setBulkText("");
  }

  return (
    <fieldset className="admin-fieldset">
      <legend>🗂️ Ngân hàng từ dùng chung{withImages ? " (kèm ảnh minh hoạ)" : ""}</legend>
      <label className="admin-mini-field">
        <span>Dán nhanh nhiều từ (mỗi từ 1 dòng hoặc ngăn cách bằng dấu phẩy{withImages ? " — thêm ảnh riêng từng từ bên dưới sau" : ""})</span>
        <textarea
          className="admin-input admin-textarea"
          rows={3}
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={"vd:\ngolf, channels, a mechanic, a museum, a theatre\na race, an artist, a university, a pilot, a quiz\ncartoons, an astronaut, a factory, a waiter, chess"}
        />
        <button type="button" className="admin-btn-secondary admin-gap-insert-btn" onClick={addBulk} disabled={!bulkText.trim()}>
          + Thêm hàng loạt vào ngân hàng từ
        </button>
      </label>
      {words.length === 0 && <p className="admin-hint">Chưa có từ nào — dán ở trên hoặc bấm "+ Thêm từ" bên dưới.</p>}
      {words.map((w, i) => (
        <div className={withImages ? "admin-wordbank-item-card" : "admin-mc-option-row"} key={i}>
          <div className="admin-mc-option-row">
            <input
              className="admin-input"
              value={bankLabel(w)}
              onChange={e => setWord(i, e.target.value)}
              placeholder={`Từ ${i + 1}, vd: a mechanic`}
            />
            <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeWord(i)}>
              Xoá
            </button>
          </div>
          {withImages && (
            <ImageUploadField
              label={`Ảnh cho từ "${bankLabel(w) || i + 1}"`}
              value={bankImage(w)}
              onChange={image => setWordImage(i, image)}
            />
          )}
        </div>
      ))}
      <button type="button" className="admin-link-btn" onClick={() => onChange([...words, withImages ? { text: "", image: null } : ""])}>
        + Thêm từ
      </button>
    </fieldset>
  );
}

// Đếm số chỗ trống "___" trong đoạn văn gapfill để tự sinh đúng số ô nhập đáp án (answers[]) —
// mỗi chỗ trống đều là 1 câu học sinh phải điền, không có khái niệm "ví dụ mẫu" tự động (giáo
// viên tự gõ số thứ tự/ví dụ như văn bản thường trong đoạn văn nếu muốn, xem ReadingRunner.jsx).
function countGaps(text) {
  return (text.match(/___/g) || []).length;
}

// mode="choices" (Flyers Part 4 kiểu "Swan" — mỗi chỗ trống có sẵn 3 lựa chọn cho học sinh BẤM
// CHỌN thay vì gõ tự do, bấm vào thì highlight) — khác mode="free" (mặc định, gõ tay như Starters).
// Lưu `gapOptions[i] = { options: [3 lựa chọn] }` — BỌC TRONG OBJECT chứ không để mảng lồng mảng
// trực tiếp ([[...],[...]]) vì Firestore CẤM mảng lồng mảng, set/update sẽ ném lỗi (lỗi thực tế
// 2026-08-27: "Đang xuất bản" bị treo mãi vì lỗi này bị nuốt mất, xem thêm CreateLessonPage.jsx).
// `answers[i]` (đã có sẵn) vẫn là đáp án đúng, đồng bộ qua radio "Đáp án đúng" chọn 1 trong 3 ô
// thay vì gõ tay riêng — tránh gõ trùng lặp/gõ lệch chính tả giữa answers[i] và 1 trong 3 lựa chọn.
function GapfillAnswersEditor({ question, onChange, mode = "free" }) {
  const gapCount = countGaps(question.text || "");
  const answers = question.answers ?? [];
  const gapOptions = question.gapOptions ?? [];

  function optsOf(i) {
    return gapOptions[i]?.options ?? ["", "", ""];
  }

  function setAnswer(i, val) {
    const next = [...answers];
    while (next.length < gapCount) next.push("");
    next[i] = val;
    onChange({ answers: next.slice(0, gapCount) });
  }
  function setOption(i, optIndex, val) {
    const nextOptions = gapOptions.map(g => ({ options: [...(g?.options ?? ["", "", ""])] }));
    while (nextOptions.length < gapCount) nextOptions.push({ options: ["", "", ""] });
    const prevOptText = optsOf(i)[optIndex] ?? "";
    nextOptions[i] = { options: [...optsOf(i)] };
    nextOptions[i].options[optIndex] = val;
    const patch = { gapOptions: nextOptions.slice(0, gapCount) };
    // Nếu ô vừa sửa đang là đáp án đúng, cập nhật luôn answers[i] theo — tránh answers[i] lưu chữ
    // cũ trong khi lựa chọn đã đổi text.
    if (answers[i] === prevOptText) {
      const next = [...answers];
      while (next.length < gapCount) next.push("");
      next[i] = val;
      patch.answers = next.slice(0, gapCount);
    }
    onChange(patch);
  }

  if (mode === "choices") {
    return (
      <div className="admin-card-field-group">
        <strong>3 lựa chọn cho từng chỗ trống — chọn radio ở đáp án đúng</strong>
        {gapCount === 0 && (
          <p className="admin-hint">Bấm "+ Chèn chỗ trống tại vị trí con trỏ" trong ô đoạn văn ở trên để tạo chỗ trống.</p>
        )}
        {Array.from({ length: gapCount }).map((_, i) => (
          <fieldset className="admin-fieldset" key={i}>
            <legend>Chỗ trống {i + 1}</legend>
            {[0, 1, 2].map(optIndex => (
              <div className="admin-mc-option-row" key={optIndex}>
                <input
                  type="radio"
                  name={`gap-choice-${i}`}
                  checked={answers[i] === optsOf(i)[optIndex] && !!optsOf(i)[optIndex]}
                  onChange={() => setAnswer(i, optsOf(i)[optIndex] ?? "")}
                />
                <input
                  className="admin-input"
                  value={optsOf(i)[optIndex] ?? ""}
                  onChange={e => setOption(i, optIndex, e.target.value)}
                  placeholder={`Lựa chọn ${optIndex + 1}`}
                />
              </div>
            ))}
          </fieldset>
        ))}
      </div>
    );
  }

  return (
    <div className="admin-card-field-group">
      <strong>Đáp án từng chỗ trống</strong>
      {gapCount === 0 && (
        <p className="admin-hint">Bấm "+ Chèn chỗ trống tại vị trí con trỏ" trong ô đoạn văn ở trên để tạo chỗ trống.</p>
      )}
      {Array.from({ length: gapCount }).map((_, i) => (
        <label className="admin-mini-field" key={i}>
          <span>Chỗ trống {i + 1} (học sinh điền)</span>
          <input
            className="admin-input"
            value={answers[i] ?? ""}
            onChange={e => setAnswer(i, e.target.value)}
            placeholder="vd: kitchen"
          />
        </label>
      ))}
    </div>
  );
}

// Textarea đoạn văn gapfill + nút "Chèn chỗ trống" tại đúng vị trí con trỏ đang gõ, thay vì bắt
// giáo viên tự gõ tay 3 dấu "___" (dễ gõ sai số lượng gạch dưới, lệch với parser countGaps()).
function GapfillTextEditor({ value, onChange }) {
  const ref = useRef(null);

  function insertGap() {
    const el = ref.current;
    const text = value ?? "";
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    // Tự đánh số thứ tự chỗ trống — đếm số chỗ trống ĐÃ CÓ trong text để biết số tiếp theo, giáo
    // viên chỉ cần gõ nội dung, không cần tự gõ "(1)", "(2)"... như trước.
    const nextNumber = countGaps(text) + 1;
    const inserted = `(${nextNumber})___`;
    const next = text.slice(0, start) + inserted + text.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <label className="admin-mini-field">
      <span>Đoạn văn</span>
      <textarea
        ref={ref}
        className="admin-input admin-textarea"
        rows={4}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder="vd: You find a living room in a house. His living room is between the dining room and the kitchen."
      />
      <button type="button" className="admin-btn-secondary admin-gap-insert-btn" onClick={insertGap}>
        + Chèn chỗ trống (tự đánh số) tại vị trí con trỏ
      </button>
    </label>
  );
}

// Input câu hỏi ngắn + nút "Chèn chỗ trống" — KHÔNG đánh số thứ tự (khác GapfillTextEditor) vì
// mỗi câu Trả lời ngắn thường chỉ có đúng 1 chỗ trống, không cần phân biệt (1)/(2).
// showGapButton=false (Movers Part 1) — câu mô tả luôn có đúng 1 chỗ trống NGAY SAU câu (không cần
// chèn giữa câu như Starters), ShortAnswerQuestion ở ReadingRunner.jsx đã tự động thêm ô nhập ở
// cuối khi prompt không chứa "___" — khỏi cần giáo viên tự bấm chèn (yêu cầu người dùng 2026-08-26).
function ShortAnswerPromptEditor({ value, onChange, showGapButton = true }) {
  const ref = useRef(null);

  function insertGap() {
    const el = ref.current;
    const text = value ?? "";
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + "___" + text.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + 3;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <label className="admin-mini-field">
      <span>Câu hỏi</span>
      <input
        ref={ref}
        className="admin-input"
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder="vd: Where is the ball? on the"
      />
      {showGapButton && (
        <button type="button" className="admin-btn-secondary admin-gap-insert-btn" onClick={insertGap}>
          + Chèn chỗ trống tại vị trí con trỏ
        </button>
      )}
    </label>
  );
}

function QuestionEditor({ question, index, onChange, onDelete, onDuplicate, wordBank, partPointsActive, seriesId }) {
  const info = typeInfo(question.type);
  return (
    <div className="admin-reading-question-card">
      <div className="admin-reading-question-head">
        <span className="admin-reading-question-num">Question {index + 1}</span>
        <span className="admin-reading-question-type">{info?.icon} {info?.label}</span>
        {/* Movers/Flyers đã có ô "🏆 Điểm Part" chung cho cả Part (thanh tiêu đề Part) nên KHÔNG
            hiện điểm riêng từng câu nữa, dù giáo viên đã nhập điểm Part hay chưa (yêu cầu người
            dùng 2026-08-26: "tất cả các Part hiện đã có ô điểm rồi"). Series khác (Starters) vẫn
            theo cơ chế cũ — chỉ ẩn khi Part đó có bật điểm chung. */}
        {!(seriesId === "movers" || seriesId === "flyers" || partPointsActive) && (
          <label className="admin-reading-question-points">
            Điểm
            <input
              type="number"
              min={0}
              step={0.5}
              className="admin-input admin-points-input"
              value={question.points ?? 1}
              onChange={e => onChange({ points: Number(e.target.value) })}
            />
          </label>
        )}
        <div className="admin-reading-question-actions">
          <button type="button" className="admin-link-btn" onClick={onDuplicate}>Nhân bản</button>
          <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={onDelete}>Xoá</button>
        </div>
      </div>

      {question.type === "yesno" && (
        <>
          <ImageUploadField
            label="Ảnh minh hoạ"
            value={question.image}
            onChange={image => onChange({ image })}
          />
          <label className="admin-mini-field">
            <span>Câu hỏi / câu khẳng định</span>
            <input
              className="admin-input"
              value={question.text ?? ""}
              onChange={e => onChange({ text: e.target.value })}
              placeholder="vd: This is a handbag."
            />
          </label>
          <fieldset className="admin-fieldset">
            <legend>Đáp án đúng</legend>
            <div className="admin-yesno-picker">
              <label className="admin-checkbox-row">
                <input
                  type="radio"
                  name={`yesno-${index}`}
                  checked={question.answer === "yes"}
                  onChange={() => onChange({ answer: "yes" })}
                />
                <span>Yes</span>
              </label>
              <label className="admin-checkbox-row">
                <input
                  type="radio"
                  name={`yesno-${index}`}
                  checked={question.answer === "no"}
                  onChange={() => onChange({ answer: "no" })}
                />
                <span>No</span>
              </label>
            </div>
          </fieldset>
        </>
      )}

      {question.type === "gapfill" && (
        <>
          <ImageUploadField
            label="Ảnh minh hoạ"
            value={question.image}
            onChange={image => onChange({ image })}
          />
          <GapfillTextEditor value={question.text} onChange={text => onChange({ text })} />
          <label className="admin-mini-field">
            <span>Cách điền chỗ trống</span>
            <select
              className="admin-input"
              value={question.gapMode ?? "free"}
              onChange={e => onChange({ gapMode: e.target.value })}
            >
              <option value="free">Gõ tự do (như Starters)</option>
              <option value="choices">Bấm chọn 1 trong 3 lựa chọn (highlight khi chọn)</option>
            </select>
          </label>
          <GapfillAnswersEditor question={question} onChange={onChange} mode={question.gapMode === "choices" ? "choices" : "free"} />
          {countGaps(question.text || "") > 0 && (
            <p className="admin-hint">
              Tổng {questionPoints(question)} điểm chia đều cho {countGaps(question.text || "")} chỗ trống — mỗi chỗ:{" "}
              <strong>{gapPoints(question, countGaps(question.text || "")).toFixed(2).replace(/\.?0+$/, "")} điểm</strong>
            </p>
          )}
        </>
      )}

      {question.type === "short-answer" && (
        <>
          <ImageUploadField
            label="Ảnh minh hoạ (tuỳ chọn)"
            value={question.image}
            onChange={image => onChange({ image })}
          />
          <ShortAnswerPromptEditor
            value={question.prompt}
            onChange={prompt => onChange({ prompt })}
            showGapButton={seriesId !== "movers"}
          />
          <label className="admin-mini-field">
            <span>Đáp án (1 từ)</span>
            <input
              className="admin-input"
              value={question.answer ?? ""}
              onChange={e => onChange({ answer: e.target.value })}
              placeholder="vd: table"
            />
          </label>
        </>
      )}

      {question.type === "multiple-choice" && (
        <>
          <label className="admin-mini-field">
            <span>Câu hỏi</span>
            <input
              className="admin-input"
              value={question.text ?? ""}
              onChange={e => onChange({ text: e.target.value })}
              placeholder="vd: Now choose the best name for the story."
            />
          </label>
          <label className="admin-checkbox-row">
            <input
              type="checkbox"
              checked={!!question.hideLetters}
              onChange={e => onChange({ hideLetters: e.target.checked })}
            />
            <span>Ẩn nhãn A/B/C (tick chọn thường, vd câu chọn tiêu đề đúng)</span>
          </label>
          <fieldset className="admin-fieldset">
            <legend>Các đáp án — chọn radio ở đáp án đúng</legend>
            {(question.options ?? []).map((opt, i) => (
              <div className="admin-mc-option-row" key={i}>
                {!question.hideLetters && <span className="reading-mc-option-letter">{optionLetter(i)}</span>}
                <input
                  type="radio"
                  name={`mc-answer-${index}`}
                  checked={question.answerIndex === i}
                  onChange={() => onChange({ answerIndex: i })}
                />
                <input
                  className="admin-input"
                  value={opt}
                  onChange={e => {
                    const next = [...question.options];
                    next[i] = e.target.value;
                    onChange({ options: next });
                  }}
                  placeholder={`Đáp án ${i + 1}`}
                />
                <button
                  type="button"
                  className="admin-link-btn admin-pill-btn-danger"
                  disabled={(question.options ?? []).length <= 2}
                  onClick={() => {
                    const next = question.options.filter((_, idx) => idx !== i);
                    const answerIndex =
                      question.answerIndex === i ? 0 : question.answerIndex > i ? question.answerIndex - 1 : question.answerIndex;
                    onChange({ options: next, answerIndex });
                  }}
                >
                  Xoá
                </button>
              </div>
            ))}
            <button
              type="button"
              className="admin-link-btn"
              onClick={() => onChange({ options: [...(question.options ?? []), ""] })}
            >
              + Thêm đáp án
            </button>
          </fieldset>
        </>
      )}

      {question.type === "word-bank" && (
        <>
          <label className="admin-mini-field">
            <span>Câu mô tả</span>
            <input
              className="admin-input"
              value={question.text ?? ""}
              onChange={e => onChange({ text: e.target.value })}
              placeholder="vd: People wear costumes and act on a stage here and you can come and watch."
            />
          </label>
          <label className="admin-mini-field">
            <span>Đáp án đúng (chọn trong ngân hàng từ của Part)</span>
            <select
              className="admin-input"
              value={question.answer ?? ""}
              onChange={e => onChange({ answer: e.target.value })}
            >
              <option value="">— Chọn từ —</option>
              {(wordBank ?? []).map((w, i) => (
                <option key={i} value={bankLabel(w)}>{bankLabel(w) || `(từ ${i + 1} chưa nhập)`}</option>
              ))}
            </select>
          </label>
          {!wordBank?.length && (
            <p className="admin-hint">Chưa có ngân hàng từ — thêm từ ở khung "Ngân hàng từ dùng chung" phía trên trước.</p>
          )}
        </>
      )}

      {question.type === "word-scramble" && (
        <>
          <label className="admin-mini-field">
            <span>Nhập từ vựng</span>
            <input
              className="admin-input"
              value={question.answer ?? ""}
              onChange={e => onChange({ answer: e.target.value.replace(/\s/g, "").toUpperCase() })}
              placeholder="vd: APPLE"
            />
          </label>
          <ImageUploadField
            label="Ảnh minh hoạ từ vựng"
            value={question.image}
            onChange={image => onChange({ image })}
          />
        </>
      )}
    </div>
  );
}

function PartEditor({ part, onChange, seriesId }) {
  const confirm = useConfirm();
  const [pickerOpen, setPickerOpen] = useState(false);
  const questions = part.questions ?? [];
  // Part có `allowedTypes` (khung Flyers cố định) thì khoá menu chỉ còn đúng các dạng đó — Part chưa
  // gắn allowedTypes (Starters cũ, tự thêm Part tay) thì vẫn cho chọn tự do như trước.
  const availableTypes = part.allowedTypes
    ? questionTypesFor(seriesId).filter(t => part.allowedTypes.includes(t.type))
    : questionTypesFor(seriesId);
  const hasWordBankType = availableTypes.some(t => t.type === "word-bank");
  const hasMultipleChoiceType = availableTypes.some(t => t.type === "multiple-choice");
  function addQuestion(type) {
    onChange({ questions: [...questions, blankQuestion(type)] });
    setPickerOpen(false);
  }
  function updateQuestion(i, patch) {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    onChange({ questions: next });
  }
  async function deleteQuestion(i) {
    if (!(await confirm("Xoá câu hỏi này?", { danger: true }))) return;
    onChange({ questions: questions.filter((_, idx) => idx !== i) });
  }
  function duplicateQuestion(i) {
    const next = [...questions];
    next.splice(i + 1, 0, { ...questions[i] });
    onChange({ questions: next });
  }

  return (
    <div className="admin-reading-part-body">
      {/* Box xem trước ngân hàng từ NGAY ĐẦU Part — hiện bất kể checkbox bật/tắt, miễn đã có từ nào
          (giáo viên thấy trước đúng vị trí/hình dạng học sinh sẽ thấy — yêu cầu người dùng
          2026-08-26). */}
      {(part.wordBank?.length ?? 0) > 0 && <WordBankBox words={part.wordBank} />}

      <label className="admin-mini-field">
        <span>Tên Part</span>
        <input
          className="admin-input"
          value={part.title ?? ""}
          onChange={e => onChange({ title: e.target.value })}
        />
      </label>
      <label className="admin-mini-field">
        <span>Câu hướng dẫn</span>
        <input
          className="admin-input"
          value={part.instruction ?? ""}
          onChange={e => onChange({ instruction: e.target.value })}
          placeholder="vd: Look and read. Write yes or no."
        />
      </label>
      <ImageUploadField
        label="Ảnh minh hoạ chung cho cả Part (tuỳ chọn)"
        value={part.image}
        onChange={image => onChange({ image })}
      />
      {/* Ô nhập điểm chung cho cả Part đã chuyển lên thanh tiêu đề Part (xem admin-part-points-pill
          trong ReadingStudio component chính). */}

      {/* word-bank là TYPE câu hỏi (Part 1/2 — bắt buộc phải có bank để chấm điểm) thì luôn hiện
          sẵn form soạn, không cho tắt. Còn lại chỉ là ngân hàng từ THAM KHẢO (vd Part 3) — thêm
          checkbox bật/tắt, tick mới hiện form nhập, chưa tick chỉ là 1 dòng chữ gọn (yêu cầu người
          dùng 2026-08-26). */}
      {hasWordBankType ? (
        <>
          <WordBankEditor
            words={part.wordBank ?? []}
            onChange={wordBank => onChange({ wordBank })}
            withImages={!!part.wordBankImages}
          />
          <ExampleEditor example={part.example} wordBank={part.wordBank} mode="word-bank" onChange={example => onChange({ example })} />
        </>
      ) : (
        <>
          <label className="admin-checkbox-row">
            <input
              type="checkbox"
              checked={!!part.hasWordBank}
              onChange={e => onChange({ hasWordBank: e.target.checked })}
            />
            <span>🗂️ Dùng ngân hàng từ tham khảo cho Part này</span>
          </label>
          {part.hasWordBank && (
            <WordBankEditor
              words={part.wordBank ?? []}
              onChange={wordBank => onChange({ wordBank })}
              withImages={!!part.wordBankImages}
            />
          )}
        </>
      )}
      {/* Chỉ hiện Example dạng multiple-choice khi Part CHỈ CÓ đúng 1 dạng multiple-choice (vd
          Part 2 Movers/Flyers) — Part vừa gapfill vừa multiple-choice (vd Part 3, đoạn văn điền từ
          + câu chọn tiêu đề cuối) không có khái niệm "Example" tách riêng, "Example" ở đó chỉ là
          nhãn của khung ngân hàng từ tham khảo (đã hiện qua WordBankEditor phía trên). */}
      {hasMultipleChoiceType && !hasWordBankType && availableTypes.length === 1 && (
        <ExampleEditor example={part.example} mode="multiple-choice" onChange={example => onChange({ example })} />
      )}

      <div className="admin-reading-question-list">
        {questions.map((q, i) => (
          <QuestionEditor
            key={i}
            question={q}
            index={i}
            onChange={patch => updateQuestion(i, patch)}
            onDelete={() => deleteQuestion(i)}
            onDuplicate={() => duplicateQuestion(i)}
            wordBank={part.wordBank}
            partPointsActive={part.partPoints != null}
            seriesId={seriesId}
          />
        ))}
      </div>

      {availableTypes.length === 0 ? (
        <p className="admin-hint">Dạng câu hỏi của Part này chưa được lập trình xong, sẽ bổ sung sau.</p>
      ) : availableTypes.length === 1 ? (
        // Part chỉ có đúng 1 dạng được phép (khung Flyers cố định) — bấm là thêm luôn, không cần
        // hiện menu chọn dạng nữa (yêu cầu người dùng 2026-08-26: "ko chọn dạng câu hỏi nữa").
        <button type="button" className="admin-btn-secondary" onClick={() => addQuestion(availableTypes[0].type)}>
          + Thêm câu hỏi
        </button>
      ) : pickerOpen ? (
        <fieldset className="admin-fieldset">
          <legend>⚡ Chọn dạng câu hỏi</legend>
          <div className="studio-action-grid">
            {availableTypes.map(t => (
              <button
                key={t.type}
                type="button"
                className="admin-template-tile"
                onClick={() => addQuestion(t.type)}
              >
                <strong>{t.icon} {t.label}</strong>
                <span>{t.desc}</span>
              </button>
            ))}
          </div>
          <button type="button" className="admin-link-btn" onClick={() => setPickerOpen(false)}>Huỷ</button>
        </fieldset>
      ) : (
        <button type="button" className="admin-btn-secondary" onClick={() => setPickerOpen(true)}>
          + Thêm câu hỏi
        </button>
      )}
    </div>
  );
}

// Đếm tổng Part/câu/điểm của cả Test — mỗi chỗ trống gapfill tính là 1 câu riêng (khớp đúng cách
// ReadingRunner.jsx chấm điểm phía học sinh), điểm cộng dồn theo questionPoints() (khớp cách
// gapPoints() chia đều điểm gapfill), dùng cho khung "Thông tin chung" bên phải.
function testStats(parts) {
  let totalQuestions = 0;
  let totalPoints = 0;
  for (const part of parts) {
    const questions = part.questions ?? [];
    for (const q of questions) {
      totalQuestions += q.type === "gapfill" ? (q.answers?.length ?? 0) : 1;
    }
    // part.partPoints (nếu có) là tổng điểm CỐ ĐỊNH cho cả Part, bỏ qua điểm riêng từng câu —
    // khớp cách buildResults() ở ReadingRunner.jsx chấm điểm (xem effectiveQuestionPoints()).
    totalPoints += part.partPoints != null ? part.partPoints : questions.reduce((sum, q) => sum + questionPoints(q), 0);
  }
  return { totalParts: parts.length, totalQuestions, totalPoints };
}

// Xem trước 1 câu hỏi giống hệt cách học sinh sẽ thấy (SceneRunner/ReadingRunner) nhưng ở dạng
// tĩnh, không tương tác — cho giáo viên hình dung ngay khi đang gõ, không cần lưu rồi mới xem thử.
// Số "Question N." đánh liên tục xuyên suốt cả Test, KHÔNG reset theo từng Part (khớp ReadingRunner.jsx).
// Tách riêng component (thay vì nhánh if trong QuestionPreview) để dùng useMemo hợp lệ — xáo trộn
// GIỐNG HỆT thuật toán học sinh sẽ thấy (scrambleWord dùng chung từ ReadingRunner.jsx, không còn
// chữ nào đứng đúng vị trí gốc) thay vì hiện nguyên từ gốc như trước, để giáo viên xem trước đúng
// thực tế. Chữ xáo trộn đặt TRÊN ảnh minh hoạ (yêu cầu người dùng 2026-08-26), ô nhập PIN dưới ảnh.
function WordScramblePreview({ question, qNumber }) {
  const answer = question.answer ?? "";
  const scrambled = useMemo(() => scrambleWord(answer), [answer]);
  return (
    <div className="reading-question reading-question-preview">
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        <p className="reading-question-text">{question.text || WORD_SCRAMBLE_DEFAULT_TEXT}</p>
        {answer ? (
          <>
            <div className="reading-scramble-prompt">
              {scrambled.split("").map((c, i) => (
                <span key={i} className="reading-scramble-prompt-tile reading-scramble-tile-preview">{c}</span>
              ))}
            </div>
            {question.image && <img src={question.image} alt="" className="reading-question-img" />}
            <div className="reading-scramble-pin-row">
              {answer.split("").map((_, i) => (
                <span key={i} className="reading-scramble-pin-input" />
              ))}
            </div>
          </>
        ) : (
          <>
            {question.image && <img src={question.image} alt="" className="reading-question-img" />}
            <em>(chưa nhập từ vựng đáp án)</em>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionPreview({ question, qNumber }) {
  if (question.type === "yesno") {
    return (
      <div className="reading-question reading-question-preview">
        <QuestionBadge qNumber={qNumber} />
        <div className="reading-question-body">
          <p className="reading-question-text">{question.text || <em>(chưa nhập câu khẳng định)</em>}</p>
          {question.image && <img src={question.image} alt="" className="reading-question-img" />}
          <div className="reading-yesno-btns">
            <span className={`reading-yesno-btn${question.answer === "yes" ? " is-selected" : ""}`}>Yes</span>
            <span className={`reading-yesno-btn${question.answer === "no" ? " is-selected" : ""}`}>No</span>
          </div>
        </div>
      </div>
    );
  }
  if (question.type === "gapfill") {
    const segments = (question.text ?? "").split("___");
    return (
      <div className="reading-question reading-question-preview">
        <QuestionBadge qNumber={qNumber} />
        <div className="reading-question-body">
          {question.image && <img src={question.image} alt="" className="reading-question-img" />}
          <p className="reading-gapfill-text">
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              const numMatch = !isLast && seg.match(/(\(\d+\))\s*$/);
              const prefix = numMatch ? seg.slice(0, numMatch.index) : seg;
              const marker = numMatch ? numMatch[1] : "";
              const choices = !isLast && question.gapMode === "choices" ? question.gapOptions?.[i]?.options : null;
              return (
                <span key={i}>
                  {prefix}
                  {!isLast && (choices ? (
                    <span className="reading-gap-choices">
                      {marker}
                      {choices.map((opt, ci) => (
                        <span key={ci} className={`reading-gap-choice-btn${question.answers?.[i] === opt && opt ? " is-selected" : ""}`}>
                          {opt || `Lựa chọn ${ci + 1}`}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="reading-gap-nowrap">
                      {marker}
                      <span className="reading-gap-input reading-gap-input-preview" />
                    </span>
                  ))}
                </span>
              );
            })}
          </p>
        </div>
      </div>
    );
  }
  if (question.type === "word-scramble") {
    return <WordScramblePreview question={question} qNumber={qNumber} />;
  }
  if (question.type === "multiple-choice") {
    return (
      <div className="reading-question reading-question-preview">
        <QuestionBadge qNumber={qNumber} />
        <div className="reading-question-body">
          {question.text && <p className="reading-question-text">{question.text}</p>}
          <div className="reading-mc-options">
            {(question.options ?? []).map((opt, i) => (
              <span key={i} className={`reading-mc-option${question.answerIndex === i ? " is-selected" : ""}`}>
                {!question.hideLetters && <span className="reading-mc-option-letter">{optionLetter(i)}</span>}
                {opt || <em>(chưa nhập đáp án {i + 1})</em>}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (question.type === "word-bank") {
    return (
      <div className="reading-question reading-question-preview">
        <QuestionBadge qNumber={qNumber} />
        <div className="reading-question-body">
          <p className="reading-question-text">
            {question.text || <em>(chưa nhập câu mô tả)</em>}{" "}
            <span className="reading-gap-input reading-gap-input-preview" />
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="reading-question reading-question-preview">
      <QuestionBadge qNumber={qNumber} />
      <div className="reading-question-body">
        {question.image && <img src={question.image} alt="" className="reading-question-img" />}
        <p className="reading-question-text">
          {question.prompt ? (
            question.prompt.includes("___") ? (
              question.prompt.split("___").map((seg, i, arr) => (
                <span key={i}>{seg}{i < arr.length - 1 && <span className="reading-gap-input reading-gap-input-preview" />}</span>
              ))
            ) : (
              <>{question.prompt} <span className="reading-gap-input reading-gap-input-preview" /></>
            )
          ) : (
            <em>(chưa nhập câu hỏi)</em>
          )}
        </p>
      </div>
    </div>
  );
}

// Xem trước TOÀN BỘ Test (mọi Part, không chỉ Part đang mở soạn) — cuộn riêng trong panel này,
// để giáo viên xem được cả bài đang lên hình ra sao trong lúc soạn, giống hệt thứ tự học sinh
// sẽ thấy (numberOffset cộng dồn qua từng Part y hệt ReadingRunner.jsx).
function TestPreview({ parts, stats }) {
  let numberOffset = 0;

  return (
    <div className="admin-reading-preview-panel">
      <h3>Thông tin chung của bài tập</h3>
      <div className="admin-reading-preview-stats">
        <span>Tổng Part: <strong>{stats.totalParts}</strong></span>
        <span>Tổng số câu: <strong>{stats.totalQuestions}</strong></span>
        <span>Tổng điểm: <strong>{stats.totalPoints}</strong></span>
      </div>

      <h3>Xem trước toàn bộ bài</h3>
      {parts.length === 0 ? (
        <p className="admin-muted-text">Chưa có Part nào để xem trước.</p>
      ) : (
        parts.map((part, pi) => {
          const partOffset = numberOffset;
          numberOffset += part.questions?.length ?? 0;
          return (
            <div className="reading-part reading-part-preview" key={pi}>
              <div className="reading-part-head">
                <h2>{part.title || `Part ${pi + 1}`}</h2>
                {part.instruction && <p className="reading-part-instruction">{part.instruction}</p>}
                {part.image && <img src={part.image} alt="" className="reading-part-img" />}
                {part.caption && <p className="reading-part-caption">{part.caption}</p>}
              </div>
              <WordBankBox words={part.wordBank} />
              <ExampleRow example={part.example} mode={part.allowedTypes?.includes("multiple-choice") ? "multiple-choice" : "word-bank"} />
              {!part.questions?.length ? (
                <p className="admin-muted-text">Part này chưa có câu hỏi.</p>
              ) : (
                <div className="reading-question-list">
                  {part.questions.map((q, i) => (
                    <QuestionPreview key={i} question={q} qNumber={partOffset + i + 1} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// Màn soạn 1 Test Reading & Writing — cấu trúc 2 tầng: Test → nhiều Part → mỗi Part nhiều câu hỏi
// (3 loại). Bố cục 2 cột: form soạn bên trái, xem trước trực tiếp + thông tin chung bên phải —
// theo góp ý người dùng (quen mắt với bố cục CMS của YourHomework).
export default function ReadingStudio({ accent, seriesId, title, onTitleChange, parts, onPartsChange, onBack, onSave, saving, saved }) {
  const confirm = useConfirm();
  const [openPartIndex, setOpenPartIndex] = useState(parts.length ? 0 : null);
  // Movers/Flyers có sẵn khung Part cố định (SERIES_PART_TEMPLATES, số Part khớp đúng đề thật của
  // từng cấp) — giáo viên không tự thêm/xoá Part nữa, chỉ điền nội dung vào từng Part đã dựng sẵn
  // (yêu cầu người dùng 2026-08-26). Series khác (vd Starters) vẫn tự thêm/xoá Part như bình thường.
  const templates = SERIES_PART_TEMPLATES[seriesId];
  const hasFixedStructure = !!templates;

  function addPart() {
    const next = [...parts, blankPart(parts.length + 1)];
    onPartsChange(next);
    setOpenPartIndex(next.length - 1);
  }
  function createTemplateParts() {
    onPartsChange(blankPartsFromTemplates(templates));
    setOpenPartIndex(0);
  }
  // Mở 1 Test Movers/Flyers MỚI (chưa có Part nào) — tự tạo sẵn luôn khung Part mẫu, không bắt giáo
  // viên phải bấm nút "+ Tạo N Part chuẩn" thủ công nữa (yêu cầu người dùng 2026-08-26).
  useEffect(() => {
    if (!templates) return;
    if (parts.length === 0) {
      onPartsChange(blankPartsFromTemplates(templates));
      setOpenPartIndex(0);
      return;
    }
    // Vá dữ liệu Test đã tạo/lưu TRƯỚC KHI 1 Part nào đó được khoá `allowedTypes` trong code (vd
    // Part 2 Movers mới thêm sau — Test cũ đã lưu Part 2 nhưng thiếu allowedTypes, khiến menu chọn
    // dạng câu hỏi vẫn hiện ra dù mỗi Part sách thật chỉ có đúng 1 dạng cố định — yêu cầu người dùng
    // 2026-08-26: "mỗi sách Mover, Flyer có mỗi Part là 1 format cứng cố định"). Chỉ bổ sung
    // allowedTypes còn thiếu theo ĐÚNG VỊ TRÍ trong template, KHÔNG đụng vào title/instruction/
    // questions giáo viên đã nhập.
    // Vá tương tự cho hasWordBank/wordBankImages (vd Part 3 Movers mới thêm sau, đã lưu trước khi
    // có ngân hàng từ tham khảo kèm ảnh).
    function needsField(p, i, field) {
      return !p[field] && templates[i]?.[field];
    }
    // wordBankImages riêng: so KHÁC (không chỉ "còn thiếu") — vì đã từng bật true lúc test rồi đổi
    // ý bỏ ảnh (yêu cầu người dùng 2026-08-26: Part 3 Movers chỉ chữ như Part 1), cần ép về đúng giá
    // trị template kể cả khi Test cũ đang lưu true.
    function wordBankImagesMismatch(p, i) {
      return !!p.wordBankImages !== !!templates[i]?.wordBankImages;
    }
    const needsPatch = parts.some(
      (p, i) => needsField(p, i, "allowedTypes") || needsField(p, i, "hasWordBank") || wordBankImagesMismatch(p, i)
    );
    if (needsPatch) {
      onPartsChange(
        parts.map((p, i) => {
          const patch = {};
          if (needsField(p, i, "allowedTypes")) patch.allowedTypes = templates[i].allowedTypes;
          if (needsField(p, i, "hasWordBank")) patch.hasWordBank = templates[i].hasWordBank;
          if (wordBankImagesMismatch(p, i)) patch.wordBankImages = !!templates[i]?.wordBankImages;
          return Object.keys(patch).length ? { ...p, ...patch } : p;
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, parts.length]);
  function updatePart(i, patch) {
    const next = [...parts];
    next[i] = { ...next[i], ...patch };
    onPartsChange(next);
  }
  async function deletePart(i) {
    if (!(await confirm("Xoá Part này và toàn bộ câu hỏi bên trong?", { danger: true }))) return;
    const next = parts.filter((_, idx) => idx !== i);
    onPartsChange(next);
    if (openPartIndex === i) setOpenPartIndex(null);
    else if (openPartIndex !== null && i < openPartIndex) setOpenPartIndex(openPartIndex - 1);
  }

  async function handlePublish() {
    if (await confirm("Bài này sẽ hiển thị ngay trên website cho học sinh. Xuất bản?")) {
      onSave();
    }
  }

  return (
    <div className="studio-shell" style={accent ? { "--accent": accent } : undefined}>
      <div className="studio-topbar">
        <button className="admin-pill-btn" onClick={onBack}>← Quay lại</button>
        <input
          className="studio-title-input"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Tên Test"
        />
        <div className="studio-topbar-actions">
          {saved && <span className="admin-success">✓ Đã xuất bản</span>}
          <button className="admin-btn-primary" onClick={handlePublish} disabled={saving}>
            {saving ? "Đang xuất bản..." : "Xuất bản"}
          </button>
        </div>
      </div>

      <div className="admin-reading-studio-columns">
        <div className="admin-reading-parts">
          {parts.length === 0 && templates && (
            <div className="admin-empty-state">
              <span className="admin-empty-state-icon">📖</span>
              <p>
                Bấm bên dưới để tạo sẵn {templates.length === 1 ? "Part mẫu" : `khung ${templates.length} Part chuẩn`}, sau đó điền nội dung.
              </p>
              <button type="button" className="admin-btn-primary" onClick={createTemplateParts}>
                + Tạo {templates.length === 1 ? "Part mẫu" : `${templates.length} Part chuẩn`}
              </button>
            </div>
          )}
          {parts.length === 0 && !templates && (
            <div className="admin-empty-state">
              <span className="admin-empty-state-icon">📖</span>
              <p>Chưa có Part nào — bấm "Tạo Part mới" để bắt đầu soạn.</p>
            </div>
          )}
          {parts.map((part, i) => (
            <div key={i} className={`admin-reading-part${openPartIndex === i ? " is-open" : ""}`}>
              <div className="admin-reading-part-head" onClick={() => setOpenPartIndex(openPartIndex === i ? null : i)}>
                <span className="admin-reading-part-chevron" aria-hidden="true">{openPartIndex === i ? "▾" : "▸"}</span>
                <span className="admin-reading-part-title">{part.title || `Part ${i + 1}`}</span>
                <span className="admin-scene-count-badge">{part.questions?.length ?? 0} câu</span>
                <label className="admin-part-points-pill" onClick={e => e.stopPropagation()}>
                  <span className="admin-part-points-pill-icon" aria-hidden="true">🏆</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={part.partPoints ?? ""}
                    onChange={e => updatePart(i, { partPoints: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Điểm Part"
                    title="Điểm cho cả Part — chia đều cho các câu, bỏ qua điểm riêng từng câu. Để trống thì mỗi câu tự tính điểm riêng."
                  />
                </label>
                {!hasFixedStructure && (
                  <button
                    type="button"
                    className="admin-link-btn admin-pill-btn-danger"
                    onClick={e => { e.stopPropagation(); deletePart(i); }}
                  >
                    Xoá
                  </button>
                )}
              </div>
              {openPartIndex === i && (
                <PartEditor part={part} onChange={patch => updatePart(i, patch)} seriesId={seriesId} />
              )}
            </div>
          ))}
          {!hasFixedStructure && (
            <button type="button" className="admin-btn-secondary" onClick={addPart}>
              + Tạo Part mới
            </button>
          )}
        </div>

        <TestPreview parts={parts} stats={testStats(parts)} />
      </div>
    </div>
  );
}
