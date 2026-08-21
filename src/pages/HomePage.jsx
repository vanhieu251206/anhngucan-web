import Header from "../components/Header.jsx";
import { YLE_SERIES } from "../lib/yleData.js";

const BEE_IMG = `${import.meta.env.BASE_URL}assets/img/mascot/bee.png`;

// Chỉ Starters đã có bài Speaking hoàn chỉnh (Test 1, Part 1) — xem CLAUDE.md mục 6.
// Đây là dữ liệu tĩnh mô tả từng bộ đề — không phải số liệu tiến độ học sinh (app chưa
// có tính năng theo dõi tiến độ, xem CLAUDE.md mục 6-7), nên KHÔNG có streak/điểm/% hoàn thành.
const SERIES_INFO = {
  starters: {
    ready: true,
    accent: "#F5711F",
    difficulty: "Mới bắt đầu",
    difficultyLevel: 1,
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
    listeningNote: "— video nghe",
    speakingNote: "— Test 1, Part 1",
  },
  movers: {
    ready: false,
    accent: "#2fb6c4",
    difficulty: "Trung bình",
    difficultyLevel: 2,
    icon: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></>,
    listeningNote: "",
    speakingNote: "",
  },
  flyers: {
    ready: false,
    accent: "#4C9A3F",
    difficulty: "Nâng cao",
    difficultyLevel: 3,
    icon: <><path d="M2 8l10-4 10 4-10 4-10-4z" /><path d="M6 10.5V16c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-5.5" /></>,
    listeningNote: "",
    speakingNote: "",
  },
};

export default function HomePage({ onNavigate, onSelectSeries }) {
  return (
    <div className="home-v2">
      <Header page="home" onNavigate={onNavigate} />

      {/* ---------- 2. Dải header tối trang trí ---------- */}
      <div className="dark-hero-band">
        <div className="dark-hero-inner">
          {/* ---------- 3. Banner động viên ---------- */}
          <div className="motivation-banner">
            <img className="motivation-bee" src={BEE_IMG} alt="Ong linh vật Anh Ngữ C.A.N" />
            <div className="motivation-copy">
              <h2>Luyện tiếng Anh mỗi ngày để tự tin hơn khi thi Cambridge YLE nhé!</h2>
              <p>Nghe kỹ, nói to, và đừng ngại trả lời giám khảo ong nhé 🐝</p>
            </div>
            <div className="motivation-mini-row">
              {YLE_SERIES.map(s => {
                const info = SERIES_INFO[s.id] ?? SERIES_INFO.movers;
                return (
                  <div className="motivation-mini-card" key={s.id}>
                    <strong>{s.title}</strong>
                    <span>{info.difficulty} · {s.levels.length} cấp độ</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 4. Lưới thẻ bộ đề ---------- */}
      <section className="content-grid-section">
        <div className="content-grid">
          {YLE_SERIES.map(s => {
            const info = SERIES_INFO[s.id] ?? SERIES_INFO.movers;
            return (
              <button
                className="content-card-v2"
                key={s.id}
                onClick={() => onSelectSeries(s.id)}
                style={{ "--accent": info.accent }}
              >
                <div className="card-banner-strip">
                  <span>{s.title}</span>
                </div>
                <div className="content-card-v2-body">
                  <div className="series-card-top">
                    <span className="series-card-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        {info.icon}
                      </svg>
                    </span>
                    <span className={`series-status${info.ready ? " is-ready" : ""}`}>
                      {info.ready ? "Đang mở" : "Sắp có"}
                    </span>
                  </div>
                  <h3>{s.title}</h3>
                  <p className="series-levels">Cấp 1 – Cấp {s.levels.length} · {info.difficulty}</p>
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
                  <div className="card-meta-row">
                    <span className="card-badge-pill">{s.levels.length} cấp độ</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

      </section>
    </div>
  );
}
