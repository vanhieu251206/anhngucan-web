import { useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import { YLE_SERIES } from "../lib/yleData.js";
import { stopCurrent } from "../lib/speech.js";
import { loadLevelContent } from "../lib/lessons.js";
import ListeningMode from "../components/ListeningMode.jsx";
import SceneRunner from "../components/SceneRunner.jsx";
import ReadingRunner from "../components/ReadingRunner.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { getAttemptCount } from "../lib/attempts.js";
import { getClassAssignment } from "../lib/classAssignments.js";
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

// 1 nhóm bài học riêng biệt (Listening hoặc Speaking) — tiêu đề mục nằm bên trái phía trên,
// KHÔNG gộp chung Listening/Speaking vào 1 lưới.
function LessonSection({ title, children }) {
  return (
    <div className="lesson-section">
      <h2 className="lesson-section-title">{title}</h2>
      {children}
    </div>
  );
}

// Đường kẻ phân cách giữa 2 nhóm — có chữ "Xem tất cả" ở giữa khi nhóm phía trên còn ẩn bớt bài
// (giống dải phân cách trong ảnh tham khảo người dùng gửi).
function SectionDivider({ onViewAll }) {
  return (
    <div className="lesson-divider">
      {onViewAll ? (
        <button type="button" className="lesson-divider-link" onClick={onViewAll}>
          Xem tất cả
          <span className="level-section-chevron" aria-hidden="true">▾</span>
        </button>
      ) : (
        <span className="lesson-divider-plain" aria-hidden="true" />
      )}
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
  const [level, setLevel] = useState(() => {
    const n = Number(initialUrlRef.current.get("level"));
    return series.levels.find(l => l.number === n) ?? null;
  });
  const [content, setContent] = useState(null); // { listening, tests, readingTests } — đọc qua lib/lessons.js
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedReadingTest, setSelectedReadingTest] = useState(null);
  // true khi đang chạy bài Speaking toàn màn hình (SceneRunner) — không còn bước "Chọn dạng bài"
  // riêng, Listening + Speaking hiện luôn cùng lúc trên màn hình chọn cấp độ (xem yêu cầu rút gọn).
  const [speakingActive, setSpeakingActive] = useState(false);
  // true khi đang chạy bài Reading & Writing toàn màn hình (ReadingRunner).
  const [readingActive, setReadingActive] = useState(false);
  // true khi đang xem chi tiết Listening (bấm vào thẻ Listening trên màn "Bài học").
  const [listeningActive, setListeningActive] = useState(false);
  // Đang xem trang "Xem tất cả Test" của Speaking (khi 1 cấp độ có nhiều Test) — false = màn
  // "Bài học" gọn mặc định, chỉ hiện 2 Test đầu.
  const [viewAllTests, setViewAllTests] = useState(false);
  const { user, isStaff, isAdmin, profile } = useAuth();
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

  // Rời khỏi màn "1 cấp độ" (đổi cấp khác / về bộ đề khác) — quay lại màn chọn cấp.
  function backToLevelList() {
    stopCurrent();
    setSelectedTest(null);
    setSelectedReadingTest(null);
    setSpeakingActive(false);
    setReadingActive(false);
    setListeningActive(false);
    setViewAllTests(false);
    setLevel(null);
  }

  // Thoát khỏi bài Speaking toàn màn hình (SceneRunner), quay lại màn "Bài học" — KHÔNG tính là
  // 1 lượt nộp bài (bấm "Quay lại" giữa chừng khác với nộp bài thật, xem incrementAttempt() gọi
  // trong SceneRunner.jsx khi thật sự hoàn thành).
  function exitSpeaking() {
    stopCurrent();
    setSpeakingActive(false);
    setSelectedTest(null);
    setViewAllTests(false);
  }

  // Thoát khỏi bài Reading & Writing toàn màn hình (ReadingRunner), quay lại màn "Bài học" —
  // tương tự exitSpeaking, KHÔNG tính lượt (lượt tính lúc bấm "Nộp bài" bên trong ReadingRunner).
  function exitReading() {
    stopCurrent();
    setReadingActive(false);
    setSelectedReadingTest(null);
  }

  // Thoát khỏi màn chi tiết Listening, quay lại màn "Bài học".
  function exitListening() {
    stopCurrent();
    setListeningActive(false);
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

  // ---------- Bước 1: chọn cấp độ ----------
  if (!level) {
    return (
      <LessonShell
        step={1}
        title={series.title}
        subtitle="Chọn cấp độ muốn luyện"
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
                <p className="series-levels">Listening · Speaking</p>
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
          />
        </div>
      </div>
    );
  }

  // ---------- Chi tiết Listening (bấm vào thẻ Listening) ----------
  if (listeningActive && content?.listening?.length) {
    return (
      <LessonShell
        step={2}
        title={`${series.title} · Cấp ${level.number} · Listening`}
        backLabel="Quay lại"
        onBack={exitListening}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
      >
        <ListeningMode listening={content.listening} />
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

  // Bấm vào 1 bài (Listening/Speaking/Reading) — học sinh (không phải admin/teacher) phải qua 2
  // lớp kiểm tra trước khi vào: (1) giáo viên đã MỞ đúng bài này cho lớp mình chưa
  // (classAssignments/{className}, xem lib/classAssignments.js — áp dụng CẢ 3 loại bài, chốt
  // 2026-08-27); (2) riêng Speaking/Reading còn kiểm tra thêm số lượt đã nộp bài
  // (test.maxAttempts). Admin/teacher luôn bỏ qua cả 2 lớp kiểm tra.
  async function requestStart(type, test) {
    if (isStaff) {
      performStart(type, test);
      return;
    }
    setCheckingAttempts(true);
    try {
      const assignment = await getClassAssignment(profile?.className);
      // Hết hạn (assignment.expiresAt, giáo viên đặt lúc mở bài, tuỳ chọn) coi như CHƯA MỞ —
      // giáo viên không cần nhớ bấm "Đóng" tay (chốt 2026-08-27).
      const isExpired = assignment?.expiresAt && assignment.expiresAt.toDate() < new Date();
      const isAssigned =
        assignment &&
        !isExpired &&
        assignment.seriesId === series.id &&
        assignment.level === level.number &&
        assignment.mode === type &&
        (type === "listening" || assignment.testId === test?.id);
      if (!isAssigned) {
        setBlocked({
          title: "Chưa được mở bài này 🐝",
          message: "Giáo viên chưa mở bài này cho lớp của con — hỏi giáo viên nhé.",
        });
        return;
      }
      // Số lượt tối đa: ưu tiên số RIÊNG cho lần mở bài này (assignment.maxAttempts), không có thì
      // dùng số mặc định của cả Test (test.maxAttempts).
      const maxAttempts = assignment.maxAttempts ?? test?.maxAttempts;
      if ((type === "speaking" || type === "reading") && maxAttempts) {
        const count = await getAttemptCount(user.uid, type, test.id);
        if (count >= maxAttempts) {
          setBlocked({
            title: "Hết lượt làm bài rồi 🐝",
            message: `"${test.title}" chỉ được làm tối đa ${maxAttempts} lượt — con đã nộp bài ${count}/${maxAttempts} lần. Nếu cần làm lại, hãy nhờ giáo viên hỗ trợ nhé.`,
          });
          return;
        }
      }
    } catch {
      // Không kiểm tra được (mất mạng...) — vẫn cho vào bài, không chặn oan học sinh vì lỗi mạng.
    } finally {
      setCheckingAttempts(false);
    }
    performStart(type, test);
  }

  function performStart(type, test) {
    if (type === "speaking") {
      setSelectedTest(test);
      setSpeakingActive(true);
    } else if (type === "reading") {
      setSelectedReadingTest(test);
      setReadingActive(true);
    } else if (type === "listening") {
      setListeningActive(true);
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

  // ---------- Trang "Xem tất cả Test" của Speaking (khi 1 cấp độ có nhiều hơn 2 Test) ----------
  if (viewAllTests && tests.length > 0) {
    return (
      <LessonShell
        step={2}
        title={`${series.title} · Cấp ${level.number} · Speaking`}
        subtitle="Tất cả Test"
        backLabel="Quay lại"
        onBack={() => setViewAllTests(false)}
        onNavigate={onNavigate}
        onStepClick={goToWizardStep}
        dark
      >
        <div className="content-grid content-grid-4">{tests.map(testCard)}</div>
      </LessonShell>
    );
  }

  const listeningCard = lessonCard({
    key: "listening",
    banner: "Listening",
    title: `${series.title} ${level.number}`,
    desc: "Xem video và luyện nghe theo đúng đề thi Cambridge YLE",
    cta: content?.listening?.length ? "Xem video" : "Chưa có video",
    disabled: !content?.listening?.length,
    onClick: () => requestStart("listening"),
  });

  return (
    <LessonShell
      step={2}
      title={`${series.title} · Cấp ${level.number}`}
      subtitle="Toàn bộ bài học đã có của cấp độ này"
      backLabel="Cấp khác"
      onBack={backToLevelList}
      onNavigate={onNavigate}
      onStepClick={goToWizardStep}
      dark
    >
      {!content ? (
        <ContentSkeleton />
      ) : (
        <>
          <LessonSection title="Listening">
            <div className="content-grid content-grid-4">{listeningCard}</div>
          </LessonSection>

          <SectionDivider onViewAll={tests.length > 3 ? () => setViewAllTests(true) : null} />

          <LessonSection title="Speaking">
            {tests.length === 0 ? (
              <InfoCard text="Bài Speaking cấp độ này chưa có dữ liệu thật." />
            ) : (
              <div className="content-grid content-grid-4">{tests.slice(0, 3).map(testCard)}</div>
            )}
          </LessonSection>

          <SectionDivider />

          <LessonSection title="Reading & Writing">
            {readingTests.length === 0 ? (
              <InfoCard text="Bài Reading & Writing cấp độ này chưa có dữ liệu thật." />
            ) : (
              <div className="content-grid content-grid-4">{readingTests.slice(0, 3).map(readingTestCard)}</div>
            )}
          </LessonSection>
        </>
      )}
    </LessonShell>
  );
}
