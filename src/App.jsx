import { useEffect, useState } from "react";
import { loadAllLessons } from "./lib/sheetLoader.js";
import VocabMode from "./components/VocabMode.jsx";
import DragDropMode from "./components/DragDropMode.jsx";
import SpeakingMode from "./components/SpeakingMode.jsx";

const MODES = [
  { key: "vocab", label: "🃏 Thẻ từ vựng", title: "Thẻ từ vựng" },
  { key: "dragdrop", label: "🖐️ Kéo thả đồ vật", title: "Kéo đồ vật vào đúng ô" },
  { key: "speaking", label: "🎤 Luyện nói", title: "Luyện nói - Đọc đúng câu" },
];

export default function App() {
  const [lessons, setLessons] = useState(null);
  const [error, setError] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [mode, setMode] = useState(null);

  useEffect(() => {
    loadAllLessons()
      .then(setLessons)
      .catch(err => setError(err.message));
  }, []);

  return (
    <>
      <header>
        <h1>📚 Học Tiếng Anh cùng Cô Cần</h1>
      </header>

      <main id="app">
        {error && (
          <section id="load-error">
            <p>❌ Không tải được bài học. Kiểm tra kết nối mạng hoặc cấu hình Sheet.</p>
            <p className="error-detail">{error}</p>
          </section>
        )}

        {!error && !lessons && (
          <section id="loading">
            <p>⏳ Đang tải bài học...</p>
          </section>
        )}

        {lessons && !lesson && (
          <section id="lesson-menu">
            <h2>Chọn bài học</h2>
            <div className="menu-cards">
              {lessons.map(l => (
                <button key={l.id} className="menu-card" onClick={() => setLesson(l)}>
                  {l.title}
                </button>
              ))}
            </div>
          </section>
        )}

        {lesson && !mode && (
          <section id="menu">
            <h2>Chọn bài tập</h2>
            <div className="menu-cards">
              {MODES.map(m => (
                <button key={m.key} className="menu-card" onClick={() => setMode(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            <button className="back-btn" onClick={() => setLesson(null)}>
              ⬅ Chọn bài khác
            </button>
          </section>
        )}

        {lesson && mode && (
          <section className="mode">
            <h2>{MODES.find(m => m.key === mode).title}</h2>
            {mode === "vocab" && <VocabMode lesson={lesson} />}
            {mode === "dragdrop" && <DragDropMode lesson={lesson} />}
            {mode === "speaking" && (
              <SpeakingMode lesson={lesson} onFinish={() => setMode(null)} />
            )}
            <button className="back-btn" onClick={() => setMode(null)}>
              ⬅ Quay lại
            </button>
          </section>
        )}
      </main>
    </>
  );
}
