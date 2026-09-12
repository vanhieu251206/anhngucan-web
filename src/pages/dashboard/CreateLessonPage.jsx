import { useEffect, useState } from "react";
import { YLE_SERIES, LISTENING_PART_LABELS, buildListeningTitles as buildListeningTitlesShared } from "../../lib/yleData.js";
import { useAuth } from "../../lib/authContext.jsx";
import {
  saveListening, getListening, listTests, getTest, saveTest, deleteTest,
  listReadingTests, getReadingTest, saveReadingTest, deleteReadingTest,
  listDictationTests, getDictationTest, saveDictationTest, deleteDictationTest,
  listPracticeTests, getPracticeTest, savePracticeTest, deletePracticeTest,
  listIeltsListeningTests, getIeltsListeningTest, saveIeltsListeningTest, deleteIeltsListeningTest,
} from "../../lib/adminLessons.js";
import TestStudio from "../../components/dashboard/TestStudio.jsx";
import ReadingStudio from "../../components/dashboard/ReadingStudio.jsx";
import DictationStudio from "../../components/dashboard/DictationStudio.jsx";
import { ComprehensionPage, LuyenDePage } from "../../components/dashboard/PracticeStudio.jsx";
import ListeningTestStudio from "../../components/dashboard/ListeningTestStudio.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { readParams, setParams } from "../../lib/urlState.js";

const MODE_INFO = {
  listening: { label: "Listening", icon: "🎧", desc: "Video nghe" },
  speaking: { label: "Speaking", icon: "🎤", desc: "Luyện nói theo scene" },
  reading: { label: "Reading & Writing", icon: "📖", desc: "Đọc & Viết" },
  dictation: { label: "Dictation", icon: "✍️", desc: "Nghe & gõ lại" },
  "ielts-reading": { label: "Reading", icon: "📖", desc: "Test 1-4 → Passage 1-3, đọc + dịch + câu hỏi chấm điểm" },
  "ielts-listening": { label: "Listening", icon: "🎧", desc: "Test 1-4 → Section 1-4, audio + câu hỏi chấm điểm" },
  "ielts-writing": { label: "Writing", icon: "✏️", desc: "Chưa triển khai" },
  "ielts-speaking": { label: "Speaking", icon: "🎤", desc: "Chưa triển khai" },
};
// IELTS không chia bộ sách (chỉ 1 "level" ẩn = IELTS 8, xem yleData.js `buildIeltsSeries()`), bên
// trong chia theo kỹ năng READING/LISTENING/WRITING/SPEAKING/DICTATION đúng cây Test→Passage/
// Section (chốt 2026-09-11) — Dictation dùng chung DictationEditor với YLE (schema giống hệt).
const MODES_BY_SERIES = {
  ielts: ["ielts-reading", "ielts-listening", "ielts-writing", "ielts-speaking", "dictation"],
};
function modesForSeries(series) {
  return (MODES_BY_SERIES[series.id] ?? ["listening", "speaking", "reading", "dictation"]).map(key => [
    key,
    MODE_INFO[key],
  ]);
}

// Đọc bước đang soạn (bộ đề/cấp/loại bài) từ URL (?cSeries=...&cLevel=...&cMode=...) — để F5
// quay lại đúng chỗ đang soạn thay vì luôn về bước "Chọn bộ đề" đầu tiên (phản hồi người dùng
// 2026-08-23). Dùng tiền tố "c" (create) để không đụng key "series" của trang Bài học công khai.
function initialStepFromUrl() {
  const p = readParams();
  const series = YLE_SERIES.find(s => s.id === p.get("cSeries")) ?? null;
  const level = series?.levels.find(l => String(l.number) === p.get("cLevel")) ?? null;
  const mode = level && Object.keys(MODE_INFO).includes(p.get("cMode")) ? p.get("cMode") : null;
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

  // Series chỉ có 1 cấp (IELTS) → tự chọn luôn, không hiện bước "Chọn cấp độ".
  function setSeries(s) { setStep({ series: s, level: s.levels.length === 1 ? s.levels[0] : null, mode: null }); }
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
  if (series && level && series.levels.length > 1) {
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
      {series && level && mode === "dictation" && (
        <DictationEditor series={series} level={level} uid={user.uid} />
      )}
      {series && level && mode === "ielts-reading" && (
        <IeltsReadingEditor series={series} level={level} uid={user.uid} />
      )}
      {series && level && mode === "ielts-listening" && (
        <IeltsListeningEditor series={series} level={level} uid={user.uid} />
      )}
      {series && level && (mode === "ielts-writing" || mode === "ielts-speaking") && (
        <ComingSoonEditor series={series} level={level} mode={mode} />
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
        {modesForSeries(series).map(([key, info]) => (
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

// Nhãn Part + tiêu đề khoá cứng dùng chung với mock mặc định ở yleData.js (chốt 2026-09-04, cùng
// tinh thần khoá cứng 3 Test của Reading & Writing) — giáo viên chỉ dán/upload video vào từng ô.
function buildListeningTitles(series, level) {
  return buildListeningTitlesShared(series.id, series.title, level.number);
}

function ListeningEditor({ series, level, uid }) {
  const fixedTitles = buildListeningTitles(series, level);
  const [videos, setVideos] = useState([{ videoId: "", title: "" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    getListening(series.id, level.number).then(l => {
      if (fixedTitles) {
        // Ghép video đã lưu vào đúng ô theo tiêu đề cố định — video cũ không khớp (dữ liệu mẫu/placeholder
        // cũ) sẽ không hiện lại, giáo viên nhập lại từ đầu (chốt cùng người dùng 2026-09-04).
        setVideos(fixedTitles.map(title => ({
          videoId: l?.find(v => v.title === title)?.videoId ?? "",
          title,
        })));
      } else {
        setVideos(l?.length ? l : [{ videoId: "", title: "" }]);
      }
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
        {!fixedTitles && (
          <p className="admin-hint">
            Upload video lên Google Drive → chia sẻ "Bất kỳ ai có link" (chế độ Xem) → lấy ID từ link dạng
            drive.google.com/file/d/<b>ID_Ở_ĐÂY</b>/view. Học sinh bấm nút sẽ mở video ở tab mới (không nhúng
            trực tiếp trong trang) để tránh lỗi trình duyệt chặn cookie khi nhúng iframe.
          </p>
        )}
        {fixedTitles ? (
          Array.from({ length: 3 }, (_, t) => {
            const parts = LISTENING_PART_LABELS[series.id];
            const start = t * parts.length;
            return (
              <div className="admin-listening-test-group" key={t}>
                <h3 className="admin-listening-test-heading">Test {t + 1}</h3>
                <div className="admin-listening-test-grid">
                  {parts.map((partLabel, pi) => {
                    const i = start + pi;
                    const v = videos[i];
                    return (
                      <label className="admin-listening-part-card" key={i}>
                        <span className="admin-listening-part-label">{partLabel}</span>
                        <input
                          className="admin-input"
                          placeholder="vd: 1AbCdEfGhIjKlMnOpQrStUvWxYz"
                          value={v.videoId}
                          onChange={e => updateVideo(i, { videoId: e.target.value })}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <>
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
          </>
        )}
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
  const [maxAttempts, setMaxAttempts] = useState(null);
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
    setMaxAttempts(full?.maxAttempts ?? null);
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
    setMaxAttempts(null);
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
    await saveTest(series.id, level.number, openTestId, { title: testTitle, order, scenes, maxAttempts }, uid);
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
        maxAttempts={maxAttempts}
        onMaxAttemptsChange={setMaxAttempts}
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
  const [maxAttempts, setMaxAttempts] = useState(null);
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
    setMaxAttempts(full?.maxAttempts ?? null);
    setSaved(false);
  }

  function openNewTest() {
    const nextOrder = (tests?.length ?? 0) + 1;
    setOpenTestId(`test${nextOrder}`);
    setTestTitle(`Test ${nextOrder}`);
    setParts([]);
    setMaxAttempts(null);
    setSaved(false);
  }

  function openNewTestNumbered(n) {
    setOpenTestId(`test${n}`);
    setTestTitle(`Test ${n}`);
    setParts([]);
    setMaxAttempts(null);
    setSaved(false);
  }

  // Cambridge YLE Reading & Writing (Starters/Movers/Flyers) luôn có ĐÚNG 3 Test cố định mỗi cấp —
  // hiện sẵn 3 thẻ Test 1/2/3 ngay từ đầu, giáo viên bấm thẳng vào để soạn, không cần bấm "Tạo Test
  // mới" + không cho thêm/xoá Test ngoài 3 thẻ này (chốt 2026-08-30, áp dụng thêm cho Starters/Flyers).
  const fixedTestCount = ["starters", "movers", "flyers"].includes(series.id) ? 3 : null;

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
      await saveReadingTest(series.id, level.number, openTestId, { title: testTitle, order, parts, maxAttempts }, uid);
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
        maxAttempts={maxAttempts}
        onMaxAttemptsChange={setMaxAttempts}
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
      {tests && fixedTestCount && (
        <div className="admin-test-grid">
          {Array.from({ length: fixedTestCount }, (_, i) => i + 1).map(n => {
            const t = tests.find(t => t.id === `test${n}`);
            return (
              <div key={n} className="admin-test-card" style={{ "--accent": series.color }}>
                <button
                  className="admin-test-card-main"
                  onClick={() => (t ? openTest(t) : openNewTestNumbered(n))}
                >
                  <span className="admin-test-card-icon">📖</span>
                  <span className="admin-test-card-title">{t?.title ?? `Test ${n}`}</span>
                  <span className="admin-scene-count-badge">
                    {t ? `${t.parts?.length ?? 0} part` : "Chưa soạn"}
                  </span>
                </button>
                {t && (
                  <div className="admin-test-card-actions">
                    <button className="admin-link-btn" onClick={() => openTest(t)}>Sửa</button>
                    <button className="admin-link-btn admin-pill-btn-danger" onClick={() => handleDeleteTest(t.id)}>Xoá nội dung</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tests && !fixedTestCount && (
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
      {tests && !fixedTestCount && tests.length === 0 && (
        <p className="admin-muted-text">Cấp độ này chưa có Test nào — bấm "Tạo Test mới" để bắt đầu soạn Part/câu hỏi.</p>
      )}
    </div>
  );
}

function DictationEditor({ series, level, uid }) {
  const confirm = useConfirm();
  const [tests, setTests] = useState(null);
  const [openTestId, setOpenTestId] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [testTitle, setTestTitle] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function reloadTests() {
    listDictationTests(series.id, level.number).then(setTests);
  }
  useEffect(reloadTests, [series.id, level.number]);

  async function openTest(t) {
    const full = await getDictationTest(series.id, level.number, t.id);
    setOpenTestId(t.id);
    setTestTitle(full?.title ?? t.title ?? "");
    setSentences(full?.sentences ?? []);
    setMaxAttempts(full?.maxAttempts ?? null);
    setSaved(false);
  }

  function openNewTest() {
    const nextOrder = (tests?.length ?? 0) + 1;
    setOpenTestId(`test${nextOrder}`);
    setTestTitle(`Test ${nextOrder}`);
    setSentences([]);
    setMaxAttempts(null);
    setSaved(false);
  }

  async function handleDeleteTest(id) {
    if (!(await confirm("Xoá Test này? Không hoàn tác được.", { danger: true }))) return;
    try {
      await deleteDictationTest(series.id, level.number, id);
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
      await saveDictationTest(series.id, level.number, openTestId, { title: testTitle, order, sentences, maxAttempts }, uid);
      setSaved(true);
      reloadTests();
    } catch (err) {
      alert(`Không xuất bản được: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (openTestId) {
    return (
      <DictationStudio
        accent={series.color}
        title={testTitle}
        onTitleChange={setTestTitle}
        sentences={sentences}
        onSentencesChange={setSentences}
        maxAttempts={maxAttempts}
        onMaxAttemptsChange={setMaxAttempts}
        onBack={() => setOpenTestId(null)}
        onSave={handleSaveTest}
        saving={saving}
        saved={saved}
      />
    );
  }

  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — Dictation</h2>
      {tests === null && <LoadingCard inline />}
      {tests && (
        <div className="admin-test-grid">
          {tests.map(t => (
            <div key={t.id} className="admin-test-card" style={{ "--accent": series.color }}>
              <button className="admin-test-card-main" onClick={() => openTest(t)}>
                <span className="admin-test-card-icon">✍️</span>
                <span className="admin-test-card-title">{t.title}</span>
                <span className="admin-scene-count-badge">{t.sentences?.length ?? 0} câu</span>
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
        <p className="admin-muted-text">Cấp độ này chưa có Test nào — bấm "Tạo Test mới" để bắt đầu soạn câu Dictation.</p>
      )}
    </div>
  );
}

// Cambridge IELTS luôn có ĐÚNG 4 Test cố định mỗi bộ (chốt 2026-09-11, cùng tinh thần
// `fixedTestCount` của ReadingEditor YLE) — hiện sẵn 4 thẻ Test 1-4 ngay từ đầu, giáo viên bấm
// thẳng vào để soạn, không cho thêm/xoá Test ngoài 4 thẻ này.
const IELTS_TEST_COUNT = 4;

function IeltsReadingEditor({ series, level, uid }) {
  const confirm = useConfirm();
  const [tests, setTests] = useState(null);
  // Tab Test 1-4 đang xem trên màn danh sách (không chuyển trang) — cùng cơ chế gộp Test+Passage
  // học sinh đang dùng ở LessonsPage.jsx (chốt 2026-09-11 để CMS khớp đúng luồng học sinh thấy).
  const [selectedTestN, setSelectedTestN] = useState(1);
  const [openTestId, setOpenTestId] = useState(null);
  const [title, setTitle] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(null);
  const [passages, setPassages] = useState([]);
  const [maxAttempts, setMaxAttempts] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Passage + phần (đọc hiểu/luyện đề) cần cuộn tới ngay khi mở Test — set khi bấm 1 trong 2 nút
  // trên thẻ Passage ở màn danh sách, đọc 1 lần rồi PracticeStudio tự xoá (xem prop `focusTarget`).
  const [focusTarget, setFocusTarget] = useState(null);

  function reloadTests() {
    listPracticeTests(series.id, level.number).then(setTests);
  }
  useEffect(reloadTests, [series.id, level.number]);

  async function openTest(t, focus = null) {
    const full = await getPracticeTest(series.id, level.number, t.id);
    let nextPassages = full?.passages ?? [];
    // Bấm thẳng "Đọc hiểu"/"Luyện đề" của 1 Passage chưa soạn (vd Passage 2 khi mới có Passage 1)
    // — tự thêm sẵn các passage rỗng còn thiếu tới đúng vị trí đó để có chỗ cuộn tới + soạn luôn.
    if (focus && nextPassages.length <= focus.passageIndex) {
      nextPassages = [...nextPassages];
      while (nextPassages.length <= focus.passageIndex) {
        nextPassages.push({ title: "", titleVi: "", sentences: [], groups: [] });
      }
    }
    setOpenTestId(t.id);
    setTitle(full?.title ?? t.title ?? "");
    setTimeLimitMinutes(full?.timeLimitMinutes ?? 60);
    setPassages(nextPassages);
    setMaxAttempts(full?.maxAttempts ?? null);
    setSaved(false);
    setFocusTarget(focus);
  }

  function openNewTestNumbered(n, focus = null) {
    setOpenTestId(`test${n}`);
    setTitle(`${series.title} ${level.number} - Reading Test ${n}`);
    setTimeLimitMinutes(60);
    const nextPassages = [];
    if (focus) {
      while (nextPassages.length <= focus.passageIndex) {
        nextPassages.push({ title: "", titleVi: "", sentences: [], groups: [] });
      }
    }
    setPassages(nextPassages);
    setMaxAttempts(null);
    setSaved(false);
    setFocusTarget(focus);
  }

  // Bấm nút "Đọc hiểu"/"Luyện đề" trên 1 thẻ Passage ở màn danh sách — mở đúng Test rồi cuộn
  // thẳng tới đúng passage + đúng phần trong PracticeStudio, đỡ phải tự cuộn tìm giữa nhiều passage.
  function openPassageSection(n, passageIndex, section) {
    const t = tests.find(t => t.id === `test${n}`);
    const focus = { passageIndex, section };
    if (t) openTest(t, focus);
    else openNewTestNumbered(n, focus);
  }

  async function handleDeleteTest(id) {
    if (!(await confirm("Xoá nội dung Test này? Không hoàn tác được.", { danger: true }))) return;
    try {
      await deletePracticeTest(series.id, level.number, id);
      reloadTests();
    } catch (err) {
      alert(`Không xoá được: ${err.message}`);
    }
  }
  // overridePassage (LuyenDePage): passage vừa gộp text dán ngay lúc bấm Xuất bản — dùng trực tiếp
  // thay vì đọc `passages` state, vì setPassages là bất đồng bộ nên state có thể chưa kịp cập nhật
  // đúng lúc save (xem PracticeStudio.jsx `handleSaveClick`).
  async function handleSaveTest(overridePassage) {
    setSaving(true);
    setSaved(false);
    try {
      const order = tests?.find(t => t.id === openTestId)?.order ?? Number(openTestId.replace("test", ""));
      let finalPassages = passages;
      if (overridePassage && focusTarget) {
        finalPassages = passages.map((p, i) => (i === focusTarget.passageIndex ? overridePassage : p));
        setPassages(finalPassages);
      }
      await savePracticeTest(series.id, level.number, openTestId, { title, order, timeLimitMinutes, passages: finalPassages, maxAttempts }, uid);
      setSaved(true);
      reloadTests();
    } catch (err) {
      alert(`Không xuất bản được: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (openTestId && focusTarget) {
    const passageIndex = focusTarget.passageIndex;
    const passage = passages[passageIndex] ?? { title: "", titleVi: "", sentences: [], groups: [] };
    function updatePassageAt(nextPassage) {
      const next = [...passages];
      next[passageIndex] = nextPassage;
      setPassages(next);
    }
    const testLabel = `Test ${openTestId.replace("test", "")} — Passage ${passageIndex + 1}`;
    if (focusTarget.section === "comprehension") {
      return (
        <ComprehensionPage
          accent={series.color}
          testLabel={testLabel}
          passage={passage}
          onPassageChange={updatePassageAt}
          onBack={() => setOpenTestId(null)}
          onSave={handleSaveTest}
          saving={saving}
          saved={saved}
        />
      );
    }
    return (
      <LuyenDePage
        accent={series.color}
        testLabel={testLabel}
        title={title}
        onTitleChange={setTitle}
        timeLimitMinutes={timeLimitMinutes}
        onTimeLimitChange={setTimeLimitMinutes}
        maxAttempts={maxAttempts}
        onMaxAttemptsChange={setMaxAttempts}
        passage={passage}
        onPassageChange={updatePassageAt}
        onBack={() => setOpenTestId(null)}
        onSave={handleSaveTest}
        saving={saving}
        saved={saved}
      />
    );
  }

  const selectedTest = tests?.find(t => t.id === `test${selectedTestN}`) ?? null;

  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — Reading</h2>
      {tests === null && <LoadingCard inline />}
      {tests && (
        <>
          <div className="ielts-testpicker-tabs admin-testpicker-tabs">
            {Array.from({ length: IELTS_TEST_COUNT }, (_, i) => i + 1).map(n => {
              const t = tests.find(t => t.id === `test${n}`);
              return (
                <button
                  key={n}
                  type="button"
                  className={`ielts-testpicker-tab${selectedTestN === n ? " is-active" : ""}${!t ? " is-empty" : ""}`}
                  onClick={() => setSelectedTestN(n)}
                >
                  Test {n}
                </button>
              );
            })}
          </div>

          <div className="admin-test-grid">
            {Array.from({ length: 3 }, (_, i) => i + 1).map(n => {
              const p = selectedTest?.passages?.[n - 1];
              return (
                <div key={n} className="admin-test-card" style={{ "--accent": series.color }}>
                  <div className="admin-test-card-main">
                    <span className="admin-test-card-icon">📖</span>
                    <span className="admin-test-card-title">{p?.title || `Passage ${n}`}</span>
                  </div>
                  <div className="admin-test-card-actions">
                    <button
                      className="admin-link-btn"
                      onClick={() => openPassageSection(selectedTestN, n - 1, "comprehension")}
                    >
                      Đọc hiểu
                    </button>
                    <button
                      className="admin-link-btn"
                      onClick={() => openPassageSection(selectedTestN, n - 1, "practice")}
                    >
                      Luyện đề
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedTest && (
            <button
              type="button"
              className="admin-link-btn admin-pill-btn-danger admin-test-delete-link"
              onClick={() => handleDeleteTest(selectedTest.id)}
            >
              Xoá nội dung Test {selectedTestN}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function IeltsListeningEditor({ series, level, uid }) {
  const confirm = useConfirm();
  const [tests, setTests] = useState(null);
  const [openTestId, setOpenTestId] = useState(null);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState([]);
  const [maxAttempts, setMaxAttempts] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function reloadTests() {
    listIeltsListeningTests(series.id, level.number).then(setTests);
  }
  useEffect(reloadTests, [series.id, level.number]);

  async function openTest(t) {
    const full = await getIeltsListeningTest(series.id, level.number, t.id);
    setOpenTestId(t.id);
    setTitle(full?.title ?? t.title ?? "");
    setSections(full?.sections ?? []);
    setMaxAttempts(full?.maxAttempts ?? null);
    setSaved(false);
  }

  function openNewTestNumbered(n) {
    setOpenTestId(`test${n}`);
    setTitle(`${series.title} ${level.number} - Listening Test ${n}`);
    setSections([]);
    setMaxAttempts(null);
    setSaved(false);
  }

  async function handleDeleteTest(id) {
    if (!(await confirm("Xoá nội dung Test này? Không hoàn tác được.", { danger: true }))) return;
    try {
      await deleteIeltsListeningTest(series.id, level.number, id);
      reloadTests();
    } catch (err) {
      alert(`Không xoá được: ${err.message}`);
    }
  }
  async function handleSaveTest() {
    setSaving(true);
    setSaved(false);
    try {
      const order = tests?.find(t => t.id === openTestId)?.order ?? Number(openTestId.replace("test", ""));
      await saveIeltsListeningTest(series.id, level.number, openTestId, { title, order, sections, maxAttempts }, uid);
      setSaved(true);
      reloadTests();
    } catch (err) {
      alert(`Không xuất bản được: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (openTestId) {
    return (
      <ListeningTestStudio
        accent={series.color}
        title={title}
        onTitleChange={setTitle}
        sections={sections}
        onSectionsChange={setSections}
        maxAttempts={maxAttempts}
        onMaxAttemptsChange={setMaxAttempts}
        onBack={() => setOpenTestId(null)}
        onSave={handleSaveTest}
        saving={saving}
        saved={saved}
      />
    );
  }

  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — Listening</h2>
      {tests === null && <LoadingCard inline />}
      {tests && (
        <div className="admin-test-grid">
          {Array.from({ length: IELTS_TEST_COUNT }, (_, i) => i + 1).map(n => {
            const t = tests.find(t => t.id === `test${n}`);
            return (
              <div key={n} className="admin-test-card" style={{ "--accent": series.color }}>
                <button className="admin-test-card-main" onClick={() => (t ? openTest(t) : openNewTestNumbered(n))}>
                  <span className="admin-test-card-icon">🎧</span>
                  <span className="admin-test-card-title">{t?.title ?? `Test ${n}`}</span>
                  <span className="admin-scene-count-badge">{t ? `${t.sections?.length ?? 0} section` : "Chưa soạn"}</span>
                </button>
                {t && (
                  <div className="admin-test-card-actions">
                    <button className="admin-link-btn" onClick={() => openTest(t)}>Sửa</button>
                    <button className="admin-link-btn admin-pill-btn-danger" onClick={() => handleDeleteTest(t.id)}>Xoá nội dung</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ComingSoonEditor({ series, level, mode }) {
  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — {MODE_INFO[mode].label}</h2>
      <p className="admin-muted-text">Mục này chưa triển khai — sẽ làm sau.</p>
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
