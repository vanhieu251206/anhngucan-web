import { useEffect, useState } from "react";
import { useAuth } from "../../lib/authContext.jsx";
import { KET_PET_GRADES, KET_PET_UNITS_PER_GRADE } from "../../lib/yleData.js";
import { getVocabularyUnit, saveVocabularyUnit } from "../../lib/adminLessons.js";
import KetPetVocabularyStudio, { EMPTY_VOCAB_QUESTIONS } from "../../components/dashboard/KetPetVocabularyStudio.jsx";

const ACCENT = "#8B5CF6";

// CMS soạn KET/PET — Grade (6-9) → Unit (1-16) → Vocabulary. Tách riêng khỏi CreateLessonPage.jsx
// vì KET/PET không đi theo Level/Test như các bộ khác (xem yleData.js, App.jsx `ket-pet` branch).
// MỚI CHỈ soạn được Vocabulary — Practice Test của Unit chưa thiết kế (còn placeholder ở
// KetPetPage.jsx phía học sinh).
export default function KetPetContentPage() {
  const { user } = useAuth();
  const [grade, setGrade] = useState(null);
  const [unit, setUnit] = useState(null);
  const [questions, setQuestions] = useState(EMPTY_VOCAB_QUESTIONS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (grade == null || unit == null) return;
    let cancelled = false;
    setLoading(true);
    setSaved(false);
    getVocabularyUnit(grade, unit).then(doc => {
      if (cancelled) return;
      setQuestions(doc?.questions?.length ? doc.questions : EMPTY_VOCAB_QUESTIONS);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [grade, unit]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await saveVocabularyUnit(grade, unit, questions, user.uid);
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
            <button key={u} className="admin-picker-tile" style={{ "--accent": ACCENT }} onClick={() => setUnit(u)}>
              <span className="admin-picker-tile-dot" />
              <span className="admin-picker-tile-title">{`Unit ${u}`}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="admin-card">Đang tải...</div>;

  return (
    <KetPetVocabularyStudio
      accent={ACCENT}
      gradeTitle={`Grade ${grade}`}
      unitTitle={`Unit ${unit}`}
      questions={questions}
      onQuestionsChange={setQuestions}
      onBack={() => setUnit(null)}
      onSave={handleSave}
      saving={saving}
      saved={saved}
    />
  );
}
