import { useState } from "react";
import Header from "../components/Header.jsx";
import KetPetVocabularyRunner from "../components/KetPetVocabularyRunner.jsx";
import { KET_PET_GRADES, KET_PET_UNITS_PER_GRADE } from "../lib/yleData.js";

// Khung điều hướng KET/PET: Grade (6-9) → Unit (1-16) → Vocabulary/Practice Test.
// KHÁC cấu trúc Level/Test/Part của YLE (Starters/Movers/Flyers) nên KHÔNG đi qua LessonsPage.jsx
// — tổ chức theo chương trình SGK phổ thông (Grade/Unit), chốt với người dùng 2026-09-14.
// MỚI CHỈ là khung điều hướng, Vocabulary/Practice Test của từng Unit vẫn là placeholder "Sắp có",
// chưa có nội dung thật (tự biên soạn sau, không theo 1 sách cụ thể).
export default function KetPetPage({ onNavigate }) {
  const [grade, setGrade] = useState(null);
  const [unit, setUnit] = useState(null);
  const [vocabActive, setVocabActive] = useState(false);
  const [practiceTestOpen, setPracticeTestOpen] = useState(false);

  if (vocabActive) {
    return (
      <KetPetVocabularyRunner
        grade={grade}
        unit={unit}
        onNavigate={onNavigate}
        onBack={() => setVocabActive(false)}
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
                className="content-card-v2 content-card-v2-center ielts-skill-tile"
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
              onClick={() => setVocabActive(true)}
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
          <div className="content-grid content-grid-4">
            {[1, 2, 3, 4].map(t => (
              <div key={t} className="content-card-v2 content-card-v2-center is-disabled" style={{ "--accent": "#8B5CF6" }}>
                <div className="card-banner-strip">
                  <span>{`Test ${t}`}</span>
                </div>
                <div className="content-card-v2-body">
                  <span className="series-status">Sắp có</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
