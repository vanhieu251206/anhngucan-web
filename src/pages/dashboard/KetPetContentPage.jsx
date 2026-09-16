import { useEffect, useState } from "react";
import { useAuth } from "../../lib/authContext.jsx";
import { KET_PET_GRADES, KET_PET_UNITS_PER_GRADE } from "../../lib/yleData.js";
import { getVocabularyUnit, saveVocabularyUnit, getKetPetPracticeTest, saveKetPetPracticeTest } from "../../lib/adminLessons.js";
import KetPetVocabularyStudio, { EMPTY_VOCAB_GROUPS } from "../../components/dashboard/KetPetVocabularyStudio.jsx";
import KetPetPracticeTestStudio, { EMPTY_PRACTICE_TEST_GROUPS } from "../../components/dashboard/KetPetPracticeTestStudio.jsx";

const ACCENT = "#8B5CF6";

// CMS soạn KET/PET — Grade (6-9) → Unit (1-16) → Vocabulary/Practice Test (Test 1-4). Tách riêng khỏi
// CreateLessonPage.jsx vì KET/PET không đi theo Level/Test như các bộ khác (xem yleData.js, App.jsx
// `ket-pet` branch).
export default function KetPetContentPage() {
  const { user } = useAuth();
  const [grade, setGrade] = useState(null);
  const [unit, setUnit] = useState(null);
  const [mode, setMode] = useState(null); // "vocabulary" | "practice-test"
  const [practiceTest, setPracticeTest] = useState(null); // 1-4
  const [vocabGroups, setVocabGroups] = useState(EMPTY_VOCAB_GROUPS);
  const [groups, setGroups] = useState(EMPTY_PRACTICE_TEST_GROUPS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      setGroups(doc?.groups?.length ? doc.groups : EMPTY_PRACTICE_TEST_GROUPS);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [grade, unit, mode, practiceTest]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    if (mode === "practice-test") {
      await saveKetPetPracticeTest(grade, unit, practiceTest, groups, user.uid);
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
          {KET_PET_GRADES.map(g => (
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
          {Array.from({ length: KET_PET_UNITS_PER_GRADE }, (_, i) => i + 1).map(u => (
            <button key={u} className="admin-picker-tile" style={{ "--accent": ACCENT }} onClick={() => { setUnit(u); setMode(null); setPracticeTest(null); }}>
              <span className="admin-picker-tile-dot" />
              <span className="admin-picker-tile-title">{`Unit ${u}`}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode == null) {
    return (
      <div className="admin-card">
        <button type="button" className="admin-pill-btn" onClick={() => setUnit(null)}>← Chọn Unit khác</button>
        <h2>{`Grade ${grade} — Unit ${unit} — chọn dạng bài`}</h2>
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
        <h2>{`Grade ${grade} — Unit ${unit} — Practice Test — chọn Test`}</h2>
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

  if (mode === "practice-test") {
    return (
      <KetPetPracticeTestStudio
        accent={ACCENT}
        gradeTitle={`Grade ${grade}`}
        unitTitle={`Unit ${unit}`}
        testNumber={practiceTest}
        groups={groups}
        onGroupsChange={setGroups}
        onBack={() => setPracticeTest(null)}
        onSave={handleSave}
        saving={saving}
        saved={saved}
      />
    );
  }

  return (
    <KetPetVocabularyStudio
      accent={ACCENT}
      gradeTitle={`Grade ${grade}`}
      unitTitle={`Unit ${unit}`}
      groups={vocabGroups}
      onGroupsChange={setVocabGroups}
      onBack={() => setMode(null)}
      onSave={handleSave}
      saving={saving}
      saved={saved}
    />
  );
}
