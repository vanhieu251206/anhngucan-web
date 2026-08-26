import { useEffect, useState } from "react";
import { YLE_SERIES } from "../../lib/yleData.js";
import { useAuth } from "../../lib/authContext.jsx";
import {
  saveListening, getListening, listTests, getTest, saveTest, deleteTest,
  listReadingTests, getReadingTest, saveReadingTest, deleteReadingTest,
} from "../../lib/adminLessons.js";
import TestStudio from "../../components/dashboard/TestStudio.jsx";
import ReadingStudio from "../../components/dashboard/ReadingStudio.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { readParams, setParams } from "../../lib/urlState.js";

const MODE_INFO = {
  listening: { label: "Listening", icon: "🎧", desc: "Video nghe" },
  speaking: { label: "Speaking", icon: "🎤", desc: "Luyện nói theo scene" },
  reading: { label: "Reading & Writing", icon: "📖", desc: "Đọc & Viết" },
};

// Đọc bước đang soạn (bộ đề/cấp/loại bài) từ URL (?cSeries=...&cLevel=...&cMode=...) — để F5
// quay lại đúng chỗ đang soạn thay vì luôn về bước "Chọn bộ đề" đầu tiên (phản hồi người dùng
// 2026-08-23). Dùng tiền tố "c" (create) để không đụng key "series" của trang Bài học công khai.
function initialStepFromUrl() {
  const p = readParams();
  const series = YLE_SERIES.find(s => s.id === p.get("cSeries")) ?? null;
  const level = series?.levels.find(l => String(l.number) === p.get("cLevel")) ?? null;
  const mode = level && ["listening", "speaking", "reading"].includes(p.get("cMode")) ? p.get("cMode") : null;
  return { series, level: level ?? null, mode };
}

export default function CreateLessonPage() {
  const { user } = useAuth();
  const [{ series, level, mode }, setStep] = useState(initialStepFromUrl);

  useEffect(() => {
    setParams(
      { cSeries: series?.id ?? null, cLevel: level?.number ?? null, cMode: mode ?? null },
      { replace: true }
    );
  }, [series, level, mode]);

  function setSeries(s) { setStep({ series: s, level: null, mode: null }); }
  function setLevel(l) { setStep(st => ({ ...st, level: l, mode: null })); }
  function setMode(m) { setStep(st => ({ ...st, mode: m })); }

  // Đường dẫn từng bước (Bộ đề → Cấp độ → Loại bài) — bấm vào 1 bước trước đó để quay lại
  // ngay, thay vì chỉ có nút "← Quay lại" đơn lẻ ở cuối mỗi màn.
  const crumbs = [
    { label: "Bộ đề", onClick: () => setStep({ series: null, level: null, mode: null }), active: !series },
  ];
  if (series) {
    crumbs.push({
      label: series.title,
      accent: series.color,
      onClick: () => setStep(st => ({ ...st, level: null, mode: null })),
      active: !level,
    });
  }
  if (series && level) {
    crumbs.push({
      label: `Cấp ${level.number}`,
      accent: series.color,
      onClick: () => setStep(st => ({ ...st, mode: null })),
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
      {series && level && mode === "reading" && (
        <ReadingEditor series={series} level={level} uid={user.uid} />
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
      <p className="admin-muted-text">Bắt đầu soạn bài bằng cách chọn 1 bộ đề.</p>
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
            <span className="admin-picker-tile-title">{series.title} {l.number}</span>
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
          </button>
        ))}
      </div>
    </div>
  );
}

function ListeningEditor({ series, level, uid }) {
  const [videos, setVideos] = useState([{ videoId: "", title: "" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    getListening(series.id, level.number).then(l => {
      setVideos(l?.length ? l : [{ videoId: "", title: "" }]);
      setLoading(false);
    });
  }, [series.id, level.number]);

  function updateVideo(i, patch) {
    setVideos(vs => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function addVideo() {
    setVideos(vs => [...vs, { videoId: "", title: "" }]);
  }
  function removeVideo(i) {
    setVideos(vs => vs.filter((_, idx) => idx !== i));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const cleaned = videos.filter(v => v.videoId.trim() || v.title.trim());
    await saveListening(series.id, level.number, cleaned, uid);
    setSaving(false);
    setSaved(true);
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — Listening</h2>
      <form className="admin-form" onSubmit={handleSave}>
        <p className="admin-hint">
          Upload video lên Google Drive → chia sẻ "Bất kỳ ai có link" (chế độ Xem) → lấy ID từ link dạng
          drive.google.com/file/d/<b>ID_Ở_ĐÂY</b>/view. Học sinh bấm nút sẽ mở video ở tab mới (không nhúng
          trực tiếp trong trang) để tránh lỗi trình duyệt chặn cookie khi nhúng iframe. Có thể thêm nhiều
          video cho 1 cấp độ (vd nhiều Test Listening khác nhau).
        </p>
        {videos.map((v, i) => (
          <div className="admin-listening-row" key={i}>
            <label>
              Google Drive File ID
              <input
                className="admin-input"
                placeholder="vd: 1AbCdEfGhIjKlMnOpQrStUvWxYz"
                value={v.videoId}
                onChange={e => updateVideo(i, { videoId: e.target.value })}
              />
            </label>
            <label>
              Tiêu đề hiển thị
              <input
                className="admin-input"
                placeholder="vd: Starters 1 – Test 1"
                value={v.title}
                onChange={e => updateVideo(i, { title: e.target.value })}
              />
            </label>
            {videos.length > 1 && (
              <button
                type="button"
                className="admin-link-btn admin-pill-btn-danger"
                onClick={() => removeVideo(i)}
              >
                Xoá video này
              </button>
            )}
          </div>
        ))}
        <button type="button" className="admin-btn-secondary" onClick={addVideo}>
          + Thêm video
        </button>
        <button className="admin-btn-primary" type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        {saved && <p className="admin-success">✓ Đã lưu</p>}
      </form>
    </div>
  );
}

function SpeakingEditor({ series, level, uid }) {
  const confirm = useConfirm();
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

  // Nhập nhanh 1 mảng scene soạn sẵn từ file JSON (vd Claude chuẩn bị trước từ quy trình soạn bài
  // ở docs/quy-trinh/) — mở thẳng vào TestStudio như "Tạo Test mới" để người dùng xem/sửa lại
  // trước khi bấm Lưu, không tự ý ghi thẳng vào Firestore mà chưa qua bước xem lại.
  function handleImportJSON(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error("File JSON phải là 1 mảng scene.");
        const nextOrder = (tests?.length ?? 0) + reservedTestSlots + 1;
        setOpenTestId(`test${nextOrder}`);
        setTestTitle(`Test ${nextOrder}`);
        setScenes(parsed);
        setSaved(false);
      } catch (err) {
        alert(`File JSON không hợp lệ: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  async function handleDeleteTest(id) {
    if (!(await confirm("Xoá Test này? Không hoàn tác được.", { danger: true }))) return;
    try {
      await deleteTest(series.id, level.number, id);
      reloadTests();
    } catch (err) {
      alert(`Không xoá được Test: ${err.message}`);
    }
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
      {tests && (
        <div className="admin-test-grid">
          {tests.map(t => (
            <div key={t.id} className="admin-test-card" style={{ "--accent": series.color }}>
              <button className="admin-test-card-main" onClick={() => openTest(t)}>
                <span className="admin-test-card-icon">🎤</span>
                <span className="admin-test-card-title">{t.title}</span>
                <span className="admin-scene-count-badge">{t.scenes?.length ?? 0} scene</span>
              </button>
              <div className="admin-test-card-actions">
                <button className="admin-link-btn" onClick={() => openTest(t)}>Sửa</button>
                <button className="admin-link-btn admin-pill-btn-danger" onClick={() => handleDeleteTest(t.id)}>Xoá</button>
              </div>
            </div>
          ))}
          <button className="admin-test-card admin-test-card-add" onClick={openNewTest}>
            <span className="admin-test-card-add-icon">+</span>
            <span>Tạo Test mới</span>
          </button>
        </div>
      )}
      <label className="admin-btn-secondary admin-import-json-btn">
        Nhập từ file JSON
        <input type="file" accept="application/json" onChange={handleImportJSON} hidden />
      </label>
      {tests && tests.length === 0 && !level.speakingPart1 && (
        <p className="admin-muted-text">Cấp độ này chưa có Test nào — bấm "Tạo Test mới" để bắt đầu soạn scene.</p>
      )}
    </div>
  );
}

function ReadingEditor({ series, level, uid }) {
  const confirm = useConfirm();
  const [tests, setTests] = useState(null);
  const [openTestId, setOpenTestId] = useState(null);
  const [parts, setParts] = useState([]);
  const [testTitle, setTestTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function reloadTests() {
    listReadingTests(series.id, level.number).then(setTests);
  }
  useEffect(reloadTests, [series.id, level.number]);

  async function openTest(t) {
    const full = await getReadingTest(series.id, level.number, t.id);
    setOpenTestId(t.id);
    setTestTitle(full?.title ?? t.title ?? "");
    setParts(full?.parts ?? []);
    setSaved(false);
  }

  function openNewTest() {
    const nextOrder = (tests?.length ?? 0) + 1;
    setOpenTestId(`test${nextOrder}`);
    setTestTitle(`Test ${nextOrder}`);
    setParts([]);
    setSaved(false);
  }

  async function handleDeleteTest(id) {
    if (!(await confirm("Xoá Test này? Không hoàn tác được.", { danger: true }))) return;
    try {
      await deleteReadingTest(series.id, level.number, id);
      reloadTests();
    } catch (err) {
      alert(`Không xoá được Test: ${err.message}`);
    }
  }
  async function handleSaveTest() {
    setSaving(true);
    setSaved(false);
    try {
      const order = tests?.find(t => t.id === openTestId)?.order ?? (tests?.length ?? 0) + 1;
      await saveReadingTest(series.id, level.number, openTestId, { title: testTitle, order, parts }, uid);
      setSaved(true);
      reloadTests();
    } catch (err) {
      // Thiếu try/catch trước đây khiến lỗi (vd Firestore từ chối field `undefined`) bị nuốt mất,
      // nút "Xuất bản" kẹt mãi ở trạng thái loading không rõ lý do (phản hồi thực tế 2026-08-27).
      alert(`Không xuất bản được: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (openTestId) {
    return (
      <ReadingStudio
        accent={series.color}
        seriesId={series.id}
        title={testTitle}
        onTitleChange={setTestTitle}
        parts={parts}
        onPartsChange={setParts}
        onBack={() => setOpenTestId(null)}
        onSave={handleSaveTest}
        saving={saving}
        saved={saved}
      />
    );
  }

  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — Reading &amp; Writing</h2>
      {tests === null && <LoadingCard inline />}
      {tests && (
        <div className="admin-test-grid">
          {tests.map(t => (
            <div key={t.id} className="admin-test-card" style={{ "--accent": series.color }}>
              <button className="admin-test-card-main" onClick={() => openTest(t)}>
                <span className="admin-test-card-icon">📖</span>
                <span className="admin-test-card-title">{t.title}</span>
                <span className="admin-scene-count-badge">{t.parts?.length ?? 0} part</span>
              </button>
              <div className="admin-test-card-actions">
                <button className="admin-link-btn" onClick={() => openTest(t)}>Sửa</button>
                <button className="admin-link-btn admin-pill-btn-danger" onClick={() => handleDeleteTest(t.id)}>Xoá</button>
              </div>
            </div>
          ))}
          <button className="admin-test-card admin-test-card-add" onClick={openNewTest}>
            <span className="admin-test-card-add-icon">+</span>
            <span>Tạo Test mới</span>
          </button>
        </div>
      )}
      {tests && tests.length === 0 && (
        <p className="admin-muted-text">Cấp độ này chưa có Test nào — bấm "Tạo Test mới" để bắt đầu soạn Part/câu hỏi.</p>
      )}
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
