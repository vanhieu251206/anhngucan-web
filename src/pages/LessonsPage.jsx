import { useEffect, useState } from "react";
import { YLE_SERIES } from "../lib/yleData.js";
import { stopCurrent } from "../lib/speech.js";
import ListeningMode from "../components/ListeningMode.jsx";
import SceneRunner from "../components/SceneRunner.jsx";
import PasswordGate from "../components/PasswordGate.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { isUnlockedInSession } from "../lib/lessonAccess.js";

const TYPES = [
  { key: "listening", label: "Listening", desc: "Xem video và luyện nghe" },
  { key: "speaking", label: "Speaking", desc: "Luyện nói, app chấm đúng/sai" },
];

export default function LessonsPage() {
  const [series, setSeries] = useState(null);
  const [level, setLevel] = useState(null);
  const [type, setType] = useState(null);
  const { isStaff } = useAuth();
  // Guest/học sinh: khoá nội dung thật (Listening/Speaking) sau 1 mật khẩu chung, xem
  // PasswordGate.jsx + lib/lessonAccess.js. Admin/teacher tự động bỏ qua màn khoá.
  const [unlocked, setUnlocked] = useState(() => isStaff || isUnlockedInSession());
  useEffect(() => {
    if (isStaff) setUnlocked(true);
  }, [isStaff]);

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

      {series && level && type === "listening" && !unlocked && (
        <>
          <PasswordGate onUnlock={() => setUnlocked(true)} />
          <button className="back-btn" onClick={() => setType(null)}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "listening" && unlocked && (
        <>
          <h1 className="page-title">{series.title} {level.number} – Listening</h1>
          <ListeningMode listening={level.listening} />
          <button className="back-btn" onClick={() => setType(null)}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "speaking" && !level.speakingPart1 && (
        <>
          <h1 className="page-title">{series.title} {level.number} – Speaking</h1>
          <p className="mock-banner">Bài Speaking cấp độ này chưa có dữ liệu thật.</p>
          <button className="back-btn" onClick={() => setType(null)}>
            ⬅ Quay lại
          </button>
        </>
      )}

      {series && level && type === "speaking" && level.speakingPart1 && !unlocked && (
        <>
          <PasswordGate onUnlock={() => setUnlocked(true)} />
          <button className="back-btn" onClick={() => setType(null)}>
            ⬅ Quay lại
          </button>
        </>
      )}
    </section>

    {series && level && type === "speaking" && level.speakingPart1 && unlocked && (
      <div className="speaking-fullscreen">
        <button
          className="speaking-fullscreen-back"
          onClick={() => {
            stopCurrent();
            setType(null);
          }}
        >
          ⬅ Quay lại
        </button>
        <div className="speaking-fullscreen-body">
          <SceneRunner
            scenes={level.speakingPart1}
            onFinish={() => {
              stopCurrent();
              setType(null);
            }}
          />
        </div>
      </div>
    )}
    </>
  );
}
