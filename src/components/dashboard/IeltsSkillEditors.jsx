import { useEffect, useRef, useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import { LuyenDePage } from "./PracticeStudio.jsx";
import ComprehensionStudio from "./ComprehensionStudio.jsx";
import PaperTestStudio, { hasPaperFile } from "./PaperTestStudio.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import IeltsPracticeRunner from "../IeltsPracticeRunner.jsx";
import { answerSheetGroup } from "../../lib/ketPetPracticeTest.js";
import { firstQuestionNumbers } from "../../lib/grading/ielts.js";
import { validatePaperTest } from "../../lib/lessonValidation.js";

// Trình soạn Reading kiểu IELTS (Test → Passage → Đọc hiểu / Luyện đề, soạn từng câu hoặc tải đề lên) — dùng chung
// IELTS Reading (CreateLessonPage.jsx, cố định Test 1-4 × Passage 1-3) và KET/PET Reading theo Unit
// (KetPetContentPage.jsx, tự thêm Test/Passage, 2026-11-02). `source` = nơi lưu + cách đặt tên:
//   { key, heading, accent, fixedTests, fixedPassages, list(), get(id), save(id, content), remove(id),
//     testIdOf(n), testNumberOf(id), newTestTitle(n) }

function LoadingCard() {
  return (
    <div className="admin-loading-row">
      <span className="admin-spinner" />
      <span>Đang tải...</span>
    </div>
  );
}

// Passage đang soạn theo kiểu "Tải đề lên (PDF / Word)" chưa (2026-10-31, giống KET/PET): Luyện đề = có đề hoặc phiếu
// trả lời "answer-sheet"; Đọc hiểu = có file đọc `readingPaper`.
function isPaperPassage(p, section) {
  if (section === "comprehension") return p?.readingPaper != null;
  return p?.paper != null || p?.groups?.[0]?.type === "answer-sheet";
}

export function ReadingTestsEditor({ source }) {
  const { heading, accent, fixedTests = null, fixedPassages = null } = source;
  const confirm = useConfirm();
  const [tests, setTests] = useState(null);
  // Tab Test 1-4 đang xem trên màn danh sách (không chuyển trang) — cùng cơ chế gộp Test+Passage
  // học sinh đang dùng ở LessonsPage.jsx (chốt 2026-09-11 để CMS khớp đúng luồng học sinh thấy).
  const [selectedTestN, setSelectedTestN] = useState(1);
  // KET/PET: số Passage trống vừa bấm "+ Thêm Passage" (chưa lưu) của Test đang xem.
  const [addedPassages, setAddedPassages] = useState(0);
  const [openTestId, setOpenTestId] = useState(null);
  const [title, setTitle] = useState("");
  const [passages, setPassages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Passage + phần (đọc hiểu/luyện đề) cần cuộn tới ngay khi mở Test — set khi bấm 1 trong 2 nút
  // trên thẻ Passage ở màn danh sách, đọc 1 lần rồi PracticeStudio tự xoá (xem prop `focusTarget`).
  const [focusTarget, setFocusTarget] = useState(null);
  // Cách soạn passage đang mở: false = soạn từng câu/từng dòng, true = "Tải đề lên (PDF / Word)". Đổi qua lại thì cất
  // phần của cách kia vào stash để quay lại không mất (chỉ lưu theo cách đang chọn lúc Xuất bản).
  const [paperMode, setPaperMode] = useState(false);
  const stashRef = useRef({});

  function reloadTests() {
    source.list().then(setTests);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reloadTests, [source.key]);

  function startEditing(nextPassages, focus) {
    setPaperMode(focus ? isPaperPassage(nextPassages[focus.passageIndex], focus.section) : false);
    stashRef.current = {};
  }

  async function openTest(t, focus = null) {
    const full = await source.get(t.id);
    let nextPassages = full?.passages ?? [];
    // Bấm thẳng "Đọc hiểu"/"Luyện đề" của 1 Passage chưa soạn (vd Passage 2 khi mới có Passage 1)
    // — tự thêm sẵn các passage rỗng còn thiếu tới đúng vị trí đó để có chỗ cuộn tới + soạn luôn.
    if (focus && nextPassages.length <= focus.passageIndex) {
      nextPassages = [...nextPassages];
      while (nextPassages.length <= focus.passageIndex) {
        nextPassages.push({ title: "", titleVi: "", audioUrl: "", sentences: [], groups: [] });
      }
    }
    setOpenTestId(t.id);
    setTitle(full?.title ?? t.title ?? "");
    setPassages(nextPassages);
    setSaved(false);
    setFocusTarget(focus);
    startEditing(nextPassages, focus);
  }

  function openNewTestNumbered(n, focus = null) {
    setOpenTestId(source.testIdOf(n));
    setTitle(source.newTestTitle(n));
    const nextPassages = [];
    if (focus) {
      while (nextPassages.length <= focus.passageIndex) {
        nextPassages.push({ title: "", titleVi: "", audioUrl: "", sentences: [], groups: [] });
      }
    }
    setPassages(nextPassages);
    setSaved(false);
    setFocusTarget(focus);
    startEditing(nextPassages, focus);
  }

  // Bấm nút "Đọc hiểu"/"Luyện đề" trên 1 thẻ Passage ở màn danh sách — mở đúng Test rồi cuộn
  // thẳng tới đúng passage + đúng phần trong PracticeStudio, đỡ phải tự cuộn tìm giữa nhiều passage.
  function openPassageSection(n, passageIndex, section) {
    const t = tests.find(t => t.id === source.testIdOf(n));
    const focus = { passageIndex, section };
    if (t) openTest(t, focus);
    else openNewTestNumbered(n, focus);
  }

  async function handleDeleteTest(id) {
    if (!(await confirm("Xoá nội dung Test này? Không hoàn tác được.", { danger: true }))) return;
    try {
      await source.remove(id);
      reloadTests();
    } catch (err) {
      alert(`Không xoá được: ${err.message}`);
    }
  }
  // overridePassage (LuyenDePage): passage vừa gộp text dán ngay lúc bấm Xuất bản — dùng trực tiếp
  // thay vì đọc `passages` state, vì setPassages là bất đồng bộ nên state có thể chưa kịp cập nhật
  // đúng lúc save (xem PracticeStudio.jsx `handleSaveClick`).
  async function handleSaveTest(overridePassage) {
    setSaving(true);
    setSaved(false);
    try {
      const order = tests?.find(t => t.id === openTestId)?.order ?? source.testNumberOf(openTestId);
      let finalPassages = passages;
      // Một số nút gắn thẳng onSave vào onClick nên tham số có thể là SyntheticEvent — chỉ nhận passage thật
      if (overridePassage && Object.getPrototypeOf(overridePassage) === Object.prototype && focusTarget) {
        finalPassages = passages.map((p, i) => (i === focusTarget.passageIndex ? overridePassage : p));
      }
      // Bài cũ (trước khi tách Luyện đề/Đọc hiểu, 2026-09-30) chưa có `practiceSentences` — chép bài đọc hiện tại sang
      // để từ nay sửa Đọc hiểu không kéo theo bài đọc của Luyện đề.
      finalPassages = finalPassages.map(p =>
        p.practiceSentences ? p : { ...p, practiceSentences: (p.sentences ?? []).map(s => ({ en: s.en ?? "", newParagraph: Boolean(s.newParagraph) })) }
      );
      setPassages(finalPassages);
      await source.save(openTestId, { title, order, passages: finalPassages });
      setSaved(true);
      reloadTests();
    } catch (err) {
      alert(`Không xuất bản được: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (openTestId && focusTarget) {
    const passageIndex = focusTarget.passageIndex;
    const passage = passages[passageIndex] ?? { title: "", titleVi: "", audioUrl: "", sentences: [], groups: [] };
    function updatePassageAt(nextPassage) {
      const next = [...passages];
      next[passageIndex] = nextPassage;
      setPassages(next);
    }
    // Ghép PATCH vào bản mới nhất — dùng cho giá trị tới muộn (upload audio xong sau khi cô đã sửa chỗ khác).
    function patchPassageAt(patch) {
      setPassages(prev => {
        const next = [...prev];
        next[passageIndex] = { ...(prev[passageIndex] ?? passage), ...patch };
        return next;
      });
    }
    const testLabel = `Test ${source.testNumberOf(openTestId)} — Passage ${passageIndex + 1}`;
    const isComprehension = focusTarget.section === "comprehension";

    // Đổi cách soạn: cất phần của cách đang dùng vào stash, lấy lại phần của cách kia (nếu đã có trong phiên này).
    async function switchMode(next) {
      if (next === paperMode) return;
      const msg = next
        ? "Chuyển sang \"Tải đề lên\"? Khi xuất bản, phần này lưu theo file tải lên, phần soạn từng câu bị thay."
        : "Chuyển sang \"Soạn từng câu\"? Khi xuất bản, phần này lưu theo các câu soạn, file tải lên bị thay.";
      if (!(await confirm(msg))) return;
      const stash = stashRef.current;
      if (isComprehension) {
        if (next) patchPassageAt({ readingPaper: stash.readingPaper ?? null });
        else {
          stash.readingPaper = passage.readingPaper;
          patchPassageAt({ readingPaper: undefined });
        }
      } else if (next) {
        stash.questionGroups = passage.groups;
        patchPassageAt({ paper: stash.paper ?? null, questionPaper: stash.questionPaper ?? undefined, groups: stash.paperGroups ?? [answerSheetGroup()] });
      } else {
        stash.paper = passage.paper;
        stash.questionPaper = passage.questionPaper;
        stash.paperGroups = passage.groups;
        patchPassageAt({ paper: undefined, questionPaper: undefined, groups: stash.questionGroups ?? [] });
      }
      setPaperMode(next);
      setSaved(false);
    }
    const modeSwitch = (
      <div className="admin-segmented paper-authoring-switch">
        <button type="button" className={!paperMode ? "is-active" : ""} onClick={() => switchMode(false)}>Soạn từng câu</button>
        <button type="button" className={paperMode ? "is-active" : ""} onClick={() => switchMode(true)}>Tải đề lên (PDF / Word)</button>
      </div>
    );

    if (paperMode && isComprehension) {
      return (
        <>
          {modeSwitch}
          <PaperTestStudio
            accent={accent}
            label={`${testLabel} — Đọc hiểu`}
            backLabel="← Quay lại danh sách Test"
            onBack={() => setOpenTestId(null)}
            paper={passage.readingPaper}
            onPaperChange={readingPaper => patchPassageAt({ readingPaper })}
            warnings={hasPaperFile(passage.readingPaper) ? [] : ["Chưa tải file lên."]}
            extra={
              <>
                <label className="admin-dictation-text-label">
                  Tên bài đọc
                  <input className="admin-input" value={passage.title ?? ""} onChange={e => patchPassageAt({ title: e.target.value })} />
                </label>
                <AudioUploadField label="Audio bài đọc (tuỳ chọn)" value={passage.audioUrl} onChange={audioUrl => patchPassageAt({ audioUrl })} />
              </>
            }
            renderPreview={onClose => (
              <IeltsPracticeRunner test={{ title: `${testLabel} (xem trước)`, timeLimitMinutes: null, passages: [passage] }} mode="comprehension" readOnly onBack={onClose} />
            )}
            onSave={handleSaveTest}
            saving={saving}
            saved={saved}
          />
        </>
      );
    }
    if (paperMode) {
      const startNumber = firstQuestionNumbers(passages)[passageIndex] ?? 1;
      const questions = passage.groups?.[0]?.questions ?? [];
      return (
        <>
          {modeSwitch}
          <PaperTestStudio
            accent={accent}
            label={`${testLabel} — Luyện đề`}
            backLabel="← Quay lại danh sách Test"
            onBack={() => setOpenTestId(null)}
            paper={passage.paper}
            onPaperChange={paper => patchPassageAt({ paper })}
            questionPaper={passage.questionPaper}
            onQuestionPaperChange={questionPaper => patchPassageAt({ questionPaper: questionPaper ?? undefined })}
            questions={questions}
            onQuestionsChange={qs => patchPassageAt({ groups: [answerSheetGroup(qs)] })}
            startNumber={startNumber}
            warnings={validatePaperTest(passage.paper, questions, startNumber)}
            renderPreview={onClose => (
              <IeltsPracticeRunner
                test={{ title: `${testLabel} (xem trước)`, timeLimitMinutes: null, passages: [passage] }}
                mode="practice"
                readOnly
                firstNumber={startNumber}
                onBack={onClose}
              />
            )}
            onSave={handleSaveTest}
            saving={saving}
            saved={saved}
          />
        </>
      );
    }

    if (isComprehension) {
      return (
        <>
        {modeSwitch}
        <ComprehensionStudio
          accent={accent}
          testLabel={testLabel}
          titleEn={passage.title}
          onTitleEnChange={title => patchPassageAt({ title })}
          titleVi={passage.titleVi}
          onTitleViChange={titleVi => patchPassageAt({ titleVi })}
          audioUrl={passage.audioUrl}
          onAudioUrlChange={audioUrl => patchPassageAt({ audioUrl })}
          sentences={passage.sentences}
          onSentencesChange={sentences => patchPassageAt({ sentences })}
          practiceSentences={passage.practiceSentences}
          onBack={() => setOpenTestId(null)}
          onSave={handleSaveTest}
          saving={saving}
          saved={saved}
        />
        </>
      );
    }
    return (
      <>
      {modeSwitch}
      <LuyenDePage
        accent={accent}
        testLabel={testLabel}
        title={title}
        onTitleChange={setTitle}
        passage={passage}
        onPassageChange={updatePassageAt}
        autoStartNumber={firstQuestionNumbers(passages.map((p, i) => (i === passageIndex ? { ...p, firstNumber: undefined } : p)))[passageIndex] ?? 1}
        onBack={() => setOpenTestId(null)}
        onSave={handleSaveTest}
        saving={saving}
        saved={saved}
      />
      </>
    );
  }

  const selectedTest = tests?.find(t => t.id === source.testIdOf(selectedTestN)) ?? null;
  // IELTS: cố định Test 1-4 × Passage 1-3. KET/PET (fixedTests/fixedPassages = null): cô tự thêm Test / Passage.
  const testNumbers = fixedTests
    ? Array.from({ length: fixedTests }, (_, i) => i + 1)
    : [...new Set([...(tests ?? []).map(t => source.testNumberOf(t.id)), selectedTestN])].sort((a, b) => a - b);
  const passageCount = fixedPassages ?? Math.max(1, (selectedTest?.passages?.length ?? 0) + addedPassages);

  function selectTest(n) {
    setSelectedTestN(n);
    setAddedPassages(0);
  }

  async function removePassage(index) {
    if (!(await confirm(`Xoá Passage ${index + 1} của Test ${selectedTestN}? Không hoàn tác được.`, { danger: true }))) return;
    try {
      const passages = (selectedTest.passages ?? []).filter((_, i) => i !== index);
      if (!passages.length) await source.remove(selectedTest.id);
      else await source.save(selectedTest.id, { title: selectedTest.title ?? "", order: selectedTest.order ?? selectedTestN, passages });
      reloadTests();
    } catch (err) {
      alert(`Không xoá được: ${err.message}`);
    }
  }

  return (
    <div className="admin-card">
      <h2>{heading}</h2>
      {tests === null && <LoadingCard />}
      {tests && (
        <>
          <div className="ielts-testpicker-tabs admin-testpicker-tabs">
            {testNumbers.map(n => {
              const t = tests.find(t => t.id === source.testIdOf(n));
              return (
                <button
                  key={n}
                  type="button"
                  className={`ielts-testpicker-tab${selectedTestN === n ? " is-active" : ""}${!t ? " is-empty" : ""}`}
                  onClick={() => selectTest(n)}
                >
                  Test {n}
                </button>
              );
            })}
            {!fixedTests && (
              <button type="button" className="ielts-testpicker-tab is-empty" onClick={() => selectTest(Math.max(0, ...testNumbers) + 1)}>
                + Thêm Test
              </button>
            )}
          </div>

          <div className="admin-test-grid">
            {Array.from({ length: passageCount }, (_, i) => i + 1).map(n => {
              const p = selectedTest?.passages?.[n - 1];
              return (
                <div key={n} className="admin-test-card" style={{ "--accent": accent }}>
                  <div className="admin-test-card-main">
                    <span className="admin-test-card-icon">📖</span>
                    <span className="admin-test-card-title">{p?.title || `Passage ${n}`}</span>
                  </div>
                  <div className="admin-test-card-actions">
                    <button
                      className="admin-link-btn"
                      onClick={() => openPassageSection(selectedTestN, n - 1, "comprehension")}
                    >
                      Đọc hiểu
                    </button>
                    <button
                      className="admin-link-btn"
                      onClick={() => openPassageSection(selectedTestN, n - 1, "practice")}
                    >
                      Luyện đề
                    </button>
                    {!fixedPassages && p && (
                      <button className="admin-link-btn admin-pill-btn-danger" onClick={() => removePassage(n - 1)}>
                        Xoá
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!fixedPassages && (
              <button type="button" className="admin-test-card admin-test-card-add" style={{ "--accent": accent }} onClick={() => setAddedPassages(a => a + 1)}>
                <span className="admin-test-card-add-icon">+</span>
                <span>Thêm Passage</span>
              </button>
            )}
          </div>

          {selectedTest && (
            <button
              type="button"
              className="admin-link-btn admin-pill-btn-danger admin-test-delete-link"
              onClick={() => handleDeleteTest(selectedTest.id)}
            >
              Xoá nội dung Test {selectedTestN}
            </button>
          )}
        </>
      )}
    </div>
  );
}
