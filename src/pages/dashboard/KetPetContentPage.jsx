import { useEffect, useState } from "react";
import { useAuth } from "../../lib/authContext.jsx";
import { KET_PET_GRADES, KET_PET_UNITS_PER_GRADE } from "../../lib/yleData.js";
import { getVocabularyUnit, saveVocabularyUnit, getKetPetPracticeTest, saveKetPetPracticeTest } from "../../lib/adminLessons.js";
import KetPetVocabularyStudio, { EMPTY_VOCAB_GROUPS } from "../../components/dashboard/KetPetVocabularyStudio.jsx";
import KetPetPracticeTestStudio, { EMPTY_PRACTICE_TEST_GROUPS } from "../../components/dashboard/KetPetPracticeTestStudio.jsx";
import KetPetPaperTestStudio from "../../components/dashboard/KetPetPaperTestStudio.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { answerSheetGroup } from "../../lib/ketPetPracticeTest.js";
import { levelAccessOf } from "../../lib/teacherScope.js";

const ACCENT = "#8B5CF6";

// CMS soạn KET/PET — Grade (6-9) → Unit (1-16) → Vocabulary/Practice Test (Test 1-4). Tách riêng khỏi
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
      accent: ACCENT, gradeTitle: `Grade ${grade}`, unitTitle: `Unit ${unit}`, testNumber: practiceTest,
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
        unitTitle={`Unit ${unit}`}
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
