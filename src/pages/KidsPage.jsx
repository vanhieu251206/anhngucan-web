import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import BookReader from "../components/BookReader.jsx";
import { KIDS_GRADES, KIDS_BOOK_KINDS } from "../lib/yleData.js";
import { getKidsBook } from "../lib/adminLessons.js";
import { useClassBook } from "../lib/useClassBook.js";

const KIDS_ACCENT = "#F2A93B";

// Trang Kids: chia theo Grade 1-5 (chốt 2026-09-23) — mỗi Grade có ĐÚNG 2 quyển sách cố định
// (Student Book/Workbook, chốt cùng ngày), lật trang kiểu flipbook (soạn qua CMS →
// KidsContentPage.jsx, lưu ở collection Firestore "kidsBooks"). Listening/Speaking từng Grade vẫn
// chưa có nội dung thật nên vẫn hiện "Sắp có".
export default function KidsPage({ onNavigate }) {
  const [grade, setGrade] = useState(null);
  // Học sinh chỉ vào được Grade thuộc sách của lớp mình — Grade khác hiện xám (lib/useClassBook.js).
  const { canLevel, ready: bookReady } = useClassBook();
  const [book, setBook] = useState(null); // { id, title, pages } đang đọc, null = màn chọn sách
  const [loadingKind, setLoadingKind] = useState(null);

  if (book) {
    return <BookReader book={book} onBack={() => setBook(null)} />;
  }

  async function openBook(kind, label) {
    setLoadingKind(kind);
    const data = await getKidsBook(grade, kind).catch(() => null);
    setLoadingKind(null);
    setBook({ id: `grade${grade}-${kind}`, title: `Grade ${grade} — ${label}`, pages: data?.pages ?? [], sounds: data?.sounds ?? [], tabs: data?.tabs ?? [] });
  }

  function backLabel() {
    if (grade != null) return "Kids";
    return "Trang chủ";
  }

  function onBack() {
    if (grade != null) return setGrade(null);
    onNavigate("home");
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
              <h1 className="dark-hero-title">{grade != null ? `Grade ${grade}` : "Kids"}</h1>
              {grade == null && <p className="dark-hero-subtitle">Chọn khối lớp</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid-section content-grid-section-dark">
        {grade == null && (
          <div className="content-grid content-grid-4">
            {KIDS_GRADES.map(g => (
              <button
                key={g}
                type="button"
                className={`content-card-v2 content-card-v2-center${bookReady && !canLevel("kids", g) ? " is-locked" : ""}`}
                disabled={!canLevel("kids", g)}
                style={{ "--accent": KIDS_ACCENT }}
                onClick={() => setGrade(g)}
              >
                <div className="card-banner-strip">
                  <span>{`Grade ${g}`}</span>
                </div>
                <div className="content-card-v2-body">
                  {bookReady && !canLevel("kids", g) ? <span className="series-status">🔒</span> : <span className="series-status is-ready">Đang mở</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {grade != null && (
          <div className="content-grid kids-skill-grid">
            {KIDS_BOOK_KINDS.map(k => (
              <button
                key={k.key}
                type="button"
                className="content-card-v2 content-card-v2-center"
                style={{ "--accent": KIDS_ACCENT }}
                disabled={loadingKind === k.key}
                onClick={() => openBook(k.key, k.label)}
              >
                <div className="card-banner-strip">
                  <span>{k.label}</span>
                </div>
                <div className="content-card-v2-body">
                  <span className="series-status is-ready">{loadingKind === k.key ? "Đang mở..." : "Đang mở"}</span>
                </div>
              </button>
            ))}

            <div className="content-card-v2 content-card-v2-center is-disabled" style={{ "--accent": KIDS_ACCENT }}>
              <div className="card-banner-strip">
                <span>Listening</span>
              </div>
              <div className="content-card-v2-body">
                <span className="series-status">Sắp có</span>
              </div>
            </div>

            <div className="content-card-v2 content-card-v2-center is-disabled" style={{ "--accent": KIDS_ACCENT }}>
              <div className="card-banner-strip">
                <span>Speaking</span>
              </div>
              <div className="content-card-v2-body">
                <span className="series-status">Sắp có</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
