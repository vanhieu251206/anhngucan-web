import { useState } from "react";
import Header from "../components/Header.jsx";
import KetPetVocabularyRunner from "../components/KetPetVocabularyRunner.jsx";
import KetPetPracticeTestRunner from "../components/KetPetPracticeTestRunner.jsx";
import { KET_PET_GRADES, KET_PET_UNITS_PER_GRADE } from "../lib/yleData.js";
import { useAuth } from "../lib/authContext.jsx";
import { useOpeningGuard } from "../lib/useOpeningGuard.jsx";
import { useClassBook } from "../lib/useClassBook.js";

// Khung điều hướng KET/PET: Grade (6-9) → Unit (1-16) → Vocabulary/Practice Test (Test 1-4).
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
  const { user, isStaff, isAdmin, profile } = useAuth();
  const { guardStart, checking, screen, activeOpening } = useOpeningGuard();
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
        onNavigate={onNavigate}
        onBack={() => setVocabActive(false)}
        ctx={ctx}
      />
    );
  }

  if (testNumber != null) {
    return (
      <KetPetPracticeTestRunner
        grade={grade}
        unit={unit}
        testNumber={testNumber}
        onNavigate={onNavigate}
        onBack={() => setTestNumber(null)}
        ctx={ctx}
      />
    );
  }

  function backLabel() {
    if (practiceTestOpen) return `Grade ${grade} — Unit ${unit}`;
    if (unit != null) return `Grade ${grade}`;
    if (grade != null) return "KET / PET";
    return "Trang chủ";
  }

  function onBack() {
    if (practiceTestOpen) return setPracticeTestOpen(false);
    if (unit != null) return setUnit(null);
    if (grade != null) return setGrade(null);
    onNavigate("home");
  }

  let title = "KET / PET";
  let subtitle = "Chọn khối lớp";
  if (grade != null && unit == null) {
    title = `Grade ${grade}`;
    subtitle = "Chọn Unit";
  } else if (grade != null && unit != null && !practiceTestOpen) {
    title = `Grade ${grade} — Unit ${unit}`;
    subtitle = "";
  } else if (practiceTestOpen) {
    title = `Grade ${grade} — Unit ${unit} — Practice Test`;
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
            {Array.from({ length: KET_PET_UNITS_PER_GRADE }, (_, i) => i + 1).map(u => (
              <button
                key={u}
                className="content-card-v2 content-card-v2-center ielts-skill-tile"
                style={{ "--accent": "#8B5CF6" }}
                onClick={() => setUnit(u)}
              >
                <span className="ielts-skill-tile-label">{`Unit ${u}`}</span>
              </button>
            ))}
          </div>
        )}

        {grade != null && unit != null && !practiceTestOpen && (
          <div className="content-grid content-grid-2">
            <button
              type="button"
              className="content-card-v2 content-card-v2-center"
              style={{ "--accent": "#8B5CF6" }}
              disabled={checking}
              onClick={() => guardStart("ketpet-vocab", { id: `unit${unit}`, title: `Grade ${grade} · Unit ${unit} · Vocabulary` }, { seriesId: "ket-pet", level: grade }, () => setVocabActive(true))}
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
          </div>
        )}

        {grade != null && unit != null && practiceTestOpen && (
          <div className="content-grid content-grid-4 content-grid-4-nowrap">
            {[1, 2, 3, 4].map(t => (
              <button
                key={t}
                type="button"
                className="content-card-v2 content-card-v2-center"
                style={{ "--accent": "#8B5CF6" }}
                disabled={checking}
                onClick={() => guardStart("ketpet-test", { id: `unit${unit}-test${t}`, title: `Grade ${grade} · Unit ${unit} · Test ${t}` }, { seriesId: "ket-pet", level: grade }, () => setTestNumber(t))}
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
