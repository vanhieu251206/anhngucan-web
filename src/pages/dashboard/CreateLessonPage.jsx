import { useEffect, useState } from "react";
import { YLE_SERIES } from "../../lib/yleData.js";
import { useAuth } from "../../lib/authContext.jsx";
import { saveListening, getListening, listTests, getTest, saveTest, deleteTest } from "../../lib/adminLessons.js";
import TestStudio from "../../components/dashboard/TestStudio.jsx";

const MODE_INFO = {
  listening: { label: "Listening", icon: "🎧", desc: "Video nghe" },
  speaking: { label: "Speaking", icon: "🎤", desc: "Luyện nói theo scene" },
};

export default function CreateLessonPage() {
  const { user } = useAuth();
  const [series, setSeries] = useState(null);
  const [level, setLevel] = useState(null);
  const [mode, setMode] = useState(null); // "listening" | "speaking"

  // Đường dẫn từng bước (Bộ đề → Cấp độ → Loại bài) — bấm vào 1 bước trước đó để quay lại
  // ngay, thay vì chỉ có nút "← Quay lại" đơn lẻ ở cuối mỗi màn.
  const crumbs = [
    { label: "Bộ đề", onClick: () => { setSeries(null); setLevel(null); setMode(null); }, active: !series },
  ];
  if (series) {
    crumbs.push({
      label: series.title,
      accent: series.color,
      onClick: () => { setLevel(null); setMode(null); },
      active: !level,
    });
  }
  if (series && level) {
    crumbs.push({
      label: `Cấp ${level.number}`,
      accent: series.color,
      onClick: () => setMode(null),
      active: !mode,
    });
  }
  if (series && level && mode) {
    crumbs.push({ label: MODE_INFO[mode].label, accent: series.color, active: true });
  }

  return (
    <div>
      <Breadcrumb crumbs={crumbs} />
      {!series && <SeriesPicker onPick={setSeries} />}
      {series && !level && <LevelPicker series={series} onPick={setLevel} />}
      {series && level && !mode && <ModePicker series={series} level={level} onPick={setMode} />}
      {series && level && mode === "listening" && (
        <ListeningEditor series={series} level={level} uid={user.uid} />
      )}
      {series && level && mode === "speaking" && (
        <SpeakingEditor series={series} level={level} uid={user.uid} />
      )}
    </div>
  );
}

function Breadcrumb({ crumbs }) {
  return (
    <nav className="admin-breadcrumb" aria-label="Đường dẫn soạn bài">
      {crumbs.map((c, i) => (
        <span key={i} className="admin-breadcrumb-step">
          {i > 0 && <span className="admin-breadcrumb-sep">›</span>}
          {c.onClick && !c.active ? (
            <button
              type="button"
              className="admin-breadcrumb-link"
              style={c.accent ? { "--accent": c.accent } : undefined}
              onClick={c.onClick}
            >
              {c.label}
            </button>
          ) : (
            <span
              className={`admin-breadcrumb-current${c.active ? " is-active" : ""}`}
              style={c.accent ? { "--accent": c.accent } : undefined}
            >
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function SeriesPicker({ onPick }) {
  return (
    <div className="admin-card">
      <h2>Chọn bộ đề</h2>
      <p className="admin-muted-text">Bắt đầu soạn bài bằng cách chọn 1 trong 3 bộ đề Cambridge YLE.</p>
      <div className="admin-picker-grid">
        {YLE_SERIES.map(s => (
          <button
            key={s.id}
            className="admin-picker-tile"
            style={{ "--accent": s.color }}
            onClick={() => onPick(s)}
          >
            <span className="admin-picker-tile-dot" />
            <span className="admin-picker-tile-title">{s.title}</span>
            <span className="admin-picker-tile-meta">{s.levels.length} cấp độ</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LevelPicker({ series, onPick }) {
  return (
    <div className="admin-card">
      <h2>{series.title} — chọn cấp độ</h2>
      <div className="admin-picker-grid">
        {series.levels.map(l => (
          <button
            key={l.id}
            className="admin-picker-tile admin-picker-tile-level"
            style={{ "--accent": series.color }}
            onClick={() => onPick(l)}
          >
            <span className="admin-picker-tile-number">{l.number}</span>
            <span className="admin-picker-tile-title">Cấp {l.number}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModePicker({ series, level, onPick }) {
  return (
    <div className="admin-card">
      <h2>{series.title} {level.number}</h2>
      <div className="admin-picker-grid admin-picker-grid-modes">
        {Object.entries(MODE_INFO).map(([key, info]) => (
          <button
            key={key}
            className="admin-picker-tile admin-picker-tile-mode"
            style={{ "--accent": series.color }}
            onClick={() => onPick(key)}
          >
            <span className="admin-picker-tile-icon">{info.icon}</span>
            <span className="admin-picker-tile-title">{info.label}</span>
            <span className="admin-picker-tile-meta">{info.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ListeningEditor({ series, level, uid }) {
  const [videoId, setVideoId] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    getListening(series.id, level.number).then(l => {
      setVideoId(l?.videoId ?? "");
      setTitle(l?.title ?? "");
      setLoading(false);
    });
  }, [series.id, level.number]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await saveListening(series.id, level.number, { videoId, title }, uid);
    setSaving(false);
    setSaved(true);
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — Listening</h2>
      <form className="admin-form" onSubmit={handleSave}>
        <label>
          YouTube video ID
          <input
            className="admin-input"
            placeholder="vd: M7lc1UVf-VE"
            value={videoId}
            onChange={e => setVideoId(e.target.value)}
          />
        </label>
        <label>
          Tiêu đề hiển thị
          <input
            className="admin-input"
            placeholder="vd: Starters 1 – Test 1"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </label>
        <button className="admin-btn-primary" type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        {saved && <p className="admin-success">✓ Đã lưu</p>}
      </form>
    </div>
  );
}

function SpeakingEditor({ series, level, uid }) {
  const [tests, setTests] = useState(null);
  const [openTestId, setOpenTestId] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [testTitle, setTestTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function reloadTests() {
    listTests(series.id, level.number).then(setTests);
  }
  useEffect(reloadTests, [series.id, level.number]);

  async function openTest(t) {
    const full = await getTest(series.id, level.number, t.id);
    setOpenTestId(t.id);
    setTestTitle(full?.title ?? t.title ?? "");
    setScenes(full?.scenes ?? []);
    setSaved(false);
  }
  // Test nhúng cứng (yleData.js, hiện chỉ Starters cấp 1) luôn dùng id/order cố định "test1"/1 —
  // CMS phải né số này khi đặt id/order cho Test mới, để không vô tình ghi đè đúng bài nhúng cứng
  // (lessons.js giờ GỘP hardcode + Firestore, chỉ Firestore đặt trùng id "test1" mới ghi đè được).
  const reservedTestSlots = level.speakingPart1 ? 1 : 0;

  function openNewTest() {
    const nextOrder = (tests?.length ?? 0) + reservedTestSlots + 1;
    setOpenTestId(`test${nextOrder}`);
    setTestTitle(`Test ${nextOrder}`);
    setScenes([]);
    setSaved(false);
  }

  async function handleDeleteTest(id) {
    if (!window.confirm("Xoá Test này? Không hoàn tác được.")) return;
    await deleteTest(series.id, level.number, id);
    reloadTests();
  }
  async function handleSaveTest() {
    setSaving(true);
    setSaved(false);
    const order = tests?.find(t => t.id === openTestId)?.order ?? (tests?.length ?? 0) + reservedTestSlots + 1;
    await saveTest(series.id, level.number, openTestId, { title: testTitle, order, scenes }, uid);
    setSaving(false);
    setSaved(true);
    reloadTests();
  }

  if (openTestId) {
    return (
      <TestStudio
        accent={series.color}
        title={testTitle}
        onTitleChange={setTestTitle}
        scenes={scenes}
        onScenesChange={setScenes}
        onBack={() => setOpenTestId(null)}
        onSave={handleSaveTest}
        saving={saving}
        saved={saved}
      />
    );
  }

  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — Speaking</h2>
      {tests === null && <LoadingCard inline />}
      {tests && level.speakingPart1 && (
        <div className="admin-info-banner">
          <span className="admin-info-banner-icon">ℹ️</span>
          <p>
            Cấp độ này có sẵn <strong>Test 1</strong> nhúng cứng trong code (11 scene thật, đang hiển thị
            cho học sinh) — CMS chưa sửa được Test đó. Test bạn tạo ở đây sẽ hiện <strong>thêm</strong>{" "}
            bên cạnh Test 1, không thay thế.
          </p>
        </div>
      )}
      {tests && tests.length === 0 && !level.speakingPart1 && (
        <div className="admin-empty-state">
          <span className="admin-empty-state-icon">📝</span>
          <p>Cấp độ này chưa có Test nào — tạo Test đầu tiên để bắt đầu soạn scene.</p>
        </div>
      )}
      {tests && tests.length > 0 && (
        <ul className="admin-scene-list">
          {tests.map(t => (
            <li key={t.id} className="admin-scene-list-item">
              <span className="admin-scene-list-summary">
                {t.title}
                <span className="admin-scene-count-badge">{t.scenes?.length ?? 0} scene</span>
              </span>
              <span className="admin-scene-list-actions">
                <button className="admin-link-btn" onClick={() => openTest(t)}>Sửa</button>
                <button className="admin-link-btn admin-pill-btn-danger" onClick={() => handleDeleteTest(t.id)}>Xoá</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <button className="admin-btn-primary" onClick={openNewTest} style={{ marginTop: 16 }}>
        + Tạo Test mới
      </button>
    </div>
  );
}

function LoadingCard({ inline }) {
  const body = (
    <div className="admin-loading-row">
      <span className="admin-spinner" />
      <span>Đang tải...</span>
    </div>
  );
  return inline ? body : <div className="admin-card">{body}</div>;
}
