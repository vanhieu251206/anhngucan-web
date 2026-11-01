import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import KetPetVocabularyRunner from "../components/KetPetVocabularyRunner.jsx";
import KetPetPracticeTestRunner from "../components/KetPetPracticeTestRunner.jsx";
import IeltsPracticeRunner from "../components/IeltsPracticeRunner.jsx";
import { listKetPetSkillTests } from "../lib/adminLessons.js";
import { firstQuestionNumbers } from "../lib/grading/ielts.js";
import { KET_PET_GRADES } from "../lib/yleData.js";
import { getKetPetFolders, parseUnitKey, unitEntries, unitLabel } from "../lib/ketPetFolders.js";
import { useAuth } from "../lib/authContext.jsx";
import { useOpeningGuard } from "../lib/useOpeningGuard.jsx";
import { useClassBook } from "../lib/useClassBook.js";
import { readParams, setParams } from "../lib/urlState.js";

// Khung điều hướng KET/PET: Grade (6-9) → Unit (1-16) → Vocabulary/Practice Test (Test 1-4) / Reading (Test → Passage,
// y như IELTS, 2026-11-02).
// KHÁC cấu trúc Level/Test/Part của YLE (Starters/Movers/Flyers) nên KHÔNG đi qua LessonsPage.jsx
// — tổ chức theo chương trình SGK phổ thông (Grade/Unit), chốt với người dùng 2026-09-14.
export default function KetPetPage({ onNavigate }) {
  const [grade, setGrade] = useState(null);
  // Học sinh chỉ vào được Grade thuộc sách của lớp mình — Grade khác hiện xám (lib/useClassBook.js).
  const { canLevel, ready: bookReady } = useClassBook();
  const [unit, setUnit] = useState(null);
  const [vocabActive, setVocabActive] = useState(false);
  const [practiceTestOpen, setPracticeTestOpen] = useState(false);
  const [testNumber, setTestNumber] = useState(null);
  // Reading kiểu IELTS: màn chọn Test/Passage → làm 1 Passage (Đọc hiểu tự do, Luyện đề phải được mở theo Test).
  const [readingOpen, setReadingOpen] = useState(false);
  const [readingTests, setReadingTests] = useState(null);
  const [readingTestId, setReadingTestId] = useState(null);
  const [activeReading, setActiveReading] = useState(null); // { test, mode }
  const { user, isStaff, isAdmin, profile } = useAuth();
  const { guardStart, checking, screen, activeOpening } = useOpeningGuard();
  // Thư mục tự đặt tên chèn giữa các Unit (lib/ketPetFolders.js).
  const [folders, setFolders] = useState([]);
  useEffect(() => {
    if (grade == null) return;
    let cancelled = false;
    getKetPetFolders(grade).then(list => { if (!cancelled) setFolders(list); }, () => {});
    return () => { cancelled = true; };
  }, [grade]);
  const unitName = unitLabel(unit, folders);

  useEffect(() => {
    if (!readingOpen || grade == null || unit == null) return;
    let cancelled = false;
    setReadingTests(null);
    listKetPetSkillTests("reading", grade, unit).then(
      list => {
        if (cancelled) return;
        setReadingTests(list);
        setReadingTestId(id => (list.some(t => t.id === id) ? id : list[0]?.id ?? null));
      },
      () => { if (!cancelled) setReadingTests([]); },
    );
    return () => { cancelled = true; };
  }, [readingOpen, grade, unit]);

  // Vào thẳng 1 bài từ chuông thông báo (AssignmentBell.jsx): ?level=<grade>&go=ketpet-vocab~unit5 | ketpet-test~unit5-test2.
  useEffect(() => {
    const p = readParams();
    const go = p.get("go");
    const g = Number(p.get("level"));
    if (!go) return;
    setParams({ go: null, level: null }, { replace: true });
    const m = go.match(/^(ketpet-vocab|ketpet-test|ketpet-reading)~unit([a-z0-9]+?)(?:-test(\d+))?$/);
    if (!m || !KET_PET_GRADES.includes(g)) return;
    const [, kind, u, t] = m;
    const testId = go.slice(kind.length + 1);
    setGrade(g);
    setUnit(parseUnitKey(u));
    if (kind === "ketpet-reading") {
      setReadingTestId(testId);
      setReadingOpen(true);
    } else if (kind === "ketpet-vocab") {
      guardStart(kind, { id: testId, title: `Grade ${g} · ${/^\d+$/.test(u) ? `Unit ${u}` : "Thư mục"} · Vocabulary` }, { seriesId: "ket-pet", level: g }, () => setVocabActive(true));
    } else if (t) {
      setPracticeTestOpen(true);
      guardStart(kind, { id: testId, title: `Grade ${g} · ${/^\d+$/.test(u) ? `Unit ${u}` : "Thư mục"} · Test ${t}` }, { seriesId: "ket-pet", level: g }, () => setTestNumber(Number(t)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Ngữ cảnh học sinh làm bài (đếm lượt/lưu kết quả/số phút) — xem lib/openings.js.
  const ctx = {
    studentUid: !isStaff ? user?.uid : null,
    studentName: isStaff ? (isAdmin ? "[Test - Admin]" : "[Test - Giáo viên]") : profile?.displayName ?? "",
    studentClass: isStaff ? "Admin" : profile?.className ?? "",
    openingId: activeOpening?.id,
    limitMinutes: activeOpening?.timeLimitMinutes,
  };

  // Màn nhập mật khẩu / báo bài đang khoá (xem useOpeningGuard).
  if (screen) return screen;

  if (vocabActive) {
    return (
      <KetPetVocabularyRunner
        grade={grade}
        unit={unit}
        unitTitle={unitName}
        onNavigate={onNavigate}
        onBack={() => setVocabActive(false)}
        ctx={ctx}
      />
    );
  }

  if (activeReading) {
    return (
      <IeltsPracticeRunner
        kind="ketpet-reading"
        test={activeReading.test}
        mode={activeReading.mode}
        part={activeReading.test.part}
        firstNumber={activeReading.test.firstNumber}
        openingId={ctx.openingId}
        studentUid={ctx.studentUid}
        studentName={ctx.studentName}
        studentClass={ctx.studentClass}
        seriesId="ket-pet"
        level={grade}
        onBack={() => setActiveReading(null)}
      />
    );
  }

  if (testNumber != null) {
    return (
      <KetPetPracticeTestRunner
        grade={grade}
        unit={unit}
        unitTitle={unitName}
        testNumber={testNumber}
        onNavigate={onNavigate}
        onBack={() => setTestNumber(null)}
        ctx={ctx}
      />
    );
  }

  function backLabel() {
    if (practiceTestOpen || readingOpen) return `Grade ${grade} — ${unitName}`;
    if (unit != null) return `Grade ${grade}`;
    if (grade != null) return "KET / PET";
    return "Trang chủ";
  }

  function onBack() {
    if (practiceTestOpen) return setPracticeTestOpen(false);
    if (readingOpen) return setReadingOpen(false);
    if (unit != null) return setUnit(null);
    if (grade != null) return setGrade(null);
    onNavigate("home");
  }

  let title = "KET / PET";
  let subtitle = "Chọn khối lớp";
  if (grade != null && unit == null) {
    title = `Grade ${grade}`;
    subtitle = "Chọn Unit";
  } else if (readingOpen) {
    title = `Grade ${grade} — ${unitName} — Reading`;
    subtitle = "Chọn Test & Passage";
  } else if (grade != null && unit != null && !practiceTestOpen) {
    title = `Grade ${grade} — ${unitName}`;
    subtitle = "";
  } else if (practiceTestOpen) {
    title = `Grade ${grade} — ${unitName} — Practice Test`;
    subtitle = "Chọn Test";
  }

  return (
    <div className="home-v2 lessons-screen-v2">
      <Header page="lessons" onNavigate={onNavigate} />

      <div className="dark-hero-band dark-hero-band-sm">
        <div className="dark-hero-inner dark-hero-inner-row">
          <div className="dark-hero-text dark-hero-text-row">
            <button className="lesson-back-link" onClick={onBack}>
              ⬅ {backLabel()}
            </button>
            <div className="dark-hero-titles">
              <h1 className="dark-hero-title">{title}</h1>
              {subtitle && <p className="dark-hero-subtitle">{subtitle}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid-section content-grid-section-dark">
        {grade == null && (
          <div className="content-grid ketpet-grade-grid">
            {KET_PET_GRADES.map(g => (
              <button
                key={g}
                className={`content-card-v2 content-card-v2-center ielts-skill-tile${bookReady && !canLevel("ket-pet", g) ? " is-locked" : ""}`}
                disabled={!canLevel("ket-pet", g)}
                style={{ "--accent": "#8B5CF6" }}
                onClick={() => setGrade(g)}
              >
                <span className="ielts-skill-tile-label">{`Grade ${g}`}</span>
              </button>
            ))}
          </div>
        )}

        {grade != null && unit == null && (
          <div className="content-grid ketpet-unit-grid">
            {unitEntries(folders).map(en => (
              <button
                key={en.key}
                className="content-card-v2 content-card-v2-center ielts-skill-tile"
                style={{ "--accent": "#8B5CF6" }}
                onClick={() => setUnit(en.key)}
              >
                <span className="ielts-skill-tile-label">{en.folder ? `📁 ${en.label}` : en.label}</span>
              </button>
            ))}
          </div>
        )}

        {grade != null && unit != null && !practiceTestOpen && !readingOpen && (
          <div className="content-grid content-grid-2">
            <button
              type="button"
              className="content-card-v2 content-card-v2-center"
              style={{ "--accent": "#8B5CF6" }}
              disabled={checking}
              onClick={() => guardStart("ketpet-vocab", { id: `unit${unit}`, title: `Grade ${grade} · ${unitName} · Vocabulary` }, { seriesId: "ket-pet", level: grade }, () => setVocabActive(true))}
            >
              <div className="card-banner-strip">
                <span>Vocabulary</span>
              </div>
              <div className="content-card-v2-body">
                <span className="series-status is-ready">Đang mở</span>
              </div>
            </button>
            <button
              type="button"
              className="content-card-v2 content-card-v2-center"
              style={{ "--accent": "#8B5CF6" }}
              onClick={() => setPracticeTestOpen(true)}
            >
              <div className="card-banner-strip">
                <span>Practice Test</span>
              </div>
              <div className="content-card-v2-body">
                <span className="series-status is-ready">Đang mở</span>
              </div>
            </button>
            <button
              type="button"
              className="content-card-v2 content-card-v2-center"
              style={{ "--accent": "#8B5CF6" }}
              onClick={() => setReadingOpen(true)}
            >
              <div className="card-banner-strip">
                <span>Reading</span>
              </div>
              <div className="content-card-v2-body">
                <span className="series-status is-ready">Đang mở</span>
              </div>
            </button>
          </div>
        )}

        {readingOpen && readingTests === null && <p className="work-empty">Đang tải...</p>}
        {readingOpen && readingTests?.length === 0 && <p className="work-empty">Unit này chưa có bài Reading.</p>}
        {readingOpen && readingTests?.length > 0 && (() => {
          const test = readingTests.find(t => t.id === readingTestId) ?? readingTests[0];
          const testNo = id => /-test(\d+)$/.exec(id)?.[1] ?? "";
          return (
            <>
              <div className="ielts-testpicker-tabs">
                {readingTests.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ielts-testpicker-tab${t.id === test.id ? " is-active" : ""}`}
                    onClick={() => setReadingTestId(t.id)}
                  >
                    Test {testNo(t.id)}
                  </button>
                ))}
              </div>
              <div className="content-grid content-grid-4">
                {(test.passages ?? []).map((p, i) => {
                  function openPassage(mode) {
                    const launch = opening => setActiveReading({
                      mode,
                      test: {
                        ...test,
                        timeLimitMinutes: opening?.timeLimitMinutes ?? null,
                        title: `${test.title || `Reading Test ${testNo(test.id)}`} · Passage ${i + 1}`,
                        passages: [p],
                        part: i,
                        firstNumber: firstQuestionNumbers(test.passages)[i] ?? 1,
                      },
                    });
                    // Đọc hiểu là chế độ học (không chấm điểm) nên không cần mở; Luyện đề phải được giáo viên mở (như IELTS).
                    if (mode === "practice") guardStart("ketpet-reading", { id: test.id, title: test.title || `Grade ${grade} · ${unitName} · Reading Test ${testNo(test.id)}` }, { seriesId: "ket-pet", level: grade }, launch);
                    else launch(null);
                  }
                  return (
                    <div className="content-card-v2 lesson-card-split" key={i} style={{ "--accent": "#8B5CF6" }}>
                      <div className="card-banner-strip">
                        <span>{p.title || `Passage ${i + 1}`}</span>
                      </div>
                      <div className="content-card-v2-body">
                        <div className="lesson-card-split-ctas">
                          <button type="button" className="btn btn-secondary" onClick={() => openPassage("comprehension")}>Đọc hiểu</button>
                          <button type="button" className="btn btn-primary" disabled={checking} onClick={() => openPassage("practice")}>Luyện đề</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {grade != null && unit != null && practiceTestOpen && (
          <div className="content-grid content-grid-4 content-grid-4-nowrap">
            {[1, 2, 3, 4].map(t => (
              <button
                key={t}
                type="button"
                className="content-card-v2 content-card-v2-center"
                style={{ "--accent": "#8B5CF6" }}
                disabled={checking}
                onClick={() => guardStart("ketpet-test", { id: `unit${unit}-test${t}`, title: `Grade ${grade} · ${unitName} · Test ${t}` }, { seriesId: "ket-pet", level: grade }, () => setTestNumber(t))}
              >
                <div className="card-banner-strip">
                  <span>{`Test ${t}`}</span>
                </div>
                <div className="content-card-v2-body">
                  <span className="series-status is-ready">Đang mở</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
