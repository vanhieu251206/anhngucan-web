import { useEffect, useState } from "react";
import ImageUploadField from "./ImageUploadField.jsx";
import AudioUploadField from "./AudioUploadField.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";
import { useRectDraw } from "./ScenePreview.jsx";
import { Part4Editor, Part4Preview, blankPart4, normalizePart4, validatePart4, part4HasContent } from "./StartersListeningPart4Editor.jsx";
import { Part3Editor, Part3Preview, blankPart3, normalizePart3, validatePart3, part3HasContent } from "./StartersListeningPart3Editor.jsx";
import { Part2Editor, Part2Preview, blankPart2, normalizePart2, validatePart2, part2HasContent } from "./StartersListeningPart2Editor.jsx";
import { listListeningExamTests, getListeningExamTest, saveListeningExamTest } from "../../lib/adminLessons.js";

// CMS "Luyện đề" Listening — CHỈ Starters. Hiện mới có Part 1 (nghe & nối tên với người trong tranh).
// Đáp án = 5 CẶP khung toạ độ (Câu 1-5; ví dụ đã nối sẵn trong ảnh nên không cần soạn): mỗi cặp gồm khung 1 (chỗ tên trong ảnh) và khung 2
// (nhân vật), vẽ bằng cách kéo chuột trực tiếp trên ảnh xem trước bên phải (giống scene-click của
// Speaking, toạ độ % theo ảnh: { x, y, w, h }). Học sinh chạm 2 điểm — trùng đúng 1 cặp là đúng.
const PAIR_IDS = ["q1", "q2", "q3", "q4", "q5"];
const pairLabel = id => `Câu ${id.slice(1)}`;

function blankPart() {
  return { audioUrl: "", imageUrl: "", pairs: PAIR_IDS.map(id => ({ id, a: null, b: null })) };
}

function normalizePart(raw) {
  if (!raw) return blankPart();
  return {
    audioUrl: raw.audioUrl ?? "",
    imageUrl: raw.imageUrl ?? "",
    pairs: PAIR_IDS.map(id => raw.pairs?.find(p => p.id === id) ?? { id, a: null, b: null }),
  };
}

const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function Part1Editor({ part, onChange, activeSlot, onActiveSlot }) {
  function clearPair(id) {
    onChange({ ...part, pairs: part.pairs.map(p => (p.id === id ? { id, a: null, b: null } : p)) });
    if (activeSlot?.id === id) onActiveSlot(null);
  }

  const doneCount = part.pairs.filter(p => p.a && p.b).length;

  return (
    <div className="admin-form p1e">
      <fieldset className="admin-fieldset">
        <legend>🎧 Audio Part 1</legend>
        <AudioUploadField value={part.audioUrl} onChange={v => onChange({ ...part, audioUrl: v ?? "" })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🖼️ Ảnh tranh</legend>
        <ImageUploadField value={part.imageUrl} onChange={v => onChange({ ...part, imageUrl: v ?? "" })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>🎯 Đáp án nối <span className="admin-scene-count-badge">{doneCount}/{part.pairs.length} câu</span></legend>
        <div className="p1e-pairs">
          {part.pairs.map(p => {
            const full = p.a && p.b;
            const half = (p.a || p.b) && !full;
            return (
              <div className={`p1e-pair${full ? " is-full" : ""}`} key={p.id}>
                <div className="p1e-pair-head">
                  <span className="p1e-pair-num">{p.id.slice(1)}</span>
                  <strong className="p1e-pair-title">Câu {p.id.slice(1)}</strong>
                  <span className={`p1e-pair-status${full ? " is-ok" : half ? " is-warn" : ""}`}>
                    {full ? "Đủ cặp" : half ? "Thiếu 1 khung" : "Trống"}
                  </span>
                  <button type="button" className="p1e-clear" onClick={() => clearPair(p.id)} disabled={!p.a && !p.b} title="Xoá cặp này">✕</button>
                </div>
                {["a", "b"].map(slot => {
                  const active = activeSlot?.id === p.id && activeSlot.slot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`p1e-slot is-${slot}${active ? " is-active" : ""}${p[slot] ? " is-done" : ""}`}
                      disabled={!part.imageUrl}
                      onClick={() => onActiveSlot(active ? null : { id: p.id, slot })}
                    >
                      <span className="p1e-slot-dot" />
                      <span className="p1e-slot-text">
                        <strong>{slot === "a" ? "Khung 1 · Tên" : "Khung 2 · Người"}</strong>
                        <small>{active ? "Kéo trên ảnh..." : p[slot] ? "✓ Đã vẽ" : "Chưa vẽ"}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

const PART_COUNT = 4;

// Xem trước Part 1: ảnh + toàn bộ khung (cam = khung 1, xanh = khung 2) + đường nối từ tâm khung 1 đến
// khung 2 của từng cặp; cũng là nơi kéo chuột vẽ khung (khi đang chọn "Vẽ khung...").
function Part1Preview({ part, onChange, activeSlot, onActiveSlot }) {
  function commit(rect) {
    if (!activeSlot) return;
    const pairs = part.pairs.map(p => (p.id === activeSlot.id ? { ...p, [activeSlot.slot]: rect } : p));
    onChange({ ...part, pairs });
    // Vẽ xong khung 1 thì tự chuyển sang khung 2 của cùng cặp.
    onActiveSlot(activeSlot.slot === "a" ? { id: activeSlot.id, slot: "b" } : null);
  }
  const { stageRef, liveRect, handlers } = useRectDraw(commit);
  const done = part.pairs.filter(p => p.a && p.b);
  const questionCount = done.length;

  return (
    <div className="admin-reading-preview-panel">
      <h3>Thông tin chung của bài tập</h3>
      <div className="admin-reading-preview-stats">
        <span>Tổng Part: <strong>1</strong></span>
        <span>Tổng số câu: <strong>{questionCount}</strong></span>
      </div>
      <div className="admin-reading-preview-head"><h3>Xem trước bài</h3></div>
      <p><strong>Part 1</strong> — Listen and draw lines. There is one example.</p>
      {part.audioUrl && <audio src={part.audioUrl} controls style={{ width: "100%", marginBottom: 12 }} />}
      {part.imageUrl ? (
        <div
          ref={stageRef}
          className="admin-p1-pair-stage"
          {...(activeSlot ? handlers : {})}
          style={{ cursor: activeSlot ? "crosshair" : "default", touchAction: activeSlot ? "none" : "auto" }}
        >
          <img src={part.imageUrl} alt="" draggable={false} />
          <svg className="admin-p1-pair-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {done.map(p => {
              const a = center(p.a);
              const b = center(p.b);
              return (
                <line key={p.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f5711f" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              );
            })}
          </svg>
          {part.pairs.map(p =>
            ["a", "b"].map(slot =>
              p[slot] ? (
                <div
                  key={`${p.id}-${slot}`}
                  className={`admin-p1-frame is-${slot}`}
                  style={{ left: `${p[slot].x}%`, top: `${p[slot].y}%`, width: `${p[slot].w}%`, height: `${p[slot].h}%` }}
                >
                  <span>{p.id.slice(1)}</span>
                </div>
              ) : null,
            ),
          )}
          {liveRect && (
            <div
              className="admin-p1-frame is-live"
              style={{ left: `${liveRect.x}%`, top: `${liveRect.y}%`, width: `${liveRect.w}%`, height: `${liveRect.h}%` }}
            />
          )}
        </div>
      ) : (
        <p className="admin-muted-text">Chưa có ảnh tranh.</p>
      )}
      <ul className="admin-p1-preview-answers">
        {part.pairs.map(p => (
          <li key={p.id}>
            <strong>{pairLabel(p.id)}:</strong> {p.a && p.b ? "✓ đủ cặp" : p.a || p.b ? "thiếu 1 khung" : "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function validatePart1(part) {
  const half = part.pairs.find(p => (p.a && !p.b) || (!p.a && p.b));
  if (half) return `Part 1: ${pairLabel(half.id)} mới có 1 khung — cần vẽ đủ cả khung 1 và khung 2.`;
  if (!part.pairs.some(p => p.a && p.b)) return "Part 1: chưa có cặp đáp án nào.";
  return null;
}

function TestEditor({ series, level, testId, uid, onBack }) {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(`Test ${testId.replace("test", "")}`);
  const [part1, setPart1] = useState(blankPart);
  const [part2, setPart2] = useState(blankPart2);
  const [part3, setPart3] = useState(blankPart3);
  const [part4, setPart4] = useState(blankPart4);
  const [activeId4, setActiveId4] = useState(null);
  const [activeSlot, setActiveSlot] = useState(null);
  const [openPart, setOpenPart] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getListeningExamTest(series.id, level.number, testId)
      .then(t => {
        if (t?.title) setTitle(t.title);
        if (t?.parts?.part1) setPart1(normalizePart(t.parts.part1));
        if (t?.parts?.part2) setPart2(normalizePart2(t.parts.part2));
        if (t?.parts?.part3) setPart3(normalizePart3(t.parts.part3));
        if (t?.parts?.part4) setPart4(normalizePart4(t.parts.part4));
      })
      .finally(() => setLoading(false));
  }, [series.id, level.number, testId]);

  async function handlePublish() {
    const has1 = !!part1.imageUrl || part1.pairs.some(p => p.a || p.b);
    const has2 = part2HasContent(part2);
    const has3 = part3HasContent(part3);
    const has4 = part4HasContent(part4);
    const err = (has1 ? validatePart1(part1) : null) || (has2 ? validatePart2(part2) : null) || (has3 ? validatePart3(part3) : null) || (part4.items.some(i => i.ops?.length) ? validatePart4(part4) : null) || (!has1 && !has2 && !has3 && !has4 ? "Chưa có nội dung nào để xuất bản." : null);
    if (err) {
      alert(err);
      return;
    }
    if (!(await confirm("Bài này sẽ hiển thị ngay trên website cho học sinh. Xuất bản?"))) return;
    setSaving(true);
    setSaved(false);
    try {
      await saveListeningExamTest(series.id, level.number, testId, { title, parts: { part1, part2, part3, part4 } }, uid);
      setSaved(true);
    } catch (e) {
      alert(`Không xuất bản được: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="admin-card"><p className="admin-muted-text">Đang tải...</p></div>;

  return (
    <div className="studio-shell" style={{ "--accent": series.color }}>
      <div className="studio-topbar">
        <button className="admin-pill-btn" onClick={onBack}>← Quay lại</button>
        <input className="studio-title-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Tên Test" />
        <div className="studio-topbar-actions">
          {saved && <span className="admin-success">✓ Đã xuất bản</span>}
          <button className="admin-btn-primary" onClick={handlePublish} disabled={saving}>
            {saving ? "Đang xuất bản..." : "Xuất bản"}
          </button>
        </div>
      </div>

      <div className="admin-reading-studio-columns">
        <div className="admin-reading-parts">
          {Array.from({ length: PART_COUNT }, (_, i) => i + 1).map(n => {
            const ready = n <= 4;
            const isOpen = openPart === n && ready;
            return (
              <div key={n} className={`admin-reading-part${isOpen ? " is-open" : ""}`} style={ready ? undefined : { opacity: 0.55 }}>
                <div className="admin-reading-part-head" onClick={() => ready && setOpenPart(isOpen ? null : n)}>
                  <span className="admin-reading-part-chevron" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                  <span className="admin-reading-part-title">Part {n}</span>
                  <span className="admin-scene-count-badge">{ready ? "5 câu" : "Sắp ra mắt"}</span>
                </div>
                {isOpen && n === 1 && <Part1Editor part={part1} onChange={setPart1} activeSlot={activeSlot} onActiveSlot={setActiveSlot} />}
                {isOpen && n === 2 && <Part2Editor part={part2} onChange={setPart2} />}
                {isOpen && n === 3 && <Part3Editor part={part3} onChange={setPart3} />}
                {isOpen && n === 4 && <Part4Editor part={part4} onChange={setPart4} activeId={activeId4} onActiveId={setActiveId4} />}
              </div>
            );
          })}
        </div>
        {openPart === 4 ? <Part4Preview part={part4} onChange={setPart4} activeId={activeId4} onActiveId={setActiveId4} /> : openPart === 3 ? <Part3Preview part={part3} /> : openPart === 2 ? <Part2Preview part={part2} /> : <Part1Preview part={part1} onChange={setPart1} activeSlot={activeSlot} onActiveSlot={setActiveSlot} />}
      </div>
    </div>
  );
}

export default function StartersListeningExamStudio({ series, level, uid }) {
  const [tests, setTests] = useState(null);
  const [openTestId, setOpenTestId] = useState(null);

  function reload() {
    listListeningExamTests(series.id, level.number).then(setTests).catch(() => setTests([]));
  }
  useEffect(reload, [series.id, level.number]);

  if (openTestId) {
    return (
      <TestEditor
        series={series}
        level={level}
        testId={openTestId}
        uid={uid}
        onBack={() => { setOpenTestId(null); reload(); }}
      />
    );
  }

  return (
    <div className="admin-card">
      <h2>{series.title} {level.number} — Luyện đề Listening</h2>
      {tests === null ? (
        <p className="admin-muted-text">Đang tải...</p>
      ) : (
        <div className="admin-test-grid">
          {[1, 2, 3].map(n => {
            const t = tests.find(x => x.id === `test${n}`);
            const done = t?.parts ? Object.keys(t.parts).length : 0;
            return (
              <div key={n} className="admin-test-card" style={{ "--accent": series.color }}>
                <button className="admin-test-card-main" onClick={() => setOpenTestId(`test${n}`)}>
                  <span className="admin-test-card-icon">🎧</span>
                  <span className="admin-test-card-title">{t?.title ?? `Test ${n}`}</span>
                  <span className="admin-scene-count-badge">{done ? `${done} part` : "Chưa soạn"}</span>
                </button>
                <div className="admin-test-card-actions">
                  <button className="admin-link-btn" onClick={() => setOpenTestId(`test${n}`)}>Sửa</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
