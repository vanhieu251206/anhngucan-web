import { useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import { YLE_SERIES } from "../lib/yleData.js";
import { stopCurrent } from "../lib/speech.js";
import { loadLevelContent } from "../lib/lessons.js";
import ListeningMode from "../components/ListeningMode.jsx";
import SceneRunner from "../components/SceneRunner.jsx";
import PasswordGate from "../components/PasswordGate.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { isUnlockedInSession, lockSession } from "../lib/lessonAccess.js";
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
        <div className="dark-hero-inner">
          <button className="lesson-back-link" onClick={onBack}>
            ⬅ {backLabel}
          </button>
          <h1 className="dark-hero-title">{title}</h1>
          {subtitle && <p className="dark-hero-subtitle">{subtitle}</p>}
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
  const [content, setContent] = useState(null); // { listening, tests } — đọc qua lib/lessons.js
  const [selectedTest, setSelectedTest] = useState(null);
  // true khi đang chạy bài Speaking toàn màn hình (SceneRunner) — không còn bước "Chọn dạng bài"
  // riêng, Listening + Speaking hiện luôn cùng lúc trên màn hình chọn cấp độ (xem yêu cầu rút gọn).
  const [speakingActive, setSpeakingActive] = useState(false);
  // true khi đang xem chi tiết Listening (bấm vào thẻ Listening trên màn "Bài học").
  const [listeningActive, setListeningActive] = useState(false);
  // Đang xem trang "Xem tất cả Test" của Speaking (khi 1 cấp độ có nhiều Test) — false = màn
  // "Bài học" gọn mặc định, chỉ hiện 2 Test đầu.
  const [viewAllTests, setViewAllTests] = useState(false);
  const { isStaff } = useAuth();

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
  // Guest/học sinh: khoá nội dung thật (Listening/Speaking) sau 1 mật khẩu chung, xem
  // PasswordGate.jsx + lib/lessonAccess.js. Admin/teacher tự động bỏ qua màn khoá.
  const [unlocked, setUnlocked] = useState(() => isStaff || isUnlockedInSession());
  useEffect(() => {
    if (isStaff) setUnlocked(true);
  }, [isStaff]);

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

  // Rời khỏi màn "1 cấp độ" (đổi cấp khác / về bộ đề khác) — khoá lại nội dung, bắt nhập mật khẩu
  // mỗi lần vào lại. Admin/teacher (isStaff) không bị ảnh hưởng, luôn bỏ qua màn khoá.
  function backToLevelList() {
    stopCurrent();
    setSelectedTest(null);
    setSpeakingActive(false);
    setListeningActive(false);
    setViewAllTests(false);
    if (!isStaff) {
      lockSession();
      setUnlocked(false);
    }
    setLevel(null);
  }

  // Thoát khỏi bài Speaking toàn màn hình (SceneRunner), quay lại màn "Bài học" — khoá lại
  // nội dung như khi rời hẳn cấp độ, để nhất quán với hành vi Listening.
  function exitSpeaking() {
    stopCurrent();
    setSpeakingActive(false);
    setSelectedTest(null);
    setViewAllTests(false);
    if (!isStaff) {
      lockSession();
      setUnlocked(false);
    }
  }

  // Thoát khỏi màn chi tiết Listening, quay lại màn "Bài học".
  function exitListening() {
    stopCurrent();
    setListeningActive(false);
    if (!isStaff) {
      lockSession();
      setUnlocked(false);
    }
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
                <span>Cấp {l.number}</span>
              </div>
              <div className="content-card-v2-body">
                <span className="level-card-badge">{l.number}</span>
                <h3>Cấp {l.number}</h3>
                <p className="series-levels">Listening · Speaking</p>
              </div>
            </button>
          ))}
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
          <SceneRunner scenes={activeTest.scenes} onFinish={exitSpeaking} />
        </div>
      </div>
    );
  }

  // ---------- Chi tiết Listening (bấm vào thẻ Listening) ----------
  if (listeningActive && content?.listening) {
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

  function testCard(t) {
    return lessonCard({
      key: t.id,
      banner: "Speaking",
      title: t.title,
      desc: `${t.scenes?.length ?? 0} scene · Luyện nói cùng giám khảo ong`,
      cta: t.scenes?.length ? "Bắt đầu luyện nói" : "Chưa có scene",
      disabled: !t.scenes?.length,
      onClick: () => {
        setSelectedTest(t);
        setSpeakingActive(true);
      },
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
    title: `${series.title} ${level.number} · Listening`,
    desc: "Xem video và luyện nghe",
    cta: content?.listening ? "Xem video" : "Chưa có video",
    disabled: !content?.listening,
    onClick: () => setListeningActive(true),
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
      {!isStaff && !unlocked ? (
        <PasswordGate onUnlock={() => setUnlocked(true)} />
      ) : !content ? (
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
        </>
      )}
    </LessonShell>
  );
}
