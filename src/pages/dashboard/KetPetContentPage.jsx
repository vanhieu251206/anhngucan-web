import { useEffect, useState } from "react";
import { useAuth } from "../../lib/authContext.jsx";
import { KET_PET_GRADES } from "../../lib/yleData.js";
import { getKetPetFolders, newFolderId, saveKetPetFolders, unitEntries, unitLabel } from "../../lib/ketPetFolders.js";
import { getVocabularyUnit, saveVocabularyUnit, getKetPetPracticeTest, saveKetPetPracticeTest } from "../../lib/adminLessons.js";
import KetPetVocabularyStudio, { EMPTY_VOCAB_GROUPS } from "../../components/dashboard/KetPetVocabularyStudio.jsx";
import KetPetPracticeTestStudio, { EMPTY_PRACTICE_TEST_GROUPS } from "../../components/dashboard/KetPetPracticeTestStudio.jsx";
import KetPetPaperTestStudio from "../../components/dashboard/KetPetPaperTestStudio.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { answerSheetGroup } from "../../lib/ketPetPracticeTest.js";
import { levelAccessOf } from "../../lib/teacherScope.js";

const ACCENT = "#8B5CF6";

// Thêm / sửa 1 thư mục: tên + vị trí (đứng sau Unit/thư mục nào). `entries` = danh sách hiện tại (bỏ chính nó khi sửa).
function FolderForm({ initial, entries, onCancel, onSubmit }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [after, setAfter] = useState(String(initial?.after ?? entries[entries.length - 1]?.key ?? 0));
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), after: /^\d+$/.test(after) ? Number(after) : after });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ketpet-folder-form" onSubmit={submit}>
      <input className="admin-input" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Tên thư mục — VD: Ôn thi giữa kỳ" />
      <select className="admin-input" value={after} onChange={e => setAfter(e.target.value)} aria-label="Vị trí">
        <option value="0">Đầu danh sách</option>
        {entries.map(en => <option key={en.key} value={String(en.key)}>{`Sau ${en.label}`}</option>)}
      </select>
      <button type="submit" className="admin-btn-secondary" disabled={busy || !name.trim()}>{busy ? "Đang lưu..." : "Lưu"}</button>
      <button type="button" className="admin-link-btn" onClick={onCancel}>Huỷ</button>
    </form>
  );
}

// CMS soạn KET/PET — Grade (6-9) → Unit (1-16) + thư mục tự đặt tên (lib/ketPetFolders.js) → Vocabulary/Practice Test (Test 1-4). Tách riêng khỏi
// CreateLessonPage.jsx vì KET/PET không đi theo Level/Test như các bộ khác (xem yleData.js, App.jsx
// `ket-pet` branch).
export default function KetPetContentPage() {
  const { user, role, profile } = useAuth();
  const grades = KET_PET_GRADES.filter(g => levelAccessOf(profile, role, "ket-pet", g) === "edit");
  const [grade, setGrade] = useState(null);
  const [unit, setUnit] = useState(null);
  const [mode, setMode] = useState(null); // "vocabulary" | "practice-test"
  const [practiceTest, setPracticeTest] = useState(null); // 1-4
  const [vocabGroups, setVocabGroups] = useState(EMPTY_VOCAB_GROUPS);
  const [groups, setGroups] = useState(EMPTY_PRACTICE_TEST_GROUPS);
  // Cách soạn Practice Test: "questions" = soạn từng câu, "paper" = tải đề PDF/Word + chỉ gõ đáp án. Giữ riêng nội
  // dung 2 cách để chuyển qua lại không mất; lưu theo cách đang chọn.
  const [authoring, setAuthoring] = useState("questions");
  const [paper, setPaper] = useState(null);
  const [paperGroups, setPaperGroups] = useState([answerSheetGroup()]);
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [folders, setFolders] = useState([]);
  const [folderForm, setFolderForm] = useState(null); // null | { id? } — đang thêm / sửa thư mục
  const unitTitle = unitLabel(unit, folders);

  useEffect(() => {
    if (grade == null) return;
    let cancelled = false;
    setFolders([]);
    getKetPetFolders(grade).then(list => { if (!cancelled) setFolders(list); });
    return () => { cancelled = true; };
  }, [grade]);

  async function submitFolder(values) {
    const next = folderForm.id
      ? folders.map(f => (f.id === folderForm.id ? { ...f, ...values } : f))
      : [...folders, { id: newFolderId(), ...values }];
    await saveKetPetFolders(grade, next, user.uid);
    setFolders(next);
    setFolderForm(null);
  }

  async function removeFolder(f) {
    if (!(await confirm(`Xoá thư mục "${f.name}"? Học sinh sẽ không thấy thư mục này nữa (các bài đã soạn bên trong vẫn được giữ, tạo lại thư mục không lấy lại được).`, { danger: true }))) return;
    // Thư mục đứng sau thư mục bị xoá thì nối vào chỗ neo của nó, giữ nguyên thứ tự.
    const next = folders.filter(x => x.id !== f.id).map(x => (x.after === f.id ? { ...x, after: f.after } : x));
    await saveKetPetFolders(grade, next, user.uid);
    setFolders(next);
  }

  useEffect(() => {
    if (grade == null || unit == null || mode !== "vocabulary") return;
    let cancelled = false;
    setLoading(true);
    setSaved(false);
    getVocabularyUnit(grade, unit).then(doc => {
      if (cancelled) return;
      setVocabGroups(doc?.groups?.length ? doc.groups : EMPTY_VOCAB_GROUPS);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [grade, unit, mode]);

  useEffect(() => {
    if (grade == null || unit == null || mode !== "practice-test" || practiceTest == null) return;
    let cancelled = false;
    setLoading(true);
    setSaved(false);
    getKetPetPracticeTest(grade, unit, practiceTest).then(doc => {
      if (cancelled) return;
      const isPaper = !!doc?.paper;
      setAuthoring(isPaper ? "paper" : "questions");
      setPaper(doc?.paper ?? null);
      setPaperGroups(isPaper && doc.groups?.length ? doc.groups : [answerSheetGroup()]);
      setGroups(!isPaper && doc?.groups?.length ? doc.groups : EMPTY_PRACTICE_TEST_GROUPS);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [grade, unit, mode, practiceTest]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    if (mode === "practice-test") {
      if (authoring === "paper") await saveKetPetPracticeTest(grade, unit, practiceTest, paperGroups, user.uid, paper);
      else await saveKetPetPracticeTest(grade, unit, practiceTest, groups, user.uid);
    } else {
      await saveVocabularyUnit(grade, unit, vocabGroups, user.uid);
    }
    setSaving(false);
    setSaved(true);
  }

  if (grade == null) {
    return (
      <div className="admin-card">
        <h2>KET / PET — chọn khối lớp</h2>
        <div className="admin-picker-grid">
          {grades.map(g => (
            <button key={g} className="admin-picker-tile" style={{ "--accent": ACCENT }} onClick={() => setGrade(g)}>
              <span className="admin-picker-tile-dot" />
              <span className="admin-picker-tile-title">{`Grade ${g}`}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (unit == null) {
    return (
      <div className="admin-card">
        <button type="button" className="admin-pill-btn" onClick={() => setGrade(null)}>← Chọn khối khác</button>
        <h2>{`Grade ${grade} — chọn Unit`}</h2>
        <div className="admin-picker-grid">
          {unitEntries(folders).map(en => (
            <div key={en.key} className="ketpet-unit-tile-wrap">
              <button className={`admin-picker-tile${en.folder ? " is-folder" : ""}`} style={{ "--accent": ACCENT }} onClick={() => { setUnit(en.key); setMode(null); setPracticeTest(null); }}>
                <span className="admin-picker-tile-dot" />
                <span className="admin-picker-tile-title">{en.folder ? `📁 ${en.label}` : en.label}</span>
              </button>
              {en.folder && (
                <div className="ketpet-folder-actions">
                  <button type="button" className="admin-link-btn" title="Sửa tên / vị trí" onClick={() => setFolderForm({ id: en.folder.id })}>✎</button>
                  <button type="button" className="admin-link-btn admin-pill-btn-danger" title="Xoá thư mục" onClick={() => removeFolder(en.folder)}>🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {folderForm ? (
          <FolderForm
            key={folderForm.id ?? "new"}
            initial={folders.find(f => f.id === folderForm.id)}
            entries={unitEntries(folders).filter(en => en.key !== folderForm.id)}
            onCancel={() => setFolderForm(null)}
            onSubmit={submitFolder}
          />
        ) : (
          <button type="button" className="admin-btn-secondary" style={{ marginTop: 14 }} onClick={() => setFolderForm({})}>📁 Thêm thư mục</button>
        )}
      </div>
    );
  }

  if (mode == null) {
    return (
      <div className="admin-card">
        <button type="button" className="admin-pill-btn" onClick={() => setUnit(null)}>← Chọn Unit khác</button>
        <h2>{`Grade ${grade} — ${unitTitle} — chọn dạng bài`}</h2>
        <div className="admin-picker-grid">
          <button className="admin-picker-tile" style={{ "--accent": ACCENT }} onClick={() => setMode("vocabulary")}>
            <span className="admin-picker-tile-dot" />
            <span className="admin-picker-tile-title">Vocabulary</span>
          </button>
          <button className="admin-picker-tile" style={{ "--accent": ACCENT }} onClick={() => setMode("practice-test")}>
            <span className="admin-picker-tile-dot" />
            <span className="admin-picker-tile-title">Practice Test</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "practice-test" && practiceTest == null) {
    return (
      <div className="admin-card">
        <button type="button" className="admin-pill-btn" onClick={() => setMode(null)}>← Chọn dạng bài khác</button>
        <h2>{`Grade ${grade} — ${unitTitle} — Practice Test — chọn Test`}</h2>
        <div className="admin-picker-grid">
          {[1, 2, 3, 4].map(t => (
            <button
              key={t}
              className="admin-picker-tile"
              style={{ "--accent": ACCENT }}
              onClick={() => setPracticeTest(t)}
            >
              <span className="admin-picker-tile-dot" />
              <span className="admin-picker-tile-title">{`Test ${t}`}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="admin-card">Đang tải...</div>;

  async function switchAuthoring(next) {
    if (next === authoring) return;
    const msg = next === "paper"
      ? "Chuyển sang \"Tải đề lên\"? Khi xuất bản, bài sẽ lưu theo đề tải lên, phần soạn từng câu của Test này bị thay."
      : "Chuyển sang \"Soạn từng câu\"? Khi xuất bản, bài sẽ lưu theo các câu soạn, đề tải lên của Test này bị thay.";
    if (!(await confirm(msg))) return;
    setAuthoring(next);
    setSaved(false);
  }

  if (mode === "practice-test") {
    const common = {
      accent: ACCENT, gradeTitle: `Grade ${grade}`, unitTitle, testNumber: practiceTest,
      onBack: () => setPracticeTest(null), onSave: handleSave, saving, saved, isAdmin: role === "admin",
    };
    return (
      <>
      <div className="admin-segmented paper-authoring-switch">
        <button type="button" className={authoring === "questions" ? "is-active" : ""} onClick={() => switchAuthoring("questions")}>Soạn từng câu</button>
        <button type="button" className={authoring === "paper" ? "is-active" : ""} onClick={() => switchAuthoring("paper")}>Tải đề lên (PDF / Word)</button>
      </div>
      {authoring === "paper" ? (
        <KetPetPaperTestStudio {...common} paper={paper} onPaperChange={setPaper} groups={paperGroups} onGroupsChange={setPaperGroups} />
      ) : (
      <KetPetPracticeTestStudio
        accent={ACCENT}
        gradeTitle={`Grade ${grade}`}
        unitTitle={unitTitle}
        testNumber={practiceTest}
        groups={groups}
        onGroupsChange={setGroups}
        onBack={() => setPracticeTest(null)}
        onSave={handleSave}
        saving={saving}
        saved={saved}
        isAdmin={role === "admin"}
      />
      )}
      </>
    );
  }

  return (
    <KetPetVocabularyStudio
      accent={ACCENT}
      gradeTitle={`Grade ${grade}`}
      unitTitle={unitTitle}
      groups={vocabGroups}
      onGroupsChange={setVocabGroups}
      onBack={() => setMode(null)}
      onSave={handleSave}
      saving={saving}
      saved={saved}
    />
  );
}
