import Logo from "../components/Logo.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { YLE_SERIES } from "../lib/yleData.js";

const FEATURE_ROW = [
  {
    label: "Luyện nghe",
    icon: (
      <path d="M4 14v-2a8 8 0 0 1 16 0v2M2 14h5v7H4a2 2 0 0 1-2-2v-5zM22 14h-5v7h3a2 2 0 0 0 2-2v-5z" />
    ),
  },
  {
    label: "Ghi âm giọng nói",
    icon: <path d="M9 2h6v12a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v4" />,
  },
  {
    label: "Nhận phản hồi",
    icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />,
  },
  {
    label: "Tiến bộ mỗi ngày",
    icon: <path d="M3 17l6-6 4 4 8-9M15 6h6v6" />,
  },
];

// Chỉ Starters đã có bài Speaking hoàn chỉnh (Test 1, Part 1) — xem CLAUDE.md mục 6.
const SERIES_INFO = {
  starters: {
    ready: true,
    accent: "#F5711F",
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
    listeningNote: "— video nghe",
    speakingNote: "— Test 1, Part 1",
  },
  movers: {
    ready: false,
    accent: "#4C9A3F",
    icon: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></>,
    listeningNote: "",
    speakingNote: "",
  },
  flyers: {
    ready: false,
    accent: "#F5711F",
    icon: <><path d="M2 8l10-4 10 4-10 4-10-4z" /><path d="M6 10.5V16c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-5.5" /></>,
    listeningNote: "",
    speakingNote: "",
  },
};

export default function HomePage({ onNavigate, onSelectSeries }) {
  const { user, role, isStaff, logout } = useAuth();

  function handleAuthClick() {
    if (user) {
      logout();
    } else {
      onNavigate("login");
    }
  }

  return (
    <div className="home-screen">
      <div className="home-screen-inner">
        <div className="home-topbar">
          <Logo size={40} />
          <div className="home-topbar-actions">
            <button className="top-nav-login" onClick={handleAuthClick} title={user?.email}>
              {user ? `${role === "admin" ? "Admin" : "Giáo viên"} · Đăng xuất` : "Đăng nhập"}
            </button>
            <button className="top-nav-cta" onClick={() => onNavigate("lessons")}>
              Học thử ngay
            </button>
          </div>
        </div>

        <section className="hero hero-compact">
          <h1 className="hero-title">
            <span className="hero-title-line accent-green">Tiếng Anh của bạn.</span>
            <span className="hero-title-line accent-orange">C.A.N đồng hành.</span>
          </h1>

          <div className="hero-feature-row">
            {FEATURE_ROW.map((f, i) => (
              <span className="hero-feature" key={f.label}>
                {i > 0 && <span className="hero-feature-sep" aria-hidden="true">|</span>}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {f.icon}
                </svg>
                {f.label}
              </span>
            ))}
          </div>
        </section>

        <section className="section section-compact">
          <h2 className="section-title section-title-sm">Ba bộ đề, bốn cấp độ</h2>
          <p className="section-subtitle">
            Bám sát khung năng lực Cambridge YLE, mỗi cấp có bài Nghe và bài Nói riêng
          </p>

          <div className="series-grid">
            {YLE_SERIES.map(s => {
              const info = SERIES_INFO[s.id] ?? SERIES_INFO.movers;
              return (
                <button
                  className="series-card"
                  key={s.id}
                  onClick={() => onSelectSeries(s.id)}
                  style={{ "--accent": info.accent }}
                >
                  <div className="series-card-top">
                    <span className="series-card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        {info.icon}
                      </svg>
                    </span>
                    <span className={`series-status${info.ready ? " is-ready" : ""}`}>
                      {info.ready ? `${s.levels.length} cấp · đang mở` : "Sắp có"}
                    </span>
                  </div>
                  <h3>{s.title}</h3>
                  <p className="series-levels">Cấp 1 – Cấp {s.levels.length}</p>
                  <div className="series-modes">
                    <span className="series-mode">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M4 14v-2a8 8 0 0 1 16 0v2M2 14h5v7H4a2 2 0 0 1-2-2v-5zM22 14h-5v7h3a2 2 0 0 0 2-2v-5z" />
                      </svg>
                      Listening {info.listeningNote}
                    </span>
                    <span className="series-mode">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M9 2h6v12a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v4" />
                      </svg>
                      Speaking {info.speakingNote}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="practice-panels">
          <div className="practice-panel is-orange">
            <span className="practice-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2h6v12a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v4" />
              </svg>
            </span>
            <div className="practice-panel-copy">
              <h3>Chấm phát âm ngay khi ghi âm</h3>
              <p>Bé bấm giữ mic trả lời, hệ thống nghe và chấm độ chính xác từng câu.</p>
            </div>
            <div className="practice-score">
              <span className="practice-score-num">92</span>
              <span className="practice-score-label">điểm phát âm</span>
            </div>
          </div>

          <div className="practice-panel is-green">
            <span className="practice-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="7" r="2.3" /><circle cx="6.5" cy="13.5" r="2.3" /><circle cx="17.5" cy="13.5" r="2.3" />
              </svg>
            </span>
            <div className="practice-panel-copy">
              <h3>Giám khảo ong hỏi, bé trả lời</h3>
              <p>Từng scene mô phỏng đúng bài thi nói thật, có gợi ý câu trả lời mẫu.</p>
            </div>
            <div className="practice-chat">
              <span className="practice-bubble is-bee">What's your name?</span>
              <span className="practice-bubble is-you">My name is Minh.</span>
            </div>
          </div>
        </section>

        <p className="home-footnote">Anh Ngữ C.A.N · Học tiếng Anh dễ dàng, hiệu quả</p>
      </div>
    </div>
  );
}
