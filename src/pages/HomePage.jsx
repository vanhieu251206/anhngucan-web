import Header from "../components/Header.jsx";
import { YLE_SERIES } from "../lib/yleData.js";

const BEE_IMG = `${import.meta.env.BASE_URL}assets/img/mascot/bee.png`;

// Chỉ Starters đã có bài Speaking hoàn chỉnh (Test 1, Part 1) — xem CLAUDE.md mục 6.
// Đây là dữ liệu tĩnh mô tả từng bộ đề — không phải số liệu tiến độ học sinh (app chưa
// có tính năng theo dõi tiến độ, xem CLAUDE.md mục 6-7), nên KHÔNG có streak/điểm/% hoàn thành.
const SERIES_INFO = {
  kids: {
    ready: false,
    accent: "#F2A93B",
    difficulty: "Vỡ lòng",
    difficultyLevel: 0,
    icon: <><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.5-.8L12 3z" /></>,
    listeningNote: "",
    speakingNote: "",
    skills: ["listening", "speaking"],
  },
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
    // Mở khoá thẻ theo yêu cầu người dùng 2026-08-26 — CHỈ mở giao diện, bên trong VẪN là dữ liệu
    // giả (video Listening mẫu + câu Speaking chưa có ảnh/audio thật, xem yleData.js) vì nội dung
    // Speaking thật cho Movers chưa được soạn (theo docs/quy-trinh/, cần sách gốc). Không dùng dạy
    // học sinh thật cho tới khi có nội dung thật.
    ready: true,
    accent: "#2fb6c4",
    difficulty: "Trung bình",
    difficultyLevel: 2,
    icon: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></>,
    listeningNote: "",
    speakingNote: "",
  },
  flyers: {
    // Mở khoá thẻ theo yêu cầu người dùng 2026-08-26 — xem ghi chú ở movers phía trên, áp dụng
    // tương tự cho Flyers (chưa có nội dung Speaking thật).
    ready: true,
    accent: "#4C9A3F",
    difficulty: "Nâng cao",
    difficultyLevel: 3,
    icon: <><path d="M2 8l10-4 10 4-10 4-10-4z" /><path d="M6 10.5V16c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-5.5" /></>,
    listeningNote: "",
    speakingNote: "",
  },
  "ket-pet": {
    ready: false,
    accent: "#8B5CF6",
    difficulty: "Trung cấp",
    difficultyLevel: 4,
    icon: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M8 4v14" /></>,
    listeningNote: "",
    speakingNote: "",
  },
  ielts: {
    ready: false,
    accent: "#1F3A63",
    difficulty: "Nâng cao",
    difficultyLevel: 5,
    icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" /></>,
    listeningNote: "",
    speakingNote: "",
  },
};

// 4 kỹ năng cho các bộ sách trừ Kids (Kids chỉ có Listening/Speaking, xem SERIES_INFO.kids.skills).
const SKILL_ICONS = {
  reading: <path d="M4 5.5C6 4 9 4 12 5.5V19c-3-1.5-6-1.5-8 0zM20 5.5C18 4 15 4 12 5.5V19c3-1.5 6-1.5 8 0z" />,
  listening: <path d="M4 14v-2a8 8 0 0 1 16 0v2M2 14h5v7H4a2 2 0 0 1-2-2v-5zM22 14h-5v7h3a2 2 0 0 0 2-2v-5z" />,
  speaking: <path d="M9 2h6v12a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v4" />,
  dictation: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />,
};
const SKILLS_FULL = ["reading", "listening", "speaking", "dictation"];
const SKILL_LABELS = { reading: "Reading", listening: "Listening", speaking: "Speaking", dictation: "Dictation" };

function SeriesModes({ skills }) {
  return (
    <div className="series-modes">
      {skills.map(key => (
        <span className="series-mode" key={key}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {SKILL_ICONS[key]}
          </svg>
          {SKILL_LABELS[key]}
        </span>
      ))}
    </div>
  );
}

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
              <h2>Chào mừng đến với Anh Ngữ C.A.N — người bạn đồng hành luyện thi tiếng Anh mỗi ngày!</h2>
              <p>Học cùng chú ong C.A.N mỗi ngày để tự tin chinh phục mọi kỳ thi nhé 🐝</p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 4. Lưới thẻ bộ đề ---------- */}
      <section className="content-grid-section">
        <div className="content-grid">
          {YLE_SERIES.map(s => {
            const info = SERIES_INFO[s.id] ?? SERIES_INFO.movers;
            const skills = info.skills ?? SKILLS_FULL;
            if (!info.ready) {
              return (
                <div
                  className="content-card-v2 is-disabled"
                  key={s.id}
                  style={{ "--accent": info.accent }}
                >
                  <div className="card-banner-strip">
                    <span>{s.title}</span>
                  </div>
                  <div className="content-card-v2-body">
                    <div className="series-card-top">
                      <SeriesModes skills={skills} />
                      <span className="series-status">Sắp có</span>
                    </div>
                  </div>
                </div>
              );
            }
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
                    <SeriesModes skills={skills} />
                    <span className="series-status is-ready">Đang mở</span>
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
