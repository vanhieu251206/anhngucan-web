import { MOCK_TESTIMONIALS, MOCK_FEATURES } from "../lib/mockData.js";
import { YLE_SERIES } from "../lib/yleData.js";

export default function HomePage({ onNavigate }) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Dành cho học sinh tiểu học</span>
          <h1>Học tiếng Anh vui như chơi game</h1>
          <p>
            Luyện Listening và Speaking theo 3 bộ đề Cambridge YLE — bé tự tin
            nói tiếng Anh mỗi ngày.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => onNavigate("lessons")}>
              Bắt đầu học
            </button>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <svg viewBox="0 0 320 280" className="hero-svg">
            <ellipse cx="160" cy="250" rx="120" ry="18" fill="#FFE3D1" />
            <circle cx="250" cy="60" r="26" fill="#FFC94A" />
            <circle cx="55" cy="90" r="16" fill="#2FB6C4" />
            <rect x="80" y="120" width="160" height="100" rx="18" fill="#FF7A45" />
            <rect x="96" y="140" width="128" height="10" rx="5" fill="#FFF4EB" />
            <rect x="96" y="160" width="98" height="10" rx="5" fill="#FFF4EB" />
            <rect x="96" y="180" width="112" height="10" rx="5" fill="#FFF4EB" />
            <circle cx="160" cy="120" r="34" fill="#FFD9BE" />
            <circle cx="148" cy="114" r="4" fill="#2B2A28" />
            <circle cx="172" cy="114" r="4" fill="#2B2A28" />
            <path d="M148 128 Q160 138 172 128" stroke="#2B2A28" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Vì sao bé sẽ thích học ở đây?</h2>
        <div className="feature-grid">
          {MOCK_FEATURES.map(f => (
            <div className="feature-card" key={f.title}>
              <span className="feature-dot" style={{ background: f.color }} />
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-alt">
        <h2 className="section-title">3 bộ đề luyện thi</h2>
        <div className="lesson-grid">
          {YLE_SERIES.map(s => (
            <button
              className="lesson-preview-card"
              key={s.id}
              onClick={() => onNavigate("lessons")}
              style={{ "--accent": s.color }}
            >
              <h3>{s.title}</h3>
              <span className="lesson-count">{s.levels.length} cấp độ · Listening & Speaking</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Phụ huynh nói gì?</h2>
        <div className="testimonial-grid">
          {MOCK_TESTIMONIALS.map(t => (
            <blockquote className="testimonial-card" key={t.name}>
              <p>“{t.quote}”</p>
              <footer>
                <strong>{t.name}</strong> — {t.role}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="cta-banner">
        <h2>Sẵn sàng cho bé học tiếng Anh chưa?</h2>
        <button className="btn btn-primary" onClick={() => onNavigate("lessons")}>
          Bắt đầu học
        </button>
      </section>
    </>
  );
}
