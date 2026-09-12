import { useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import OcrImportPanel from "./OcrImportPanel.jsx";
import IeltsPracticeRunner from "../IeltsPracticeRunner.jsx";
import { parseQuestionLines } from "../../lib/ocrParse.js";
import ImageUploadField from "./ImageUploadField.jsx";
import { normalizeBlankHolder, countBlanks, groupQuestionCount } from "../../lib/tableDiagramBlanks.js";

// Màn soạn 1 Passage của Test IELTS Reading (Test 1-4 → Passage 1-3, xem CreateLessonPage.jsx
// `IeltsReadingEditor`) — TÁCH THÀNH 2 TRANG RIÊNG theo yêu cầu người dùng (chốt 2026-09-11, đảo
// lại quyết định gộp cùng ngày trước đó): `ComprehensionPage` (bài đọc chia theo câu, đọc + dịch +
// từ vựng/từ đồng nghĩa, giống ComprehensionStudio cũ) và `LuyenDePage` (nhóm câu hỏi chấm điểm,
// đúng cách đề thi thật nhóm theo 1 hướng dẫn chung, vd "Questions 1-8: Complete the table
// below...", mỗi nhóm 1 trong 3 dạng: multiple-choice / tfng (True-False-Not Given) / short-answer
// (điền từ — dùng chung cho cả điền bảng lẫn điền sơ đồ, giáo viên mô tả vị trí ô trống ở `label`)).
// Cả 2 trang cùng ghi vào 1 passage trong `practiceTests/testN.passages[passageIndex]` (xem
// adminLessons.js `savePracticeTest`) — chỉ khác UI hiển thị/lưu riêng từng phần, dữ liệu Firestore
// không đổi cấu trúc. KHÔNG có nội dung mẫu nhúng sẵn — giáo viên tự gõ toàn bộ (xem CLAUDE.md mục
// 1, 7: không tự ý đưa nội dung sách có bản quyền vào code).
const GROUP_TYPES = [
  { key: "multiple-choice", label: "Trắc nghiệm" },
  { key: "tfng", label: "True / False / Not Given" },
  { key: "short-answer", label: "Điền từ" },
  { key: "table-diagram", label: "Bảng điền từ" },
  { key: "diagram", label: "Điền trên ảnh" },
  { key: "matching", label: "Ghép nối" },
];

function blankQuestion(type) {
  if (type === "multiple-choice") return { text: "", options: ["", "", "", ""], answerIndex: 0 };
  if (type === "tfng") return { text: "", answer: "TRUE" };
  return { label: "", acceptedAnswers: "" };
}

function blankMatchingItem() {
  return { label: "", isExample: false, answerKey: "" };
}

// Dán nguyên khối bài đọc → THAY THẾ toàn bộ danh sách câu hiện có, ĐƠN GIẢN NHẤT có thể (chốt
// 2026-09-12, bỏ hẳn thuật toán tự đoán ranh giới câu bằng regex .?! vì hay tách sai với số thập
// phân/viết tắt và khó đoán trước): mỗi dòng giáo viên gõ/dán (Enter xuống dòng) = 1 đoạn hiển thị
// y hệt trên web, giống gõ Word — KHÔNG tự động tách câu theo dấu chấm. Dòng trống chỉ dùng để nhìn
// cho dễ khi soạn, không tạo đoạn rỗng. Chỉ lấy text tiếng Anh, KHÔNG tự dịch/tự tìm từ vựng (giáo
// viên tự bổ sung sau, xem CLAUDE.md mục 7: không tự đưa nội dung có bản quyền vào code).
function parseBulkPassageText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  return lines.map((en, i) => ({ en, vi: "", vocab: [], newParagraph: i > 0 }));
}

// Dán nhanh nhiều câu trắc nghiệm cùng lúc — mỗi khối 5 dòng (dòng 1: câu hỏi, dòng 2-5: đáp án
// A-D), các câu cách nhau bằng 1 dòng trống, KHÔNG cần đánh số/đánh chữ cái (đúng format mau.txt).
// Đáp án đúng mặc định là A — giáo viên tự chọn lại đáp án thật sau khi dán.
function parseBulkMultipleChoiceText(text) {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocks.map(block => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    const [qText, ...opts] = lines;
    const options = opts.slice(0, 4);
    while (options.length < 4) options.push("");
    return { text: qText ?? "", options, answerIndex: 0 };
  }).filter(q => q.text);
}

// Nút "Dán nhanh" trắc nghiệm — mở ô textarea, dán khối 5 dòng/câu (câu hỏi + 4 đáp án, không đánh
// số/chữ cái), bấm Áp dụng để tách tự động, xem parseBulkMultipleChoiceText().
function BulkMcPaste({ onApply }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className="admin-ocr-panel">
      {open ? (
        <>
          <textarea
            className="admin-input admin-textarea"
            rows={6}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"Dán các câu, mỗi câu 5 dòng (câu hỏi + 4 đáp án), cách nhau 1 dòng trống"}
          />
          <div className="admin-practice-add-row">
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => {
                onApply(text);
                setText("");
                setOpen(false);
              }}
            >
              Áp dụng
            </button>
            <button type="button" className="admin-link-btn" onClick={() => { setOpen(false); setText(""); }}>Huỷ</button>
          </div>
        </>
      ) : (
        <button type="button" className="admin-btn-secondary" onClick={() => setOpen(true)}>📋 Dán nhanh (5 dòng/câu)</button>
      )}
    </div>
  );
}

function PassageTitleFields({ passage, onChange }) {
  function update(patch) {
    onChange({ ...passage, ...patch });
  }
  return (
    <div className="admin-practice-meta-row">
      <label className="admin-dictation-text-label">
        Tiêu đề passage (tiếng Anh)
        <input className="admin-input" value={passage.title} onChange={e => update({ title: e.target.value })} placeholder="vd: Sheet glass manufacture: the float process" />
      </label>
      <label className="admin-dictation-text-label">
        Tiêu đề passage (tiếng Việt, không bắt buộc)
        <input className="admin-input" value={passage.titleVi ?? ""} onChange={e => update({ titleVi: e.target.value })} placeholder="vd: Sản xuất kính tấm: quy trình nổi" />
      </label>
    </div>
  );
}

// sticky: dính cố định trên đầu khi cuộn trang dài (chốt 2026-09-12 — nút Preview đặt ở đây không
// còn bị cuộn mất như khi nằm rải rác theo từng nhóm câu hỏi). children (nếu có) render bên phải,
// vd nút "👁 Preview" ở LuyenDePage.
// Card chữ nhật to màu thương hiệu (accent truyền từ series.color) để chia rõ 2 khu vực soạn bài
// trong LuyenDePage: "Phần bài đọc" và "Phần câu hỏi" (chốt 2026-09-12).
function SectionBanner({ icon, children }) {
  return (
    <div className="admin-section-banner">
      {icon && <span className="admin-section-banner-icon">{icon}</span>}
      {children}
    </div>
  );
}

function PageHead({ label, onBack, sticky, children }) {
  return (
    <div className={`admin-dictation-head${sticky ? " admin-page-head-sticky" : ""}`}>
      <button type="button" className="admin-pill-btn" onClick={onBack}>← Quay lại danh sách Test</button>
      <span className="admin-practice-page-label">{label}</span>
      {children}
    </div>
  );
}

function SaveFooter({ onSave, saving, saved }) {
  return (
    <div className="admin-dictation-footer">
      <button className="admin-btn-primary" type="button" onClick={onSave} disabled={saving}>
        {saving ? "Đang lưu..." : "Xuất bản"}
      </button>
      {saved && <p className="admin-success">✓ Đã lưu</p>}
    </div>
  );
}

// Trang "Đọc hiểu" — chỉ soạn bài đọc chia theo câu (đọc + dịch + từ vựng) của 1 passage.
export function ComprehensionPage({ accent, testLabel, passage, onPassageChange, onBack, onSave, saving, saved }) {
  const confirm = useConfirm();
  const [bulkText, setBulkText] = useState("");

  function update(patch) {
    onPassageChange({ ...passage, ...patch });
  }

  async function applyBulkText() {
    const sentences = parseBulkPassageText(bulkText);
    if (!sentences.length) return;
    if ((passage.sentences ?? []).length > 0) {
      if (!(await confirm(`Thay toàn bộ ${passage.sentences.length} đoạn hiện có bằng ${sentences.length} đoạn vừa nhập?`, { danger: true }))) return;
    }
    update({ sentences });
    setBulkText("");
  }

  // Chặn Xuất bản khi còn text vừa dán chưa bấm "Áp dụng đoạn văn" — nếu không, `passage.sentences`
  // (dữ liệu THẬT được lưu) vẫn rỗng dù ô dán nhìn như đã có nội dung, khiến bài đọc hiện trống
  // trơn phía học sinh (lỗi thực tế đã gặp 2026-09-12).
  function handleSaveClick() {
    if (bulkText.trim()) {
      alert('Bạn vừa dán đoạn văn nhưng chưa bấm "Áp dụng đoạn văn" — bấm nút đó trước để nội dung được lưu vào bài đọc, rồi Xuất bản lại.');
      return;
    }
    onSave();
  }

  function addSentence() {
    update({ sentences: [...(passage.sentences ?? []), { en: "", vi: "", vocab: [] }] });
  }
  function updateSentence(i, patch) {
    const sentences = passage.sentences.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    update({ sentences });
  }
  async function removeSentence(i) {
    if (!(await confirm("Xoá câu này?", { danger: true }))) return;
    update({ sentences: passage.sentences.filter((_, idx) => idx !== i) });
  }
  function addVocab(i) {
    updateSentence(i, { vocab: [...(passage.sentences[i].vocab ?? []), { termDef: "", meaning: "" }] });
  }
  function updateVocab(i, vi, patch) {
    const vocab = passage.sentences[i].vocab.map((v, idx) => (idx === vi ? { ...v, ...patch } : v));
    updateSentence(i, { vocab });
  }
  function removeVocab(i, vi) {
    updateSentence(i, { vocab: passage.sentences[i].vocab.filter((_, idx) => idx !== vi) });
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead label={`${testLabel} — Đọc hiểu`} onBack={onBack} />
      <PassageTitleFields passage={passage} onChange={onPassageChange} />

      <div className="admin-practice-bulk-paste">
        <span className="admin-upload-label">Dán bài đọc (mỗi dòng = 1 đoạn)</span>
        <textarea
          className="admin-input admin-textarea"
          rows={6}
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={"Glass, which has been made since the time of the Mesopotamians and Egyptians...\nNevertheless, demand for flat glass was very high..."}
        />
        <button type="button" className="admin-link-btn" disabled={!bulkText.trim()} onClick={applyBulkText}>Áp dụng đoạn văn</button>
      </div>

      <span className="admin-upload-label">Bài đọc</span>
      <ol className="admin-scene-list">
        {(passage.sentences ?? []).map((s, i) => (
          <li className="admin-scene-list-item admin-dictation-row" key={i}>
            <span className="admin-scene-list-index">{i + 1}</span>
            <div className="admin-dictation-row-fields">
              <label className="admin-dictation-text-label">
                Câu tiếng Anh (đặt **chữ** để in đậm, vd tiêu đề phụ "Bad behaviour")
                <textarea
                  className="admin-input admin-textarea"
                  rows={2}
                  value={s.en}
                  onChange={e => updateSentence(i, { en: e.target.value })}
                  placeholder="vd: Glass, which has been made since... hoặc **Bad behaviour**"
                />
              </label>
              <label className="admin-dictation-text-label">
                Bản dịch tiếng Việt
                <textarea
                  className="admin-input admin-textarea"
                  rows={2}
                  value={s.vi}
                  onChange={e => updateSentence(i, { vi: e.target.value })}
                  placeholder="vd: Thủy tinh, vốn đã được sản xuất..."
                />
              </label>
              {i > 0 && (
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!s.newParagraph}
                    onChange={e => updateSentence(i, { newParagraph: e.target.checked })}
                  />
                  Câu này bắt đầu đoạn văn mới (xuống dòng trước câu này khi hiển thị)
                </label>
              )}
              <div className="admin-comprehension-vocab-box">
                <span className="admin-upload-label">Từ vựng + từ đồng nghĩa trong câu này</span>
                {(s.vocab ?? []).map((v, vi) => (
                  <div className="admin-comprehension-vocab-row" key={vi}>
                    <input
                      className="admin-input"
                      value={v.termDef}
                      onChange={e => updateVocab(i, vi, { termDef: e.target.value })}
                      placeholder="vd: mixture = combination / blend"
                    />
                    <input
                      className="admin-input"
                      value={v.meaning}
                      onChange={e => updateVocab(i, vi, { meaning: e.target.value })}
                      placeholder="vd: hỗn hợp"
                    />
                    <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeVocab(i, vi)}>Xoá</button>
                  </div>
                ))}
                <button type="button" className="admin-btn-secondary admin-comprehension-add-vocab" onClick={() => addVocab(i)}>+ Thêm từ vựng</button>
              </div>
            </div>
            <div className="admin-scene-list-actions">
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeSentence(i)}>Xoá câu</button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="admin-btn-secondary" onClick={addSentence}>+ Thêm câu</button>

      <SaveFooter onSave={handleSaveClick} saving={saving} saved={saved} />
    </div>
  );
}

// Word bank nhập nhanh — mỗi dòng 1 mục "chữ cái + khoảng trắng/Tab + từ" (vd "A cloud-zappers"),
// gõ/dán xong là tự tách luôn, không cần click "+ Thêm mục" từng dòng như OptionsListEditor cũ.
// Giữ state text CỤC BỘ (không đọc lại từ props mỗi lần gõ) để con trỏ không bị nhảy khi component
// cha re-render theo onChange.
function WordBankBulkEditor({ options, onChange }) {
  const [text, setText] = useState(() => (options ?? []).map(o => `${o.key}\t${o.text}`).join("\n"));
  function handleChange(value) {
    setText(value);
    const parsed = value
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const m = line.match(/^(\S+)\s+(.*)$/);
        return m ? { key: m[1], text: m[2] } : { key: line, text: "" };
      });
    onChange(parsed);
  }
  return (
    <textarea
      className="admin-input admin-textarea"
      rows={9}
      value={text}
      onChange={e => handleChange(e.target.value)}
      placeholder={"Mỗi dòng 1 mục: chữ cái + khoảng trắng/Tab + từ, vd:\nA\tcloud-zappers\nB\tatoms\nC\tstorm clouds"}
    />
  );
}

// Soạn "danh sách đáp án dùng chung" (List of Headings, word bank, danh sách phân loại A/B/C...) —
// dùng lại ở cả TableDiagramEditor (word bank chỉ để tham khảo, không chấm điểm) và MatchingEditor
// (đáp án học sinh thực sự chọn, có chấm điểm).
function OptionsListEditor({ options, onChange, keyPlaceholder = "vd: i / A", textPlaceholder = "vd: Predicting climatic changes" }) {
  const confirm = useConfirm();
  function updateOption(oi, patch) {
    onChange(options.map((o, idx) => (idx === oi ? { ...o, ...patch } : o)));
  }
  function addOption() {
    onChange([...options, { key: "", text: "" }]);
  }
  async function removeOption(oi) {
    if (!(await confirm("Xoá mục này khỏi danh sách?", { danger: true }))) return;
    onChange(options.filter((_, idx) => idx !== oi));
  }
  return (
    <div className="admin-options-list">
      {options.map((o, oi) => (
        <div className="admin-options-list-row" key={oi}>
          <input className="admin-input admin-options-key" value={o.key} onChange={e => updateOption(oi, { key: e.target.value })} placeholder={keyPlaceholder} />
          <input className="admin-input" value={o.text} onChange={e => updateOption(oi, { text: e.target.value })} placeholder={textPlaceholder} />
          <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeOption(oi)}>Xoá</button>
        </div>
      ))}
      <button type="button" className="admin-btn-secondary" onClick={addOption}>+ Thêm mục</button>
    </div>
  );
}

// Soạn 1 ô/đoạn văn có thể chứa chỗ trống — giáo viên gõ text bình thường, đánh dấu chỗ trống bằng
// "___" (3 dấu gạch dưới liền nhau), KHÔNG cần biết/gõ số thứ tự (chốt 2026-09-12, thay hẳn cơ chế
// gõ tay token {{n}} + phím tắt Tab cũ — dễ gây lệch số khi thêm/xoá, đã sửa đi sửa lại nhiều lần
// vẫn còn rối). Ngay khi phát hiện "___" trong text, tự hiện thêm 1 ô nhập đáp án riêng ngay bên
// dưới (đủ theo đúng số lượng "___" tìm thấy) — đáp án lưu NGAY TRONG ô đó nên không thể lệch số
// với ô khác. Số thứ tự THẬT hiển thị cho học sinh do hệ thống tự tính (xem lib/tableDiagramBlanks.js
// `deriveTableDiagramBlanks`), giáo viên không cần quan tâm.
// numberBase: số câu hỏi đứng TRƯỚC ô/đoạn văn này (cộng dồn từ đầu passage) — mỗi chỗ trống trong
// ô này sẽ hiện đúng số thật "Question N" (numberBase + thứ tự trong ô + 1) hệt như học sinh sẽ
// thấy, để giáo viên biết chắc đang nhập đáp án cho đúng câu nào (chốt 2026-09-12).
function BlankHolderEditor({ value, onChange, rows = 2, placeholder, numberBase = 0 }) {
  const holder = normalizeBlankHolder(value);
  const n = countBlanks(holder.text);
  function handleTextChange(text) {
    const answers = [...holder.answers];
    const need = countBlanks(text);
    while (answers.length < need) answers.push("");
    while (answers.length > need) answers.pop();
    onChange({ text, answers });
  }
  function handleAnswerChange(k, val) {
    const answers = [...holder.answers];
    answers[k] = val;
    onChange({ text: holder.text, answers });
  }
  return (
    <div className="admin-blank-holder">
      <textarea
        className="admin-input admin-textarea"
        rows={rows}
        value={holder.text}
        onChange={e => handleTextChange(e.target.value)}
        placeholder={placeholder}
      />
      {n > 0 && (
        <div className="admin-blank-holder-answers">
          {Array.from({ length: n }, (_, k) => (
            <label className="admin-blank-answer-row" key={k}>
              <span className="admin-blank-answer-qnum">Question {numberBase + k + 1}</span>
              <input
                className="admin-input admin-blank-answer-input"
                value={holder.answers[k] ?? ""}
                onChange={e => handleAnswerChange(k, e.target.value)}
                placeholder="Đáp án đúng — nhiều đáp án cách nhau bằng |"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Soạn 1 nhóm "Bảng / sơ đồ điền từ" — dựng lại bảng HTML thật (giống 100% bảng trong sách) + ảnh
// sơ đồ (giáo viên tự cắt/upload) với các ô input đặt đè theo toạ độ %/% do giáo viên nhập. Không
// còn danh sách "Chỗ trống & đáp án" tách rời — đáp án nhập ngay dưới từng ô/đoạn văn qua
// `BlankHolderEditor`, xem comment ở trên.
// CHỈ còn phần Bảng (chốt 2026-09-12 theo yêu cầu người dùng — bỏ tạm đoạn văn/word bank/sơ đồ
// khỏi màn soạn để gọn, có thể thêm lại sau dưới dạng nhóm câu hỏi riêng nếu cần, vd 1 nhóm
// "table-diagram" khác chỉ dùng phần sơ đồ, đứng NGAY SAU nhóm bảng — số câu vẫn tự nối tiếp đúng
// vì đánh số cộng dồn theo toàn bộ nhóm trong passage, không phụ thuộc việc dồn vào 1 nhóm hay
// nhiều nhóm). Dữ liệu `paragraphs`/`optionsList`/`diagramImage`/`diagramPoints` trong group vẫn
// được giữ nguyên nếu đã có sẵn (không xoá), chỉ ẩn UI chỉnh sửa.
function TableDiagramEditor({ group, onChange, startNumber = 0 }) {
  const confirm = useConfirm();
  // Luôn để sẵn ít nhất 1 ô đoạn văn (khỏi phải bấm "+ Thêm đoạn văn" trước khi gõ được) — kể cả bài
  // cũ lưu trước khi có cơ chế này (paragraphs rỗng).
  const paragraphs = (group.paragraphs ?? []).length > 0 ? group.paragraphs : [""];
  // Đoạn văn đánh số liên tục từ đầu nhóm (chốt 2026-09-12: bỏ hẳn phần Bảng khỏi CMS theo yêu cầu
  // người dùng — dữ liệu `table`/`tableTitle` cũ (nếu có từ trước) vẫn giữ nguyên trong Firestore,
  // không xoá, chỉ ẩn UI chỉnh sửa vì không còn dùng tới).
  let runningCount = startNumber;
  const paragraphNumberBases = paragraphs.map(p => {
    const base = runningCount;
    runningCount += countBlanks(normalizeBlankHolder(p).text);
    return base;
  });

  function updateParagraph(pi, value) {
    onChange({ paragraphs: paragraphs.map((p, idx) => (idx === pi ? value : p)) });
  }
  function addParagraph() {
    onChange({ paragraphs: [...paragraphs, ""] });
  }
  async function removeParagraph(pi) {
    if (!(await confirm("Xoá đoạn văn này?", { danger: true }))) return;
    onChange({ paragraphs: paragraphs.filter((_, idx) => idx !== pi) });
  }

  return (
    <div className="admin-table-diagram-editor">
      <div className="admin-table-editor">
        <span className="admin-upload-label">Đoạn văn tóm tắt — gõ &quot;___&quot; (3 dấu gạch dưới) ở chỗ cần trống</span>
        {paragraphs.map((p, pi) => (
          <div className="admin-practice-question-row admin-paragraph-row" key={pi}>
            <BlankHolderEditor
              value={p}
              onChange={next => updateParagraph(pi, next)}
              rows={8}
              placeholder="vd: In this method, a laser is used to create a line of ionisation by removing electrons from ___ ."
              numberBase={paragraphNumberBases[pi]}
            />
            <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeParagraph(pi)}>Xoá</button>
          </div>
        ))}
        <button type="button" className="admin-btn-secondary" onClick={addParagraph}>+ Thêm đoạn văn</button>
      </div>

      <div className="admin-table-editor">
        <span className="admin-upload-label">Word bank — danh sách từ cho sẵn để học sinh chọn chữ cái (không bắt buộc)</span>
        <WordBankBulkEditor
          options={group.optionsList ?? []}
          onChange={optionsList => onChange({ optionsList })}
        />
      </div>
    </div>
  );
}

// Soạn 1 nhóm "Điền trên ảnh" (chốt 2026-09-12, ĐƠN GIẢN HOÁ lần 2 — bỏ hẳn cơ chế đặt điểm theo
// toạ độ %/% vì ảnh giáo viên upload đã tự in sẵn số thứ tự (6, 7, 8...) ngay trong ảnh, không cần
// hệ thống chồng số lên nữa): chỉ còn ảnh + danh sách ô đáp án đánh số bên dưới, giáo viên tự
// thêm/bớt đúng bằng số ô trống có trong ảnh, số hiển thị (Question N) tự khớp với số đã in trong
// ảnh nếu giáo viên thêm đúng thứ tự.
function DiagramEditor({ group, onChange, startNumber = 0 }) {
  const confirm = useConfirm();
  const diagramPoints = group.diagramPoints ?? [];

  function addPoint() {
    onChange({ diagramPoints: [...diagramPoints, { answer: "" }] });
  }
  function updatePoint(pi, patch) {
    onChange({ diagramPoints: diagramPoints.map((p, idx) => (idx === pi ? { ...p, ...patch } : p)) });
  }
  async function removePoint(pi) {
    if (!(await confirm("Xoá ô đáp án này?", { danger: true }))) return;
    onChange({ diagramPoints: diagramPoints.filter((_, idx) => idx !== pi) });
  }

  return (
    <div className="admin-table-diagram-editor">
      <div className="admin-diagram-editor">
        <input
          className="admin-input"
          value={group.diagramTitle ?? ""}
          onChange={e => onChange({ diagramTitle: e.target.value })}
          placeholder="Tiêu đề ảnh, vd: Pilkington's float process (không bắt buộc)"
        />
        <ImageUploadField
          label="Ảnh (số thứ tự đã in sẵn trong ảnh)"
          value={group.diagramImage}
          onChange={url => onChange({ diagramImage: url })}
        />
        <span className="admin-upload-label">Ô đáp án — thêm/bớt đúng bằng số chỗ trống có trong ảnh</span>
        {diagramPoints.map((p, pi) => (
          <div className="admin-diagram-point-row" key={pi}>
            <span className="admin-blank-answer-qnum">Question {startNumber + pi + 1}</span>
            <input
              className="admin-input"
              value={p.answer ?? ""}
              onChange={e => updatePoint(pi, { answer: e.target.value })}
              placeholder="Đáp án đúng — nhiều đáp án cách nhau bằng |"
            />
            <button type="button" className="admin-row-delete-btn" onClick={() => removePoint(pi)} title="Xoá ô đáp án" aria-label="Xoá ô đáp án">🗑</button>
          </div>
        ))}
        <button type="button" className="admin-btn-secondary" onClick={addPoint}>+ Thêm ô đáp án</button>
      </div>
    </div>
  );
}

// Soạn 1 nhóm "Ghép nối theo danh sách chung" — dùng chung cho Matching Headings (chọn tiêu đề i-ix
// cho từng đoạn A-F) VÀ Classify/phân loại (chọn A/B/C cho từng câu) vì bản chất giống nhau: 1 danh
// sách đáp án dùng chung (`optionsList`, hiện trong hộp có viền nếu `boxed`, có `optionsTitle` như
// "List of Headings") + danh sách mục cần ghép (`items`), mỗi mục hoặc là "Ví dụ" (`isExample`, chỉ
// hiển thị đáp án mẫu, KHÔNG chấm điểm — đúng như sách hay cho sẵn 1-2 câu mẫu) hoặc là câu hỏi thật
// (chấm điểm, học sinh chọn đáp án trong `optionsList` bằng dropdown). `questions` được TỰ SINH lại
// từ `items` (lọc bỏ example) mỗi khi sửa — KHÔNG tự gõ tay, để khớp đúng thứ tự với hệ thống đánh số
// câu hỏi xuyên suốt Test (`flattenQuestions` trong IeltsPracticeRunner.jsx đọc `group.questions`).
function MatchingEditor({ group, onChange }) {
  const confirm = useConfirm();
  const items = group.items ?? [];

  function commitItems(nextItems) {
    const questions = nextItems.filter(it => !it.isExample).map(it => ({ label: it.label, acceptedAnswers: it.answerKey }));
    onChange({ items: nextItems, questions });
  }
  function updateItem(ii, patch) {
    commitItems(items.map((it, idx) => (idx === ii ? { ...it, ...patch } : it)));
  }
  function addItem() {
    commitItems([...items, blankMatchingItem()]);
  }
  async function removeItem(ii) {
    if (!(await confirm("Xoá mục này?", { danger: true }))) return;
    commitItems(items.filter((_, idx) => idx !== ii));
  }

  return (
    <div className="admin-matching-editor">
      <div className="admin-wordbank-editor">
        <span className="admin-upload-label">Danh sách đáp án dùng chung</span>
        <label className="admin-dictation-text-label">
          Tiêu đề hộp
          <input className="admin-input" value={group.optionsTitle ?? ""} onChange={e => onChange({ optionsTitle: e.target.value })} placeholder="vd: List of Headings" />
        </label>
        <label className="admin-checkbox-row">
          <input type="checkbox" checked={group.boxed !== false} onChange={e => onChange({ boxed: e.target.checked })} />
          Hiện trong khung có viền
        </label>
        <OptionsListEditor options={group.optionsList ?? []} onChange={optionsList => onChange({ optionsList })} keyPlaceholder="vd: i / A" textPlaceholder="vd: Predicting climatic changes" />
      </div>

      <div className="admin-matching-items">
        <span className="admin-upload-label admin-practice-groups-label">Danh sách mục cần ghép</span>
        {items.map((it, ii) => (
          <div className="admin-practice-question-row" key={ii}>
            <span className="admin-scene-list-index">{ii + 1}</span>
            <div className="admin-dictation-row-fields">
              <input className="admin-input" value={it.label} onChange={e => updateItem(ii, { label: e.target.value })} placeholder="vd: Paragraph B / Many Europeans started farming abroad." />
              <label className="admin-checkbox-row">
                <input type="checkbox" checked={!!it.isExample} onChange={e => updateItem(ii, { isExample: e.target.checked })} />
                Câu Ví dụ (không chấm điểm)
              </label>
              <input
                className="admin-input"
                value={it.answerKey}
                onChange={e => updateItem(ii, { answerKey: e.target.value })}
                placeholder={it.isExample ? "Đáp án mẫu hiện luôn cho học sinh xem, vd: viii" : "Đáp án đúng (khớp với 1 mục trong danh sách ở trên, vd: iii)"}
              />
            </div>
            <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeItem(ii)}>Xoá</button>
          </div>
        ))}
        <button type="button" className="admin-btn-secondary" onClick={addItem}>+ Thêm mục</button>
      </div>
    </div>
  );
}

// Trang "Luyện đề" — cấu hình Test (tên/thời gian/số lượt) + nhóm câu hỏi chấm điểm của 1 passage.
export function LuyenDePage({
  accent,
  testLabel,
  title,
  onTitleChange,
  timeLimitMinutes,
  onTimeLimitChange,
  maxAttempts,
  onMaxAttemptsChange,
  passage,
  onPassageChange,
  onBack,
  onSave,
  saving,
  saved,
}) {
  const confirm = useConfirm();
  // true = đang mở overlay Preview (xem toàn bộ nhóm câu hỏi của passage) — xem nút "👁 Preview"
  // cố định trên đầu trang (PageHead, chốt 2026-09-12 để không bị cuộn mất theo từng nhóm).
  const [previewOpen, setPreviewOpen] = useState(false);
  // Khởi tạo từ passage.sentences hiện có (nếu đã soạn/lưu trước đó) để mở lại Test là thấy ngay nội
  // dung đã có, sửa tiếp được luôn — không cần bước "Áp dụng" riêng nữa (chốt 2026-09-12 theo yêu
  // cầu người dùng: dán/sửa xong bấm Xuất bản là lưu thẳng, khỏi phải nhớ bấm nút trung gian).
  const [bulkText, setBulkText] = useState(() => (passage.sentences ?? []).map(s => s.en).join("\n"));

  function update(patch) {
    onPassageChange({ ...passage, ...patch });
  }

  function addGroup() {
    update({ groups: [...(passage.groups ?? []), { instruction: "", type: "multiple-choice", questions: [blankQuestion("multiple-choice")] }] });
  }
  function updateGroup(gi, patch) {
    const groups = passage.groups.map((g, idx) => (idx === gi ? { ...g, ...patch } : g));
    update({ groups });
  }
  function changeGroupType(gi, type) {
    const patch = { type, questions: [blankQuestion(type)] };
    if (type === "table-diagram") {
      patch.paragraphs = [""];
      patch.diagramImage = "";
      patch.diagramPoints = [];
      patch.optionsList = [];
      patch.optionsTitle = "";
      // Không dùng `questions` cho dạng này nữa — chỗ trống + đáp án được tính tự động từ "___" gõ
      // trực tiếp trong bảng/đoạn văn/sơ đồ (xem lib/tableDiagramBlanks.js), giữ field rỗng cho gọn.
      patch.questions = [];
    }
    if (type === "diagram") {
      patch.diagramImage = "";
      patch.diagramTitle = "";
      patch.diagramPoints = [];
      patch.questions = [];
    }
    if (type === "matching") {
      patch.optionsList = [];
      patch.optionsTitle = "";
      patch.boxed = true;
      patch.items = [];
      patch.questions = [];
    }
    updateGroup(gi, patch);
  }
  async function removeGroup(gi) {
    if (!(await confirm("Xoá nhóm câu hỏi này?", { danger: true }))) return;
    update({ groups: passage.groups.filter((_, idx) => idx !== gi) });
  }

  // Đổi bộ nhãn True/False/Not Given <-> Yes/No/Not Given — tự đổi luôn đáp án ĐÃ chọn của từng câu
  // (TRUE->YES, FALSE->NO và ngược lại) để không bị lệch đáp án khi đổi qua lại, NOT GIVEN giữ nguyên.
  function changeTfngScheme(gi, scheme) {
    const g = passage.groups[gi];
    const map = scheme === "YNNG" ? { TRUE: "YES", FALSE: "NO" } : { YES: "TRUE", NO: "FALSE" };
    const questions = g.questions.map(q => ({ ...q, answer: map[q.answer] ?? q.answer }));
    updateGroup(gi, { tfngScheme: scheme, questions });
  }

  // Gộp thẳng nội dung ô dán thành passage.sentences NGAY LÚC XUẤT BẢN — không cần bấm nút "Áp
  // dụng" riêng nữa. Truyền passage mới cho onSave (thay vì gọi onPassageChange rồi onSave riêng)
  // để tránh việc onSave đọc phải state `passages` cũ chưa kịp cập nhật (setState là bất đồng bộ).
  function handleSaveClick() {
    const nextPassage = { ...passage, sentences: parseBulkPassageText(bulkText) };
    onSave(nextPassage);
  }

  function addQuestion(gi) {
    const g = passage.groups[gi];
    updateGroup(gi, { questions: [...g.questions, blankQuestion(g.type)] });
  }
  function updateQuestion(gi, qi, patch) {
    const g = passage.groups[gi];
    const questions = g.questions.map((q, idx) => (idx === qi ? { ...q, ...patch } : q));
    updateGroup(gi, { questions });
  }
  async function removeQuestion(gi, qi) {
    if (!(await confirm("Xoá câu hỏi này?", { danger: true }))) return;
    const g = passage.groups[gi];
    updateGroup(gi, { questions: g.questions.filter((_, idx) => idx !== qi) });
  }
  // OCR ảnh chụp trang câu hỏi → tách theo số thứ tự + lựa chọn A/B/C/D (nếu có), GỘP THÊM vào
  // cuối danh sách câu hỏi của nhóm này. Chỉ tự điền được NỘI DUNG câu hỏi/lựa chọn — đáp án đúng
  // (TRUE/FALSE/NOT GIVEN, đáp án trắc nghiệm, từ điền đúng) OCR không biết, giáo viên phải tự
  // chọn/gõ lại theo đúng đáp án thật trong sách trước khi Xuất bản.
  function handleOcrQuestions(gi, text) {
    const g = passage.groups[gi];
    const parsed = parseQuestionLines(text);
    if (!parsed.length) return;
    const newQuestions = parsed.map(item => {
      if (g.type === "multiple-choice") {
        const options = [...item.options];
        while (options.length < 4) options.push("");
        return { text: item.text, options: options.slice(0, 4), answerIndex: 0 };
      }
      if (g.type === "tfng") return { text: item.text, answer: "TRUE" };
      return { label: item.text, acceptedAnswers: "" };
    });
    updateGroup(gi, { questions: [...g.questions, ...newQuestions] });
  }

  // Dán nhanh trắc nghiệm: mỗi khối 5 dòng (câu hỏi + 4 đáp án, không đánh số/chữ cái), cách nhau
  // 1 dòng trống — GỘP THÊM vào cuối danh sách câu hỏi của nhóm (giống handleOcrQuestions).
  function handleBulkMultipleChoice(gi, text) {
    const g = passage.groups[gi];
    const newQuestions = parseBulkMultipleChoiceText(text);
    if (!newQuestions.length) return;
    updateGroup(gi, { questions: [...g.questions, ...newQuestions] });
  }

  return (
    <div className="admin-card" style={{ "--accent": accent }}>
      <PageHead label={`${testLabel} — Luyện đề`} onBack={onBack} sticky>
        <button type="button" className="admin-pill-btn admin-preview-trigger" onClick={() => setPreviewOpen(true)}>👁 Preview</button>
        <button type="button" className="admin-btn-primary admin-page-head-save" onClick={handleSaveClick} disabled={saving}>
          {saving ? "Đang lưu..." : "Xuất bản"}
        </button>
        {saved && <span className="admin-success admin-page-head-saved">✓ Đã lưu</span>}
      </PageHead>
      <div className="admin-practice-meta-row">
        <label className="admin-dictation-text-label">
          Tên Test
          <input
            className="admin-input admin-dictation-title-input"
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="vd: IELTS 8 - Reading Test 1"
          />
        </label>
        <label className="admin-practice-timelimit">
          Thời gian làm bài (phút, để trống = không giới hạn)
          <input
            className="admin-input"
            type="number"
            min="1"
            value={timeLimitMinutes ?? ""}
            onChange={e => onTimeLimitChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="vd: 60"
          />
        </label>
        <label className="admin-dictation-maxattempts">
          Số lượt làm bài tối đa (để trống = không giới hạn)
          <input
            className="admin-input"
            type="number"
            min="1"
            value={maxAttempts ?? ""}
            onChange={e => onMaxAttemptsChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="Không giới hạn"
          />
        </label>
      </div>

      <SectionBanner icon="📖">Phần bài đọc</SectionBanner>

      <PassageTitleFields passage={passage} onChange={onPassageChange} />

      <div className="admin-practice-bulk-paste">
        <span className="admin-upload-label">Bài đọc (mỗi dòng = 1 đoạn)</span>
        <textarea
          className="admin-input admin-textarea"
          rows={10}
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={"Glass, which has been made since the time of the Mesopotamians and Egyptians...\nNevertheless, demand for flat glass was very high..."}
        />
      </div>

      <SectionBanner icon="❓">Phần câu hỏi</SectionBanner>
      {(passage.groups ?? []).map((g, gi) => (
        <div className="admin-practice-group" key={gi}>
          <div className="admin-practice-group-head">
            <select className="admin-input admin-practice-type-select" value={g.type} onChange={e => changeGroupType(gi, e.target.value)}>
              {GROUP_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeGroup(gi)}>Xoá nhóm</button>
          </div>
          {g.type !== "table-diagram" && (
            <textarea
              className="admin-input admin-textarea"
              rows={2}
              value={g.instruction}
              onChange={e => updateGroup(gi, { instruction: e.target.value })}
              placeholder="Hướng dẫn chung của nhóm câu hỏi (vd: Choose the correct letter, A, B, C or D.)"
            />
          )}

          {g.type === "table-diagram" ? (
            <TableDiagramEditor
              group={g}
              onChange={patch => updateGroup(gi, patch)}
              startNumber={passage.groups.slice(0, gi).reduce((sum, prev) => sum + groupQuestionCount(prev), 0)}
            />
          ) : g.type === "diagram" ? (
            <DiagramEditor
              group={g}
              onChange={patch => updateGroup(gi, patch)}
              startNumber={passage.groups.slice(0, gi).reduce((sum, prev) => sum + groupQuestionCount(prev), 0)}
            />
          ) : g.type === "matching" ? (
            <MatchingEditor group={g} onChange={patch => updateGroup(gi, patch)} />
          ) : (
          <>
          {g.type === "tfng" && (
            <div className="admin-tfng-scheme-toggle" role="group" aria-label="Bộ nhãn True/False/Not Given hay Yes/No/Not Given">
              <label className="admin-checkbox-row">
                <input
                  type="radio"
                  name={`tfng-scheme-${gi}`}
                  checked={(g.tfngScheme ?? "TFNG") === "TFNG"}
                  onChange={() => changeTfngScheme(gi, "TFNG")}
                />
                TRUE / FALSE / NOT GIVEN (sự kiện khách quan trong bài)
              </label>
              <label className="admin-checkbox-row">
                <input
                  type="radio"
                  name={`tfng-scheme-${gi}`}
                  checked={g.tfngScheme === "YNNG"}
                  onChange={() => changeTfngScheme(gi, "YNNG")}
                />
                YES / NO / NOT GIVEN (quan điểm của tác giả)
              </label>
            </div>
          )}
          {g.questions.map((q, qi) => (
            <div className="admin-practice-question-row" key={qi}>
              <span className="admin-scene-list-index">{qi + 1}</span>
              <div className="admin-dictation-row-fields">
                {g.type === "multiple-choice" && (
                  <>
                    <input className="admin-input" value={q.text} onChange={e => updateQuestion(gi, qi, { text: e.target.value })} placeholder="Nội dung câu hỏi" />
                    {q.options.map((opt, oi) => (
                      <div className="admin-practice-option-row" key={oi}>
                        <input
                          type="radio"
                          name={`mc-${gi}-${qi}`}
                          checked={q.answerIndex === oi}
                          onChange={() => updateQuestion(gi, qi, { answerIndex: oi })}
                        />
                        <input
                          className="admin-input"
                          value={opt}
                          onChange={e => {
                            const options = q.options.map((o, idx) => (idx === oi ? e.target.value : o));
                            updateQuestion(gi, qi, { options });
                          }}
                          placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                        />
                      </div>
                    ))}
                  </>
                )}
                {g.type === "tfng" && (
                  <>
                    <input className="admin-input" value={q.text} onChange={e => updateQuestion(gi, qi, { text: e.target.value })} placeholder="Nội dung câu khẳng định (statement)" />
                    <select className="admin-input" value={q.answer} onChange={e => updateQuestion(gi, qi, { answer: e.target.value })}>
                      {(g.tfngScheme ?? "TFNG") === "YNNG" ? (
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
                  </>
                )}
                {g.type === "short-answer" && (
                  <>
                    <input className="admin-input" value={q.label} onChange={e => updateQuestion(gi, qi, { label: e.target.value })} placeholder="Gõ nguyên câu, đặt ___ (3 gạch dưới trở lên) tại chỗ cần điền — vd: EPRI receives financial support from ___ ." />
                    <input
                      className="admin-input"
                      value={q.acceptedAnswers}
                      onChange={e => updateQuestion(gi, qi, { acceptedAnswers: e.target.value })}
                      placeholder="Đáp án đúng — nhiều đáp án cách nhau bằng | (vd: slow|slowly)"
                    />
                  </>
                )}
              </div>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removeQuestion(gi, qi)}>Xoá</button>
            </div>
          ))}
          <div className="admin-practice-add-row">
            <button type="button" className="admin-btn-secondary" onClick={() => addQuestion(gi)}>+ Thêm câu hỏi</button>
            <OcrImportPanel label="📷 Tải ảnh trang câu hỏi (OCR)" onText={text => handleOcrQuestions(gi, text)} />
            {g.type === "multiple-choice" && (
              <BulkMcPaste onApply={text => handleBulkMultipleChoice(gi, text)} />
            )}
          </div>
          </>
          )}
        </div>
      ))}
      <button type="button" className="admin-btn-secondary" onClick={addGroup}>+ Thêm nhóm câu hỏi</button>

      {previewOpen && (
        <IeltsPracticeRunner
          test={{ title: title || "Xem trước", timeLimitMinutes: null, passages: [passage] }}
          mode="practice"
          readOnly
          onBack={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
