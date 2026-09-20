import { useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import { YLE_SERIES } from "../lib/yleData.js";
import { stopCurrent } from "../lib/speech.js";
import { loadLevelContent } from "../lib/lessons.js";
import ListeningMode from "../components/ListeningMode.jsx";
import SceneRunner from "../components/SceneRunner.jsx";
import ReadingRunner from "../components/ReadingRunner.jsx";
import IeltsPracticeRunner from "../components/IeltsPracticeRunner.jsx";
import IeltsListeningRunner from "../components/IeltsListeningRunner.jsx";
import DictationRunner from "../components/DictationRunner.jsx";
import OpeningPasswordScreen from "../components/OpeningPasswordScreen.jsx";
import { checkOpening } from "../lib/openings.js";
import StartersListeningTestRunner, { testHasContent } from "../components/StartersListeningTestRunner.jsx";
import { listListeningExamTests } from "../lib/adminLessons.js";
import { useAuth } from "../lib/authContext.jsx";
import { readParams, setParams } from "../lib/urlState.js";

const WIZARD_STEPS = ["Bộ đề", "Cấp độ", "Bài học"];

// Thanh tiến trình kiểu Duolingo — cho biết đang ở bước nào trong 4 bước chọn bài
// (chọn bộ đề → cấp độ → dạng bài → test). `step` = chỉ số bước hiện tại (0-based).
function WizardSteps({ step, onStepClick }) {
  return (
    <div className="wizard-steps" role="list" aria-label="Các bước chọn bài">
      {WIZARD_STEPS.map((label, i) => {
        const isDone = i < step;
        const className = `wizard-step${isDone ? " is-done" : i === step ? " is-current" : ""}`;
        const content = (
          <>
            <span className="wizard-step-num" aria-hidden="true">
              {isDone ? "✓" : i + 1}
            </span>
            <span className="wizard-step-label">{label}</span>
          </>
        );
        return (
          <span key={label} role="listitem" className="wizard-step-item">
            {isDone ? (
              <button type="button" className={className} onClick={() => onStepClick?.(i)}>
                {content}
              </button>
            ) : (
              <span className={className}>{content}</span>
            )}
            {i < WIZARD_STEPS.length - 1 && <span className="wizard-step-sep" aria-hidden="true">›</span>}
          </span>
        );
      })}
    </div>
  );
}

// Khung màn hình dùng chung cho mọi bước chọn bài — Header CHUNG của cả site (đồng bộ với
// HomePage/About/Contact...) + dải header tối riêng chứa nút "Quay lại" + tiêu đề bước +
// thanh tiến trình Duolingo.
function LessonShell({ step, backLabel, onBack, onNavigate, onStepClick, title, subtitle, dark, children }) {
  return (
    <div className="home-v2 lessons-screen-v2">
      <Header page="lessons" onNavigate={onNavigate} />

      <div className="dark-hero-band dark-hero-band-sm">
        <div className="dark-hero-inner dark-hero-inner-row">
          <div className="dark-hero-text dark-hero-text-row">
            <button className="lesson-back-link" onClick={onBack}>
              ⬅ {backLabel}
            </button>
            <div className="dark-hero-titles">
              <h1 className="dark-hero-title">{title}</h1>
              {subtitle && <p className="dark-hero-subtitle">{subtitle}</p>}
            </div>
          </div>
          {typeof step === "number" && <WizardSteps step={step} onStepClick={onStepClick} />}
        </div>
      </div>

      <div className={`content-grid-section${dark ? " content-grid-section-dark" : ""}`}>{children}</div>
    </div>
  );
}

// Khối chờ dạng skeleton (thay vì chữ "Đang tải...") khi content Firestore/fallback chưa về —
// tránh cảm giác trống trơn trong lúc chờ mạng.
function ContentSkeleton() {
  return (
    <div className="content-skeleton" aria-hidden="true">
      <div className="content-skeleton-bar content-skeleton-bar-sm" />
      <div className="content-skeleton-block" />
    </div>
  );
}

// Màn chặn dùng chung cho 2 lý do: (1) hết lượt nộp bài tối đa của 1 Test (`test.maxAttempts`,
// xem lib/attempts.js) — chỉ áp dụng Speaking/Reading (có nộp bài); (2) giáo viên CHƯA MỞ bài này
// cho lớp của học sinh (`classAssignments/{className}`, xem lib/classAssignments.js) — áp dụng cả
// Listening/Speaking/Reading, chốt 2026-08-27: "giáo viên phải mở mới cho vô làm".
function BlockedScreen({ title, message, onBack }) {
  return (
    <div className="home-v2 lessons-screen-v2">
      <div className="name-prompt-shell">
        <div className="name-prompt-card">
          <h2>{title}</h2>
          <p className="admin-muted-text">{message}</p>
          <div className="name-prompt-actions">
            <button type="button" className="btn btn-primary" onClick={onBack}>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ text }) {
  return (
    <div className="lessons-info-card">
      <span className="lessons-info-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      </span>
      <p>{text}</p>
    </div>
  );
}

export default function LessonsPage({ initialSeriesId, onNavigate }) {
  // Không còn màn "Chọn bộ đề" trung gian — bộ đề đã được chọn từ thẻ ở trang chủ
  // (xem App.jsx `goToLessons`). Mặc định Starters nếu vào thẳng /lessons không qua trang chủ.
  const [series] = useState(
    () => YLE_SERIES.find(s => s.id === initialSeriesId) ?? YLE_SERIES[0]
  );
  // Đọc cấp độ ban đầu từ URL (?level=..) — để F5 giữa lúc đang chọn bài không
  // bị bật về bước đầu (xem App.jsx cho phần trang tổng, src/lib/urlState.js cho cơ chế chung).
  const initialUrlRef = useRef(readParams());
  const isIelts = series.id === "ielts";
  const [level, setLevel] = useState(() => {
    const n = Number(initialUrlRef.current.get("level"));
    // Series chỉ có 1 cấp → tự chọn luôn, không hiện bước "Chọn cấp độ" — TRỪ IELTS: dù hiện chỉ
    // có 1 bộ (IELTS 8), vẫn hiện thẻ để bấm vào (sau này thêm IELTS 9, 10... — chốt 2026-09-11).
    if (series.levels.length === 1 && !isIelts) return series.levels[0];
    return series.levels.find(l => l.number === n) ?? null;
  });
  const [content, setContent] = useState(null); // { listening, tests, readingTests } — đọc qua lib/lessons.js
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedReadingTest, setSelectedReadingTest] = useState(null);
  const [selectedDictationTest, setSelectedDictationTest] = useState(null);
  // true khi đang chạy bài Speaking toàn màn hình (SceneRunner) — không còn bước "Chọn dạng bài"
  // riêng, Listening + Speaking hiện luôn cùng lúc trên màn hình chọn cấp độ (xem yêu cầu rút gọn).
  const [speakingActive, setSpeakingActive] = useState(false);
  // true khi đang chạy bài Reading & Writing toàn màn hình (ReadingRunner).
  const [readingActive, setReadingActive] = useState(false);
  // true khi đang chạy bài Dictation toàn màn hình (DictationRunner).
  const [dictationActive, setDictationActive] = useState(false);
  // true khi đang xem chi tiết Listening (bấm vào thẻ Listening trên màn "Bài học").
  const [listeningActive, setListeningActive] = useState(false);
  // Tab trong màn Listening: "practice" = Luyện nghe (video Drive), "test" = Luyện đề (Test 1-3).
  const [listeningTab, setListeningTab] = useState("practice");
  // Luyện đề Listening (chỉ Starters có dữ liệu, xem StartersListeningExamStudio.jsx) — null = chưa tải.
  const [examTests, setExamTests] = useState(null);
  const [activeExamTest, setActiveExamTest] = useState(null);
  // Test IELTS Reading đang XEM DANH SÁCH PASSAGE (đã bấm vào thẻ Test, chưa chọn Passage cụ thể)
  // — đúng cây điều hướng Test → Passage giáo viên yêu cầu (chốt 2026-09-11), KHÁC với mở thẳng
  // cả Test nhiều passage cùng lúc như trước.
  // Test Reading đang chọn trong màn gộp Test+Passage (tab, không chuyển trang — chốt 2026-09-11
  // rút gọn luồng chọn bài, trước đó tách 2 màn "Chọn Test" rồi "Chọn Passage" riêng).
  const [selectedReadingTestN, setSelectedReadingTestN] = useState(1);
  // Passage IELTS Reading đang làm (1 test "giả" chỉ chứa đúng 1 passage — xem
  // lib/adminLessons.js `practiceTests`, mỗi passage gộp cả bài đọc+dịch+từ vựng lẫn câu hỏi chấm
  // điểm) — không qua attempts.js, cho làm lại thoải mái để luyện tập (chốt 2026-09-10).
  const [activeIeltsPracticeTest, setActiveIeltsPracticeTest] = useState(null);
  // "practice" (card LUYỆN ĐỀ, có giờ + câu hỏi chấm điểm) hoặc "comprehension" (card ĐỌC HIỂU,
  // chỉ đọc từng câu + dịch + từ vựng) — mỗi Passage tách thành 2 card riêng (chốt 2026-09-11).
  const [activeIeltsPracticeMode, setActiveIeltsPracticeMode] = useState("practice");
  // Cùng cơ chế trên nhưng cho Listening: Test → Section.
  const [pickingListeningTest, setPickingListeningTest] = useState(null);
  const [activeIeltsListeningTest, setActiveIeltsListeningTest] = useState(null);
  // Kỹ năng IELTS đang chọn (reading/listening/writing/speaking/dictation) — null = đang ở màn
  // chọn kỹ năng (các thẻ Reading/Listening/.../ hiện ngay khi vào 1 bộ đề, chốt 2026-09-11).
  const [selectedIeltsSkill, setSelectedIeltsSkill] = useState(null);
  // Kỹ năng YLE đang chọn (listening/speaking/reading/dictation) — null = màn chọn kỹ năng.
  const [selectedSkill, setSelectedSkill] = useState(null);
  const { user, isStaff, isTester, isAdmin, profile } = useAuth();
  // Tên/lớp gắn vào báo cáo quá trình làm bài (speakingSessions, xem SceneRunner.jsx +
  // StudentResultsPage.jsx) — từ 2026-08-27 lấy THẲNG từ hồ sơ tài khoản đã đăng nhập
  // (users/{uid}.displayName/className, xem authContext.jsx), không còn gõ tay qua
  // NamePromptScreen (đã bỏ hẳn — đăng nhập bắt buộc nên luôn có sẵn hồ sơ thật). Admin/teacher
  // tự test dùng nhãn giả, không tạo session/tính lượt.
  const studentName = isStaff ? (isAdmin ? "[Test - Admin]" : "[Test - Giáo viên]") : profile?.displayName ?? "";
  const studentClass = isStaff ? "Admin" : profile?.className ?? "";
  // Đang chặn học sinh vào bài: { title, message } — xem BlockedScreen (hết lượt nộp bài HOẶC
  // giáo viên chưa mở bài này cho lớp).
  const [blocked, setBlocked] = useState(null);
  const [checkingAttempts, setCheckingAttempts] = useState(false);
  // Lần mở bài (lib/openings.js) đang dùng để làm bài: cho biết số phút, và khoá đếm lượt riêng của lần mở đó.
  const [activeOpening, setActiveOpening] = useState(null);
  // Chờ học sinh nhập mật khẩu vào bài: { opening, title, launch }
  const [gate, setGate] = useState(null);

  useEffect(() => {
    setParams({ level: level ? level.number : null, test: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  useEffect(() => {
    setParams({ test: selectedTest ? selectedTest.id : null });
  }, [selectedTest]);

  // Test chỉ có sau khi `content` tải xong (Firestore/fallback) — khớp lại `test` từ URL ban đầu
  // với danh sách test thật lúc đó, chỉ thử ĐÚNG 1 LẦN (không tự chọn lại nếu học sinh bấm đổi).
  useEffect(() => {
    const wantedTestId = initialUrlRef.current.get("test");
    if (!wantedTestId || !content?.tests?.length) return;
    const match = content.tests.find(t => t.id === wantedTestId);
    if (match) setSelectedTest(match);
    initialUrlRef.current.delete("test");
  }, [content]);
  // Tải nội dung thật (Firestore, fallback hardcode) ngay khi vào 1 cấp — dùng chung cho cả
  // Listening lẫn Speaking, hiện luôn cùng lúc trên 1 màn hình.
  useEffect(() => {
    if (!series || !level) {
      setContent(null);
      return;
    }
    setContent(null);
    loadLevelContent(series, level).then(setContent);
  }, [series, level]);

  useEffect(() => {
    setSelectedTest(null);
  }, [level]);

  useEffect(() => {
    if (!listeningActive || listeningTab !== "test" || !series || !level || !["starters", "movers"].includes(series.id)) return;
    setExamTests(null);
    listListeningExamTests(series.id, level.number).then(setExamTests).catch(() => setExamTests([]));
  }, [listeningActive, listeningTab, series, level]);

  // Rời khỏi màn "1 cấp độ" (đổi cấp khác / về bộ đề khác) — quay lại màn chọn cấp.
  function backToLevelList() {
    stopCurrent();
    setSelectedTest(null);
    setSelectedReadingTest(null);
    setSelectedDictationTest(null);
    setSpeakingActive(false);
    setReadingActive(false);
    setDictationActive(false);
    setListeningActive(false);
    setActiveIeltsPracticeTest(null);
    setPickingListeningTest(null);
    setActiveIeltsListeningTest(null);
    setSelectedIeltsSkill(null);
    setSelectedSkill(null);
    // Series chỉ có 1 cấp và không phải IELTS → không có màn "Chọn cấp độ" để quay lại, về thẳng
    // trang chủ. IELTS luôn có màn "Chọn cấp độ" (xem khởi tạo `level` ở trên).
    if (series.levels.length === 1 && !isIelts) onNavigate("home");
    else setLevel(null);
  }

  // Thoát khỏi bài Speaking toàn màn hình (SceneRunner), quay lại màn "Bài học" — KHÔNG tính là
  // 1 lượt nộp bài (bấm "Quay lại" giữa chừng khác với nộp bài thật, xem incrementAttempt() gọi
  // trong SceneRunner.jsx khi thật sự hoàn thành).
  function exitSpeaking() {
    stopCurrent();
    setSpeakingActive(false);
    setSelectedTest(null);
  }

  // Thoát khỏi bài Reading & Writing toàn màn hình (ReadingRunner), quay lại màn "Bài học" —
  // tương tự exitSpeaking, KHÔNG tính lượt (lượt tính lúc bấm "Nộp bài" bên trong ReadingRunner).
  function exitReading() {
    stopCurrent();
    setReadingActive(false);
    setSelectedReadingTest(null);
  }

  // Thoát khỏi bài Dictation toàn màn hình (DictationRunner), quay lại màn "Bài học" — tương tự
  // exitReading, KHÔNG tính lượt (lượt tính lúc bấm "Xem kết quả" bên trong DictationRunner).
  function exitDictation() {
    stopCurrent();
    setDictationActive(false);
    setSelectedDictationTest(null);
  }

  // Thoát khỏi màn chi tiết Listening, quay lại màn "Bài học".
  function exitListening() {
    stopCurrent();
    setListeningActive(false);
    setListeningTab("practice");
    setActiveExamTest(null);
  }

  // Cho phép bấm vào 1 bước ĐÃ hoàn thành trên thanh tiến trình (WizardSteps) để nhảy thẳng
  // về lại bước đó, thay vì phải bấm "Quay lại" nhiều lần.
  function goToWizardStep(i) {
    if (i === 0) onNavigate("home");
    else if (i === 1) backToLevelList();
  }

  const tests = content?.tests ?? [];
  // Cấp độ chỉ có 1 Test (trường hợp phổ biến hiện tại) → tự chọn luôn, không hiện thêm bước chọn.
  const autoTest = tests.length === 1 ? tests[0] : null;
  const activeTest = selectedTest ?? autoTest;

  const readingTests = content?.readingTests ?? [];
  const autoReadingTest = readingTests.length === 1 ? readingTests[0] : null;
  const activeReadingTest = selectedReadingTest ?? autoReadingTest;

  const practiceTests = content?.practiceTests ?? [];
  const ieltsListeningTests = content?.ieltsListeningTests ?? [];

  const dictationTests = content?.dictationTests ?? [];
  const autoDictationTest = dictationTests.length === 1 ? dictationTests[0] : null;
  const activeDictationTest = selectedDictationTest ?? autoDictationTest;

  // ---------- Bước 1: chọn cấp độ ----------
  if (!level) {
    return (
      <LessonShell
        step={1}
        title={series.title}
        subtitle={isIelts ? "Chọn bộ đề muốn luyện" : "Chọn cấp độ muốn luyện"}
        backLabel="Bộ đề khác"
        onBack={() => onNavigate("home")}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
      >
        <div className="content-grid content-grid-4">
          {series.levels.map(l => (
            <button
              key={l.id}
              className="content-card-v2 content-card-v2-center"
              onClick={() => setLevel(l)}
              style={{ "--accent": series.color }}
            >
              <div className="card-banner-strip">
                <span>{series.title} {l.number}</span>
              </div>
              <div className="content-card-v2-body">
                <span className="level-card-badge">{l.number}</span>
                <h3>{series.title} {l.number}</h3>
                <p className="series-levels">
                  {isIelts ? "Reading · Listening · Writing · Speaking · Dictation" : "Listening · Speaking · Dictation"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </LessonShell>
    );
  }

  // ---------- Màn chặn (hết lượt nộp bài HOẶC giáo viên chưa mở bài này cho lớp) ----------
  if (blocked) {
    return <BlockedScreen title={blocked.title} message={blocked.message} onBack={() => setBlocked(null)} />;
  }
  if (gate) {
    return (
      <OpeningPasswordScreen
        opening={gate.opening}
        title={gate.title}
        onBack={() => setGate(null)}
        onSuccess={() => {
          const { opening, launch } = gate;
          setGate(null);
          setActiveOpening(opening);
          launch(opening);
        }}
      />
    );
  }

  // ---------- Test IELTS Reading đang làm ----------
  if (activeIeltsPracticeTest) {
    return (
      <IeltsPracticeRunner
        test={activeIeltsPracticeTest}
        mode={activeIeltsPracticeMode}
        openingId={activeOpening?.id}
        studentUid={!isStaff ? user?.uid : null}
        studentName={studentName}
        studentClass={studentClass}
        seriesId={series.id}
        level={level.number}
        onBack={() => setActiveIeltsPracticeTest(null)}
      />
    );
  }

  // ---------- Test IELTS Listening đang làm ----------
  if (activeIeltsListeningTest) {
    return (
      <IeltsListeningRunner
        test={activeIeltsListeningTest}
        onBack={() => setActiveIeltsListeningTest(null)}
        openingId={activeOpening?.id}
        studentUid={!isStaff ? user?.uid : null}
        studentName={studentName}
        studentClass={studentClass}
        seriesId={series.id}
        level={level.number}
      />
    );
  }

  // ---------- Chọn Section (đã bấm vào 1 Test Listening) ----------
  if (pickingListeningTest) {
    return (
      <LessonShell
        step={2}
        title={`${series.title} ${level.number} · ${pickingListeningTest.title}`}
        subtitle="Chọn Section muốn làm"
        backLabel="Quay lại"
        onBack={() => setPickingListeningTest(null)}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
        dark
      >
        <div className="content-grid content-grid-4">
          {Array.from({ length: 4 }, (_, i) => i + 1).map(n => {
            const s = pickingListeningTest.sections?.[n - 1];
            return lessonCard({
              key: `section${n}`,
              banner: `Section ${n}`,
              title: s?.title || `Section ${n}`,
              desc: "Nghe + câu hỏi chấm điểm",
              cta: s ? "Bắt đầu làm bài" : "Chưa có nội dung",
              disabled: !s,
              onClick: () =>
                setActiveIeltsListeningTest({
                  ...pickingListeningTest,
                  timeLimitMinutes: activeOpening?.timeLimitMinutes ?? pickingListeningTest.timeLimitMinutes,
                  title: `${pickingListeningTest.title} · Section ${n}`,
                  sections: [s],
                }),
            });
          })}
        </div>
      </LessonShell>
    );
  }

  // ---------- Bước 2: toàn bộ bài học của cấp độ (Listening + Speaking cùng lúc) ----------
  // Bài Speaking đang chạy toàn màn hình (SceneRunner) tách riêng, không nằm trong LessonShell.
  if (speakingActive && activeTest?.scenes?.length) {
    return (
      <div className="speaking-fullscreen">
        <div className="speaking-fullscreen-topbar">
          <button className="speaking-fullscreen-back" onClick={exitSpeaking}>
            ⬅ Quay lại
          </button>
          <span className="speaking-fullscreen-title">
            {series.title} {level.number} · {activeTest.title}
          </span>
        </div>
        <div className="speaking-fullscreen-body">
          <SceneRunner
            scenes={activeTest.scenes}
            onFinish={exitSpeaking}
            progressKey={`${series.id}-${level.number}-${activeTest.id}`}
            studentName={studentName}
            studentClass={studentClass}
            studentUid={!isStaff ? user?.uid : null}
            seriesId={series.id}
            level={level.number}
            testId={activeTest.id}
            lessonLabel={`${series.title} ${level.number} · ${activeTest.title}`}
            limitMinutes={activeOpening?.timeLimitMinutes ?? activeTest.timeLimitMinutes}
            openingId={activeOpening?.id}
          />
        </div>
      </div>
    );
  }

  // ---------- Bài Reading & Writing toàn màn hình (ReadingRunner) ----------
  if (readingActive && activeReadingTest?.parts?.length) {
    return (
      <div className="reading-fullscreen">
        <div className="speaking-fullscreen-topbar">
          <button className="speaking-fullscreen-back" onClick={exitReading}>
            ⬅ Quay lại
          </button>
          <span className="speaking-fullscreen-title">
            {series.title} {level.number} · {activeReadingTest.title}
          </span>
        </div>
        <div className="speaking-fullscreen-body reading-fullscreen-body">
          <ReadingRunner
            parts={activeReadingTest.parts}
            onFinish={exitReading}
            studentUid={!isStaff ? user?.uid : null}
            seriesId={series.id}
            level={level.number}
            testId={activeReadingTest.id}
            limitMinutes={activeOpening?.timeLimitMinutes ?? activeReadingTest.timeLimitMinutes}
            openingId={activeOpening?.id}
            studentName={studentName}
            studentClass={studentClass}
            lessonLabel={`${series.title} ${level.number} · ${activeReadingTest.title}`}
          />
        </div>
      </div>
    );
  }

  // ---------- Bài Dictation toàn màn hình (DictationRunner) ----------
  if (dictationActive && activeDictationTest?.sentences?.length) {
    return (
      <div className="reading-fullscreen">
        <div className="speaking-fullscreen-topbar">
          <button className="speaking-fullscreen-back" onClick={exitDictation}>
            ⬅ Quay lại
          </button>
          <span className="speaking-fullscreen-title">
            {series.title} {level.number} · {activeDictationTest.title}
          </span>
        </div>
        <div className="speaking-fullscreen-body reading-fullscreen-body dictation-fullscreen-body">
          <DictationRunner
            sentences={activeDictationTest.sentences}
            onFinish={exitDictation}
            studentUid={!isStaff ? user?.uid : null}
            seriesId={series.id}
            level={level.number}
            testId={activeDictationTest.id}
            limitMinutes={activeOpening?.timeLimitMinutes ?? activeDictationTest.timeLimitMinutes}
            openingId={activeOpening?.id}
            studentName={studentName}
            studentClass={studentClass}
            lessonLabel={`${series.title} ${level.number} · ${activeDictationTest.title}`}
          />
        </div>
      </div>
    );
  }

  // ---------- Chi tiết Listening (bấm vào thẻ Listening) ----------
  // ---------- Luyện đề Listening (Starters) toàn màn hình, cuộn xuống như Reading & Writing ----------
  if (listeningActive && activeExamTest) {
    return (
      <div className="reading-fullscreen">
        <div className="speaking-fullscreen-topbar">
          <button className="speaking-fullscreen-back" onClick={() => setActiveExamTest(null)}>
            ⬅ Quay lại
          </button>
          <span className="speaking-fullscreen-title">
            {series.title} {level.number} · {activeExamTest.title ?? "Luyện đề"}
          </span>
        </div>
        <div className="speaking-fullscreen-body reading-fullscreen-body">
          <div className="exam-fullscreen-inner">
            <StartersListeningTestRunner
              test={activeOpening?.timeLimitMinutes ? { ...activeExamTest, timeLimitMinutes: activeOpening.timeLimitMinutes } : activeExamTest}
              openingId={activeOpening?.id}
              studentUid={!isStaff ? user?.uid : null}
              studentName={studentName}
              studentClass={studentClass}
              seriesId={series.id}
              level={level.number}
              lessonLabel={`${series.title} ${level.number} · ${activeExamTest.title ?? "Luyện đề"}`}
            />
          </div>
        </div>
      </div>
    );
  }

  if (listeningActive) {
    return (
      <LessonShell
        step={2}
        title={`${series.title} · Cấp ${level.number} · Listening`}
        backLabel="Quay lại"
        onBack={exitListening}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
      >
        <div className="listening-view">
        <div className="ielts-testpicker-tabs ielts-testpicker-tabs-light">
          {[
            { key: "practice", label: "Luyện nghe" },
            { key: "test", label: "Luyện đề" },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              className={`ielts-testpicker-tab${listeningTab === t.key ? " is-active" : ""}`}
              onClick={() => setListeningTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="listening-view-body">
        {listeningTab === "practice" ? (
          content?.listening?.length ? (
            <ListeningMode listening={content.listening} />
          ) : (
            <InfoCard text="Bài luyện nghe cấp độ này chưa có video." />
          )
        ) : (
          <div className="content-grid content-grid-4 yle-skill-grid yle-skill-grid-3">
            {[1, 2, 3].map(n => {
              const t = examTests?.find(x => x.id === `test${n}`);
              const ready = testHasContent(t);
              return (
                <button
                  key={`listening-exam-test${n}`}
                  className="content-card-v2 content-card-v2-center ielts-skill-tile"
                  disabled={!ready}
                  onClick={() => guardStart("listening-exam", { id: `test${n}`, title: `Test ${n}` }, () => setActiveExamTest(t))}
                  style={{ "--accent": series.color, ...(ready ? {} : { opacity: 0.55, cursor: "default" }) }}
                >
                  <span className="ielts-skill-tile-label">Test {n}</span>
                </button>
              );
            })}
          </div>
        )}
        </div>
        </div>
      </LessonShell>
    );
  }

  // 1 thẻ bài học "ngay ngắn" kiểu đồng nhất (banner màu + icon play, tiêu đề Listening/Speaking,
  // mô tả ngắn, nút hành động) — dùng chung cho cả Listening lẫn từng Test Speaking.
  function lessonCard({ key, banner, title, desc, cta, disabled, onClick }) {
    return (
      <button
        key={key}
        className={`content-card-v2 lesson-card${disabled ? " lesson-card-disabled" : ""}`}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={{ "--accent": series.color }}
      >
        <div className="card-banner-strip">
          <span>{banner}</span>
          <svg className="card-banner-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="content-card-v2-body">
          <h3>{title}</h3>
          <p className="series-levels">{desc}</p>
          <span className="btn btn-primary lesson-card-cta">{cta}</span>
        </div>
      </button>
    );
  }

  // Bấm vào 1 bài: MẶC ĐỊNH KHOÁ. Học sinh chỉ vào được khi giáo viên đã MỞ đúng bài này cho lớp của em (còn
  // hạn, còn lượt) và em nhập đúng mật khẩu vào bài (nếu có) — xem lib/openings.js. Lỗi mạng cũng chặn (không
  // cho qua khi không kiểm tra được). Admin/teacher và tài khoản tester vào thẳng, không cần mở.
  // kind: xem OPENING_KINDS; test: { id, title }; launch(opening|null): mở bài thật.
  async function guardStart(kind, test, launch) {
    if (isStaff || isTester) {
      setActiveOpening(null);
      launch(null);
      return;
    }
    setCheckingAttempts(true);
    let result;
    try {
      result = await checkOpening(
        { uid: user?.uid, className: profile?.className },
        { seriesId: series.id, level: level.number, kind, testId: test.id }
      );
    } catch {
      setBlocked({ title: "Không kiểm tra được 🐝", message: "Có vẻ mạng đang lỗi — con thử lại sau nhé." });
      return;
    } finally {
      setCheckingAttempts(false);
    }
    if (!result.ok) {
      setBlocked({ title: result.title, message: result.message });
      return;
    }
    if (result.opening.passwordHash) {
      setGate({ opening: result.opening, title: test.title, launch });
    } else {
      setActiveOpening(result.opening);
      launch(result.opening);
    }
  }

  function requestStart(type, test) {
    if (type === "listening") {
      setListeningActive(true);
      return;
    }
    guardStart(type, test, () => performStart(type, test));
  }

  function performStart(type, test) {
    if (type === "speaking") {
      setSelectedTest(test);
      setSpeakingActive(true);
    } else if (type === "reading") {
      setSelectedReadingTest(test);
      setReadingActive(true);
    } else if (type === "dictation") {
      setSelectedDictationTest(test);
      setDictationActive(true);
    }
  }

  function testCard(t) {
    return lessonCard({
      key: t.id,
      banner: "Speaking",
      title: t.title,
      desc: "Luyện nói cùng giám khảo ong, đúng cấu trúc đề thi Cambridge YLE",
      cta: !t.scenes?.length ? "Chưa có scene" : checkingAttempts ? "Đang kiểm tra..." : "Bắt đầu luyện nói",
      disabled: !t.scenes?.length || checkingAttempts,
      onClick: () => requestStart("speaking", t),
    });
  }

  function readingTestCard(t) {
    return lessonCard({
      key: t.id,
      banner: "Đọc & Viết",
      title: t.title,
      desc: "Đọc & viết theo đúng đề thi Cambridge YLE",
      cta: !t.parts?.length ? "Chưa có Part" : checkingAttempts ? "Đang kiểm tra..." : "Bắt đầu làm bài",
      disabled: !t.parts?.length || checkingAttempts,
      onClick: () => requestStart("reading", t),
    });
  }

  function dictationTestCard(t) {
    return lessonCard({
      key: t.id,
      banner: "Dictation",
      title: t.title,
      desc: "Nghe từng câu rồi gõ lại đúng như con nghe được",
      cta: !t.sentences?.length ? "Chưa có câu" : checkingAttempts ? "Đang kiểm tra..." : "Bắt đầu luyện nghe",
      disabled: !t.sentences?.length || checkingAttempts,
      onClick: () => requestStart("dictation", t),
    });
  }

  // ---------- IELTS: màn chọn kỹ năng (Reading/Listening/Writing/Speaking/Dictation) ----------
  // Chỉ hiện tên kỹ năng, không cần mô tả/CTA rườm rà (phản hồi người dùng 2026-09-11) — dùng
  // đúng kiểu thẻ đơn giản như màn chọn cấp độ (content-card-v2-center).
  const IELTS_SKILLS = [
    { key: "reading", label: "Reading" },
    { key: "listening", label: "Listening" },
    { key: "writing", label: "Writing" },
    { key: "speaking", label: "Speaking" },
    { key: "dictation", label: "Dictation" },
  ];
  if (isIelts && !selectedIeltsSkill) {
    return (
      <LessonShell
        step={2}
        title={`${series.title} ${level.number}`}
        subtitle="Chọn mục muốn luyện"
        backLabel="Bộ đề khác"
        onBack={backToLevelList}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
        dark
      >
        {/* Nhãn kỹ năng (Reading/Listening/...) cố định, không phụ thuộc `content` Firestore — hiện
            ngay lập tức thay vì chờ tải xong mới hiện (bug phát hiện 2026-09-11: màn này bị đứng
            khựng vài trăm ms sau khi bấm vào 1 cấp độ, dữ liệu thật chỉ cần có SAU khi bấm tiếp
            vào 1 kỹ năng, ví dụ Reading). */}
          <div className="content-grid content-grid-4">
            {IELTS_SKILLS.map(s => (
              <button
                key={s.key}
                className="content-card-v2 content-card-v2-center ielts-skill-tile"
                onClick={() => setSelectedIeltsSkill(s.key)}
                style={{ "--accent": series.color }}
              >
                <span className="ielts-skill-tile-label">{s.label}</span>
              </button>
            ))}
          </div>
      </LessonShell>
    );
  }

  // ---------- IELTS Reading: màn chọn Test 1-4 ----------
  if (isIelts && selectedIeltsSkill === "reading") {
    return (
      <LessonShell
        step={2}
        title={`${series.title} ${level.number} · Reading`}
        subtitle="Chọn Test & Passage"
        backLabel="Quay lại"
        onBack={() => setSelectedIeltsSkill(null)}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
        dark
      >
        <div className="ielts-testpicker-tabs">
          {Array.from({ length: 4 }, (_, i) => i + 1).map(n => {
            const t = practiceTests.find(pt => pt.id === `test${n}`);
            return (
              <button
                key={`reading-test-tab${n}`}
                type="button"
                className={`ielts-testpicker-tab${selectedReadingTestN === n ? " is-active" : ""}${!t ? " is-empty" : ""}`}
                onClick={() => setSelectedReadingTestN(n)}
              >
                Test {n}
              </button>
            );
          })}
        </div>

        <div className="content-grid content-grid-4">
          {Array.from({ length: 3 }, (_, i) => i + 1).map(n => {
            const test = practiceTests.find(pt => pt.id === `test${selectedReadingTestN}`);
            const p = test?.passages?.[n - 1];
            function openPassage(mode) {
              const launch = opening => {
                setActiveIeltsPracticeMode(mode);
                setActiveIeltsPracticeTest({
                  ...test,
                  timeLimitMinutes: opening?.timeLimitMinutes ?? test.timeLimitMinutes,
                  title: `${test.title} · Passage ${n}`,
                  passages: [p],
                });
              };
              // "Đọc hiểu" chỉ là chế độ học (không chấm điểm) nên không cần mở; "Luyện đề" thì phải được giáo viên mở.
              if (mode === "practice") guardStart("ielts-reading", { id: test.id, title: test.title }, launch);
              else launch(null);
            }
            return (
              <div className="content-card-v2 lesson-card-split" key={`passage${n}`} style={{ "--accent": series.color }}>
                <div className="card-banner-strip">
                  <span>Passage {n}</span>
                </div>
                <div className="content-card-v2-body">
                  {p ? (
                    <div className="lesson-card-split-ctas">
                      <button type="button" className="btn btn-secondary" onClick={() => openPassage("comprehension")}>Đọc hiểu</button>
                      <button type="button" className="btn btn-primary" onClick={() => openPassage("practice")}>Luyện đề</button>
                    </div>
                  ) : (
                    <span className="btn btn-primary lesson-card-cta" style={{ opacity: 0.6, cursor: "default" }}>Chưa có nội dung</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </LessonShell>
    );
  }

  // ---------- IELTS Listening: màn chọn Test 1-4 ----------
  if (isIelts && selectedIeltsSkill === "listening") {
    return (
      <LessonShell
        step={2}
        title={`${series.title} ${level.number} · Listening`}
        subtitle="Chọn Test muốn làm"
        backLabel="Quay lại"
        onBack={() => setSelectedIeltsSkill(null)}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
        dark
      >
        <div className="content-grid content-grid-4">
          {Array.from({ length: 4 }, (_, i) => i + 1).map(n => {
            const t = ieltsListeningTests.find(lt => lt.id === `test${n}`);
            return lessonCard({
              key: `listening-test${n}`,
              banner: `Test ${n}`,
              title: t?.title ?? `Listening Test ${n}`,
              desc: "Nghe + câu hỏi chấm điểm, đủ dạng như đề thi thật",
              cta: t ? "Bắt đầu làm bài" : "Chưa có nội dung",
              disabled: !t,
              onClick: () => guardStart("ielts-listening", { id: t.id, title: t.title }, () => setPickingListeningTest(t)),
            });
          })}
        </div>
      </LessonShell>
    );
  }

  // ---------- IELTS Writing/Speaking: chưa triển khai ----------
  if (isIelts && (selectedIeltsSkill === "writing" || selectedIeltsSkill === "speaking")) {
    return (
      <LessonShell
        step={2}
        title={`${series.title} ${level.number} · ${selectedIeltsSkill === "writing" ? "Writing" : "Speaking"}`}
        backLabel="Quay lại"
        onBack={() => setSelectedIeltsSkill(null)}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
        dark
      >
        <InfoCard text="Sắp ra mắt — đang phát triển." />
      </LessonShell>
    );
  }

  // ---------- IELTS Dictation: dùng chung cơ chế với YLE ----------
  if (isIelts && selectedIeltsSkill === "dictation") {
    return (
      <LessonShell
        step={2}
        title={`${series.title} ${level.number} · Dictation`}
        backLabel="Quay lại"
        onBack={() => setSelectedIeltsSkill(null)}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
        dark
      >
        {dictationTests.length === 0 ? (
          <InfoCard text="Chưa có bài Dictation nào — vào Quản trị để soạn bài." />
        ) : (
          <div className="content-grid content-grid-4">{dictationTests.slice(0, 4).map(dictationTestCard)}</div>
        )}
      </LessonShell>
    );
  }

  // ---------- YLE: màn chọn kỹ năng (thẻ tối giản), bấm vào mới hiện danh sách bài ----------
  const YLE_SKILLS = [
    { key: "listening", label: "Listening" },
    { key: "speaking", label: "Speaking" },
    { key: "reading", label: "Reading & Writing" },
    { key: "dictation", label: "Dictation" },
  ];
  if (!selectedSkill) {
    return (
      <LessonShell
        step={2}
        title={`${series.title} · Cấp ${level.number}`}
        subtitle="Chọn kỹ năng muốn luyện"
        backLabel="Cấp khác"
        onBack={backToLevelList}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
        dark
      >
        <div className="content-grid content-grid-4 yle-skill-grid">
          {YLE_SKILLS.map(sk => (
            <button
              key={sk.key}
              className="content-card-v2 content-card-v2-center ielts-skill-tile"
              onClick={() => {
                // Listening: vào thẳng màn 2 tab (Luyện nghe / Luyện đề), không qua thẻ trung gian.
                if (sk.key === "listening") requestStart("listening");
                else setSelectedSkill(sk.key);
              }}
              style={{ "--accent": series.color }}
            >
              <span className="ielts-skill-tile-label">{sk.label}</span>
            </button>
          ))}
        </div>
      </LessonShell>
    );
  }

  const skillLabel = YLE_SKILLS.find(sk => sk.key === selectedSkill)?.label;
  return (
    <LessonShell
      step={2}
      title={`${series.title} · Cấp ${level.number} · ${skillLabel}`}
      backLabel="Quay lại"
      onBack={() => setSelectedSkill(null)}
      onNavigate={onNavigate}
      onStepClick={goToWizardStep}
      dark
    >
      {!content ? (
        <ContentSkeleton />
      ) : selectedSkill === "speaking" ? (
        tests.length === 0 ? (
          <InfoCard text="Bài Speaking cấp độ này chưa có dữ liệu thật." />
        ) : (
          <div className="content-grid content-grid-4">{tests.map(testCard)}</div>
        )
      ) : selectedSkill === "reading" ? (
        readingTests.length === 0 ? (
          <InfoCard text="Bài Reading & Writing cấp độ này chưa có dữ liệu thật." />
        ) : (
          <div className="content-grid content-grid-4">{readingTests.map(readingTestCard)}</div>
        )
      ) : dictationTests.length === 0 ? (
        <InfoCard text="Bài Dictation cấp độ này chưa có dữ liệu thật." />
      ) : (
        <div className="content-grid content-grid-4">{dictationTests.map(dictationTestCard)}</div>
      )}
    </LessonShell>
  );
}
