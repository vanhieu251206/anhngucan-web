import { useState } from "react";
import { YLE_SERIES } from "../lib/yleData.js";
import ListeningMode from "../components/ListeningMode.jsx";
import SpeakingMode from "../components/SpeakingMode.jsx";
import SceneRunner from "../components/SceneRunner.jsx";

const TYPES = [
  { key: "listening", label: "Listening", desc: "Xem video và luyện nghe" },
  { key: "speaking", label: "Speaking", desc: "Luyện nói, app chấm đúng/sai" },
];

export default function LessonsPage() {
  const [series, setSeries] = useState(null);
  const [level, setLevel] = useState(null);
  const [type, setType] = useState(null);
  const [part1Done, setPart1Done] = useState(false);

  function openType(t, l) {
    setType(t);
    setPart1Done(!l.speakingPart1);
  }

  return (
    <section className="section narrow">
      <p className="mock-banner">
        Đang hiển thị dữ liệu mẫu (video và câu hỏi luyện nói là placeholder).
      </p>

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
                onClick={() => openType(t.key, level)}
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

      {series && level && type && (
        <>
          <h1 className="page-title">
            {series.title} {level.number} – {type === "listening" ? "Listening" : "Speaking"}
          </h1>
          {type === "listening" && <ListeningMode listening={level.listening} />}
          {type === "speaking" && !part1Done && (
            <SceneRunner scenes={level.speakingPart1} onFinish={() => setPart1Done(true)} />
          )}
          {type === "speaking" && part1Done && (
            <SpeakingMode
              lesson={{ speaking: level.speaking }}
              onFinish={() => setType(null)}
            />
          )}
          <button className="back-btn" onClick={() => setType(null)}>
            ⬅ Quay lại
          </button>
        </>
      )}
    </section>
  );
}
