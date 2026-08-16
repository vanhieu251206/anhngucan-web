import { useEffect, useState } from "react";
import { YLE_SERIES } from "../lib/yleData.js";
import { stopCurrent } from "../lib/speech.js";
import { loadLevelContent } from "../lib/lessons.js";
import ListeningMode from "../components/ListeningMode.jsx";
import SceneRunner from "../components/SceneRunner.jsx";
import PasswordGate from "../components/PasswordGate.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { isUnlockedInSession, lockSession } from "../lib/lessonAccess.js";

const TYPES = [
  { key: "listening", label: "Listening", desc: "Xem video và luyện nghe" },
  { key: "speaking", label: "Speaking", desc: "Luyện nói, app chấm đúng/sai" },
];

export default function LessonsPage() {
  const [series, setSeries] = useState(null);
  const [level, setLevel] = useState(null);
  const [type, setType] = useState(null);
  const [content, setContent] = useState(null); // { listening, tests } — đọc qua lib/lessons.js
  const [selectedTest, setSelectedTest] = useState(null);
  const { isStaff } = useAuth();
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

  return (
    <>
    <section className="section narrow">
      {!series && (
        <>
          <h1 className="page-title">Chọn bộ đề</h1>
          <p className="lead">Luyện thi theo 3 bộ đề Cambridge YLE.</p>
          <div className="lesson-grid">
            {YLE_SERIES.map(s => (
              <button
                key={s.id}
                className="lesson-preview-card"
                onClick={() => setSeries(s)}
                style={{ "--accent": s.color }}
              >
                <h3>{s.title}</h3>
                <span className="lesson-count">{s.levels.length} cấp độ</span>
              </button>
            ))}
          </div>
        </>
      )}

      {series && !level && (
        <>
          <h1 className="page-title">{series.title}</h1>
          <p className="lead">Chọn cấp độ muốn luyện.</p>
          <div className="lesson-grid">
            {series.levels.map(l => (
              <button
                key={l.id}
                className="lesson-preview-card"
                onClick={() => setLevel(l)}
                style={{ "--accent": series.color }}
              >
                <h3>Cấp {l.number}</h3>
                <span className="lesson-count">Listening · Speaking</span>
              </button>
            ))}
          </div>
          <button className="back-btn" onClick={() => setSeries(null)}>
            ⬅ Chọn bộ đề khác
          </button>
        </>
      )}

      {series && level && !type && (
        <>
          <h1 className="page-title">{series.title} – Cấp {level.number}</h1>
          <p className="lead">Chọn phần muốn luyện.</p>
          <div className="feature-grid">
            {TYPES.map(t => (
              <button
                key={t.key}
                className="feature-card feature-card-btn"
                onClick={() => setType(t.key)}
              >
                <span className="feature-dot" style={{ background: series.color }} />
                <h3>{t.label}</h3>
                <p>{t.desc}</p>
              </button>
            ))}
          </div>
          <button className="back-btn" onClick={() => setLevel(null)}>
            ⬅ Chọn cấp khác
          </button>
        </>
      )}

      {series && level && type === "listening" && content && !content.listening && (
        <>
          <h1 className="page-title">{series.title} {level.number} – Listening</h1>
          <p className="mock-banner">Cấp độ này chưa có video Listening thật.</p>
          <button className="back-btn" onClick={backToTypePicker}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "listening" && content?.listening && !unlocked && (
        <>
          <PasswordGate onUnlock={() => setUnlocked(true)} />
          <button className="back-btn" onClick={backToTypePicker}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "listening" && content?.listening && unlocked && (
        <>
          <h1 className="page-title">{series.title} {level.number} – Listening</h1>
          <ListeningMode listening={content.listening} />
          <button className="back-btn" onClick={backToTypePicker}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "speaking" && content && tests.length === 0 && (
        <>
          <h1 className="page-title">{series.title} {level.number} – Speaking</h1>
          <p className="mock-banner">Bài Speaking cấp độ này chưa có dữ liệu thật.</p>
          <button className="back-btn" onClick={backToTypePicker}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "speaking" && activeTest && !activeTest.scenes?.length && (
        <>
          <h1 className="page-title">{series.title} {level.number} – Speaking</h1>
          <p className="mock-banner">{activeTest.title} chưa có scene nào — vào CMS soạn bài để thêm scene.</p>
          <button className="back-btn" onClick={backToTypePicker}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "speaking" && tests.length > 1 && !activeTest && (
        <>
          <h1 className="page-title">{series.title} {level.number} – Speaking</h1>
          <p className="lead">Chọn Test muốn luyện.</p>
          <div className="lesson-grid">
            {tests.map(t => (
              <button key={t.id} className="lesson-preview-card" onClick={() => setSelectedTest(t)}>
                <h3>{t.title}</h3>
              </button>
            ))}
          </div>
          <button className="back-btn" onClick={backToTypePicker}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "speaking" && activeTest && Boolean(activeTest.scenes?.length) && !unlocked && (
        <>
          <PasswordGate onUnlock={() => setUnlocked(true)} />
          <button className="back-btn" onClick={backToTypePicker}>
            ⬅ Quay lại
          </button>
        </>
      )}
    </section>

    {series && level && type === "speaking" && activeTest && Boolean(activeTest.scenes?.length) && unlocked && (
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
          <SceneRunner
            scenes={activeTest.scenes}
            onFinish={backToTypePicker}
          />
        </div>
      </div>
    )}
    </>
  );
}
