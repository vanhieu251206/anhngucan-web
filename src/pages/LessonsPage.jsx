import { useEffect, useRef, useState } from "react";
import Logo from "../components/Logo.jsx";
import { YLE_SERIES } from "../lib/yleData.js";
import { stopCurrent } from "../lib/speech.js";
import { loadLevelContent } from "../lib/lessons.js";
import ListeningMode from "../components/ListeningMode.jsx";
import SceneRunner from "../components/SceneRunner.jsx";
import PasswordGate from "../components/PasswordGate.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { isUnlockedInSession, lockSession } from "../lib/lessonAccess.js";
import { readParams, setParams } from "../lib/urlState.js";

const TYPES = [
  {
    key: "listening",
    label: "Listening",
    desc: "Xem video và luyện nghe",
    icon: <path d="M4 14v-2a8 8 0 0 1 16 0v2M2 14h5v7H4a2 2 0 0 1-2-2v-5zM22 14h-5v7h3a2 2 0 0 0 2-2v-5z" />,
  },
  {
    key: "speaking",
    label: "Speaking",
    desc: "Luyện nói, app chấm đúng/sai",
    icon: <path d="M9 2h6v12a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v4" />,
  },
];

// Khung màn hình dùng chung cho mọi bước chọn bài (đồng bộ với .home-screen ở HomePage.jsx):
// logo + 1 nút quay lại ở trên, tiêu đề + phụ đề canh giữa, nội dung bước hiện tại ở dưới.
function LessonShell({ backLabel, onBack, title, subtitle, children }) {
  return (
    <div className="home-screen lessons-screen">
      <div className="home-screen-inner">
        <div className="home-topbar">
          <Logo size={40} />
          <button className="top-nav-login" onClick={onBack}>
            ⬅ {backLabel}
          </button>
        </div>

        <div className="lessons-header">
          <h1 className="lessons-title">{title}</h1>
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>

        {children}
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
  // Đọc cấp độ/loại bài ban đầu từ URL (?level=..&type=..) — để F5 giữa lúc đang chọn bài không
  // bị bật về bước đầu (xem App.jsx cho phần trang tổng, src/lib/urlState.js cho cơ chế chung).
  const initialUrlRef = useRef(readParams());
  const [level, setLevel] = useState(() => {
    const n = Number(initialUrlRef.current.get("level"));
    return series.levels.find(l => l.number === n) ?? null;
  });
  const [type, setType] = useState(() => initialUrlRef.current.get("type") || null);
  const [content, setContent] = useState(null); // { listening, tests } — đọc qua lib/lessons.js
  const [selectedTest, setSelectedTest] = useState(null);
  const { isStaff } = useAuth();

  useEffect(() => {
    setParams({ level: level ? level.number : null, type: type || null, test: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, type]);

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
  // Listening lẫn Speaking, không phụ thuộc `type` để không phải tải lại khi đổi qua lại.
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
  }, [type]);

  function backToTypePicker() {
    stopCurrent();
    setType(null);
    setSelectedTest(null);
    // Guest/học sinh: khoá lại ngay khi thoát bài, bắt nhập mật khẩu mỗi lần vào lại — admin/teacher
    // (isStaff) không bị ảnh hưởng, luôn bỏ qua màn khoá.
    if (!isStaff) {
      lockSession();
      setUnlocked(false);
    }
  }

  const tests = content?.tests ?? [];
  // Cấp độ chỉ có 1 Test (trường hợp phổ biến hiện tại) → tự chọn luôn, không hiện thêm bước chọn.
  const autoTest = tests.length === 1 ? tests[0] : null;
  const activeTest = selectedTest ?? autoTest;

  // ---------- Bước 1: chọn cấp độ ----------
  if (!level) {
    return (
      <LessonShell
        title={series.title}
        subtitle="Chọn cấp độ muốn luyện"
        backLabel="Bộ đề khác"
        onBack={() => onNavigate("home")}
      >
        <div className="level-grid">
          {series.levels.map(l => (
            <button
              key={l.id}
              className="series-card level-card"
              onClick={() => setLevel(l)}
              style={{ "--accent": series.color }}
            >
              <span className="level-card-badge">{l.number}</span>
              <h3>Cấp {l.number}</h3>
              <p className="series-levels">Listening · Speaking</p>
            </button>
          ))}
        </div>
      </LessonShell>
    );
  }

  // ---------- Bước 2: chọn Listening / Speaking ----------
  if (!type) {
    return (
      <LessonShell
        title={`${series.title} · Cấp ${level.number}`}
        subtitle="Chọn phần muốn luyện"
        backLabel="Cấp khác"
        onBack={() => setLevel(null)}
      >
        <div className="level-grid two-col">
          {TYPES.map(t => (
            <button
              key={t.key}
              className="series-card"
              onClick={() => setType(t.key)}
              style={{ "--accent": series.color }}
            >
              <span className="series-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {t.icon}
                </svg>
              </span>
              <h3>{t.label}</h3>
              <p className="series-levels">{t.desc}</p>
            </button>
          ))}
        </div>
      </LessonShell>
    );
  }

  // ---------- Listening ----------
  if (type === "listening") {
    if (content && !content.listening) {
      return (
        <LessonShell title={`${series.title} ${level.number} · Listening`} backLabel="Quay lại" onBack={backToTypePicker}>
          <InfoCard text="Cấp độ này chưa có video Listening thật." />
        </LessonShell>
      );
    }
    if (content?.listening && !unlocked) {
      return (
        <LessonShell title={`${series.title} ${level.number} · Listening`} backLabel="Quay lại" onBack={backToTypePicker}>
          <PasswordGate onUnlock={() => setUnlocked(true)} />
        </LessonShell>
      );
    }
    if (content?.listening && unlocked) {
      return (
        <LessonShell title={`${series.title} ${level.number} · Listening`} backLabel="Quay lại" onBack={backToTypePicker}>
          <ListeningMode listening={content.listening} />
        </LessonShell>
      );
    }
    return null;
  }

  // ---------- Speaking ----------
  if (content && tests.length === 0) {
    return (
      <LessonShell title={`${series.title} ${level.number} · Speaking`} backLabel="Quay lại" onBack={backToTypePicker}>
        <InfoCard text="Bài Speaking cấp độ này chưa có dữ liệu thật." />
      </LessonShell>
    );
  }

  if (activeTest && !activeTest.scenes?.length) {
    return (
      <LessonShell title={`${series.title} ${level.number} · Speaking`} backLabel="Quay lại" onBack={backToTypePicker}>
        <InfoCard text={`${activeTest.title} chưa có scene nào — vào CMS soạn bài để thêm scene.`} />
      </LessonShell>
    );
  }

  if (tests.length > 1 && !activeTest) {
    return (
      <LessonShell
        title={`${series.title} ${level.number} · Speaking`}
        subtitle="Chọn Test muốn luyện"
        backLabel="Quay lại"
        onBack={backToTypePicker}
      >
        <div className="level-grid">
          {tests.map(t => (
            <button
              key={t.id}
              className="series-card level-card"
              onClick={() => setSelectedTest(t)}
              style={{ "--accent": series.color }}
            >
              <h3>{t.title}</h3>
            </button>
          ))}
        </div>
      </LessonShell>
    );
  }

  if (activeTest && Boolean(activeTest.scenes?.length) && !unlocked) {
    return (
      <LessonShell title={`${series.title} ${level.number} · Speaking`} backLabel="Quay lại" onBack={backToTypePicker}>
        <PasswordGate onUnlock={() => setUnlocked(true)} />
      </LessonShell>
    );
  }

  if (activeTest && Boolean(activeTest.scenes?.length) && unlocked) {
    return (
      <div className="speaking-fullscreen">
        <div className="speaking-fullscreen-topbar">
          <button className="speaking-fullscreen-back" onClick={backToTypePicker}>
            ⬅ Quay lại
          </button>
          <span className="speaking-fullscreen-title">
            {series.title} {level.number} · {activeTest.title}
          </span>
        </div>
        <div className="speaking-fullscreen-body">
          <SceneRunner scenes={activeTest.scenes} onFinish={backToTypePicker} />
        </div>
      </div>
    );
  }

  return null;
}
