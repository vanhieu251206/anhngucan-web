import { useEffect, useMemo, useRef, useState } from "react";
import { RESULT_MODE_LABEL } from "../../lib/testResults.js";
import { loadResultAnalysis, buildAnalysis, pctOf } from "../../lib/resultAnalysis.js";
import { formatAway } from "../../lib/examFocus.js";

export function fmtScore(n) {
  return Number(n).toFixed(2).replace(/\.?0+$/, "");
}

export function fmtDuration(ms) {
  if (ms == null) return "—";
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}p ${String(sec % 60).padStart(2, "0")}s`;
}

export function fmtWhen(d) {
  return d ? d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";
}

const tone = pct => (pct == null ? "is-na" : pct >= 80 ? "is-high" : pct >= 50 ? "is-mid" : "is-low");
const pctText = pct => (pct == null ? "—" : `${pct}%`);
const BUCKETS = ["0–19", "20–39", "40–59", "60–79", "80–100"];

// Màn "Phân tích bài làm" của 1 lượt nộp (thay hộp "Chi tiết" cũ ở Kết quả học sinh): điểm + so với chính em / lớp /
// trung tâm + từng phần + từng câu. Một khung chung cho mọi dạng bài (số liệu ở lib/resultAnalysis.js); `children`
// là bảng chi tiết từng câu của dạng bài đó. Bài thử của admin/giáo viên và lượt Speaking cũ chỉ có phần chi tiết.
export default function ResultAnalysisPage({ row, onBack, actions, children }) {
  const r = row.raw;
  const comparable = row.kind === "result" && !!r.uid && !!r.openingId && row.total > 0;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "start" });
    if (!comparable) return;
    let alive = true;
    setData(null);
    setError(null);
    loadResultAnalysis(r)
      .then(d => alive && setData(d))
      .catch(err => alive && setError(err.message || String(err)));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.key]);

  const a = useMemo(() => (data ? buildAnalysis(r, data) : null), [data, r]);
  const myPct = pctOf(row.correct, row.total);
  const modeLabel = RESULT_MODE_LABEL[row.mode] ?? row.mode;
  const leaves = row.tabLeaves ?? [];

  return (
    <div className="ra" ref={rootRef}>
      <div className="ra-topline">
        <button className="opening-btn" type="button" onClick={onBack}>← Kết quả học sinh</button>
        <div className="opening-actions">{actions}</div>
      </div>

      <div className="admin-card ra-hero">
        <ScoreRing pct={myPct} />
        <div className="ra-hero-main">
          <h2>{row.studentName || "—"}</h2>
          <div className="ra-hero-meta">
            {row.studentClass && <span className="opening-chip opening-chip-class">{row.studentClass}</span>}
            <span className="ra-chip">{modeLabel}</span>
            {r.overtime && <span className="opening-chip opening-chip-off">Nộp quá giờ</span>}
            {row.unfinished && <span className="opening-chip opening-chip-wait">Làm dở</span>}
          </div>
          <p className="admin-muted-text">{row.lessonLabel || "—"} · nộp {fmtWhen(row.when)}</p>
          {row.classAtSubmit && row.classAtSubmit !== row.studentClass && <p className="admin-muted-text">Lúc nộp: lớp {row.classAtSubmit}</p>}
        </div>
        <div className="ra-kpis">
          <Kpi label="Điểm" value={row.correct == null ? "—" : `${fmtScore(row.correct)}/${fmtScore(row.total)}`} />
          <Kpi label="Thời gian" value={fmtDuration(row.elapsedMs)} sub={a?.medianMs != null && a.peerCount > 1 ? `lớp ${fmtDuration(a.medianMs)}` : null} />
          <Kpi label="Hạng trong lớp" value={a ? `${a.cls.rank}/${a.cls.count}` : "—"} />
          <Kpi label="Rời tab" value={leaves.length ? `${leaves.length} lần` : "0"} warn={leaves.length > 0} />
        </div>
      </div>

      {error && <p className="admin-error">Lỗi tải số liệu so sánh: {error}</p>}
      {comparable && !a && !error && (
        <div className="admin-loading-row"><span className="admin-spinner" /><span>Đang tải số liệu so sánh...</span></div>
      )}

      {a && (
        <>
          <div className="admin-card">
            <h3 className="ra-title">Tổng quan so sánh</h3>
            <div className="ra-bars">
              <CompareBar label="Bài này" value={a.myPct} strong />
              <CompareBar label="TB của chính em" sub={`${a.self.count} bài trước`} value={a.self.avg} base={a.myPct} />
              <CompareBar label={`TB lớp ${r.studentClass ?? ""}`} sub={`${a.cls.count} em đã nộp`} value={a.cls.avg} base={a.myPct} />
              <CompareBar label="TB trung tâm" sub={`${a.center.count} em · ${a.center.classCount} lớp`} value={a.center.avg} base={a.myPct} />
            </div>
          </div>

          <div className="ra-grid3">
            <div className="admin-card">
              <h3 className="ra-title">So với chính em</h3>
              {a.self.count === 0 ? (
                <p className="admin-muted-text">Bài đầu tiên có điểm của em.</p>
              ) : (
                <>
                  <Headline value={<Delta value={a.myPct - a.self.avg} />} note="so với trung bình các bài trước" />
                  <Stats rows={[
                    ["TB các bài trước", pctText(a.self.avg), `${a.self.count} bài`],
                    [`TB ${modeLabel}`, pctText(a.self.sameModeAvg), `${a.self.sameModeCount} bài`],
                    ["Điểm cao nhất từng đạt", pctText(a.self.best)],
                    ["Bài liền trước", pctText(a.self.last?.pct), a.self.last?.label],
                  ]} />
                  <Trend points={a.self.history.slice(-12)} avg={a.self.avg} />
                </>
              )}
            </div>

            <div className="admin-card">
              <h3 className="ra-title">So với lớp {r.studentClass}</h3>
              <Headline value={`Hạng ${a.cls.rank}/${a.cls.count}`} note={<Delta value={a.myPct - a.cls.avg} suffix=" so với TB lớp" />} />
              <Stats rows={[
                ["Trung bình lớp", pctText(a.cls.avg)],
                ["Trung vị", pctText(a.cls.median)],
                ["Cao nhất · Thấp nhất", `${pctText(a.cls.max)} · ${pctText(a.cls.min)}`],
                ["Đã nộp", a.cls.size ? `${a.cls.count}/${a.cls.size} em` : `${a.cls.count} em`],
              ]} />
              <Histogram counts={a.cls.histogram} myPct={a.myPct} />
            </div>

            <div className="admin-card">
              <h3 className="ra-title">So với trung tâm</h3>
              <Headline
                value={a.center.beat == null ? "—" : `Cao hơn ${a.center.beat}%`}
                note={a.center.beat == null ? "Chưa có em nào khác làm bài này" : `học sinh cùng làm bài này · hạng ${a.center.rank}/${a.center.count}`}
              />
              <Stats rows={[
                ["TB bài này", pctText(a.center.avg), `${a.center.count} em · ${a.center.classCount} lớp`],
                ["Cao nhất · Thấp nhất", `${pctText(a.center.max)} · ${pctText(a.center.min)}`],
                [`TB ${modeLabel} cùng cấp`, pctText(a.level.avg), `${a.level.count} lượt`],
              ]} />
              <Histogram counts={a.center.histogram} myPct={a.myPct} />
            </div>
          </div>

          <div className="ra-grid2">
            <div className="admin-card">
              {a.sections.length > 1 && (
                <>
                  <h3 className="ra-title">Theo từng phần</h3>
                  <table className="admin-table ra-sections">
                    <thead><tr><th>Phần</th><th>Em này</th><th>Lớp</th><th></th></tr></thead>
                    <tbody>
                      {a.sections.map(s => (
                        <tr key={s.name}>
                          <td><strong>{s.name}</strong></td>
                          <td>
                            <div className="ra-mini"><span className={tone(s.pct)} style={{ width: `${s.pct}%` }} /></div>
                            {s.pct}%
                          </td>
                          <td>{a.peerCount > 1 ? pctText(s.classPct) : "—"}</td>
                          <td>{a.peerCount > 1 && s.classPct != null && <Delta value={s.pct - s.classPct} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <QuestionMap questions={a.questions} peerCount={a.peerCount} />
            </div>

            <div className="admin-card">
              <h3 className="ra-title">Bảng điểm lớp</h3>
              <ol className="ra-ranking">
                {a.cls.ranking.map((x, i) => (
                  <li key={x.uid} className={x.isMe ? "is-me" : ""}>
                    <span className="ra-rank-no">{i + 1}</span>
                    <span className="ra-rank-name">{x.name}</span>
                    <div className="ra-mini"><span className={tone(x.pct)} style={{ width: `${x.pct}%` }} /></div>
                    <strong>{x.pct}%</strong>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {a.myAttempts.length > 1 && (
            <div className="admin-card">
              <h3 className="ra-title">Các lượt làm bài này</h3>
              <div className="ra-attempts">
                {a.myAttempts.map((x, i) => (
                  <div key={x.id} className={`ra-attempt${x.id === r.id ? " is-me" : ""}`}>
                    <small>Lượt {i + 1} · {fmtWhen(x.at)}</small>
                    <span className={`results-score ${tone(x.pct)}`}>{pctText(x.pct)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {leaves.length > 0 && (
        <div className="results-leaves">
          <strong>Rời khỏi bài {leaves.length} lần</strong>
          <ul>
            {leaves.map((l, i) => (
              <li key={i}>{l.at?.toDate ? l.at.toDate().toLocaleTimeString("vi-VN") : "—"} · vắng {formatAway(l.awayMs)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-card">
        <h3 className="ra-title">Chi tiết từng câu</h3>
        {children}
      </div>
    </div>
  );
}

function ScoreRing({ pct }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className={`ra-ring ${tone(pct)}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={R} className="ra-ring-track" />
        <circle cx="60" cy="60" r={R} className="ra-ring-value" strokeDasharray={`${((pct ?? 0) / 100) * C} ${C}`} />
      </svg>
      <span>{pct == null ? "—" : pct}{pct != null && <small>%</small>}</span>
    </div>
  );
}

function Kpi({ label, value, sub, warn }) {
  return (
    <div className={`ra-kpi${warn ? " is-warn" : ""}`}>
      <small>{label}</small>
      <span>{value}</span>
      {sub && <em>{sub}</em>}
    </div>
  );
}

function Delta({ value, suffix = "" }) {
  if (value == null || Number.isNaN(value)) return <span className="ra-delta">—</span>;
  const cls = value > 0 ? "is-up" : value < 0 ? "is-down" : "";
  return <span className={`ra-delta ${cls}`}>{value > 0 ? "▲" : value < 0 ? "▼" : "="} {Math.abs(value)}%{suffix}</span>;
}

function Headline({ value, note }) {
  return (
    <div className="ra-headline">
      <span>{value}</span>
      <small>{note}</small>
    </div>
  );
}

function Stats({ rows }) {
  return (
    <dl className="ra-stats">
      {rows.map(([label, value, sub]) => (
        <div key={label}>
          <dt>{label}{sub && <small>{sub}</small>}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompareBar({ label, sub, value, base, strong }) {
  return (
    <div className={`ra-bar${strong ? " is-strong" : ""}`}>
      <div className="ra-bar-label">{label}{sub && <small>{sub}</small>}</div>
      <div className="ra-bar-track">
        {value != null && <span className={strong ? tone(value) : ""} style={{ width: `${value}%` }} />}
        {base != null && <i style={{ left: `${base}%` }} />}
      </div>
      <strong>{pctText(value)}</strong>
      <div className="ra-bar-delta">{base != null && value != null && <Delta value={base - value} />}</div>
    </div>
  );
}

// Phân bố điểm 5 mức; cột chứa điểm của em được tô đậm.
function Histogram({ counts, myPct }) {
  const max = Math.max(1, ...counts);
  const mine = Math.min(4, Math.floor((myPct ?? 0) / 20));
  return (
    <div className="ra-hist">
      {counts.map((n, i) => (
        <div key={i} className={`ra-hist-col${i === mine ? " is-me" : ""}`}>
          <small>{n || ""}</small>
          <span style={{ height: `${(n / max) * 100}%` }} />
          <em>{BUCKETS[i]}</em>
        </div>
      ))}
    </div>
  );
}

// Điểm các bài gần đây của em theo thời gian; chấm cuối tô đậm là bài đang xem, đường đứt là trung bình các bài trước.
function Trend({ points, avg }) {
  if (points.length < 2) return null;
  const W = 300, H = 96, PAD = 10;
  const x = i => PAD + (i * (W - 2 * PAD)) / (points.length - 1);
  const y = p => H - PAD - (p / 100) * (H - 2 * PAD);
  return (
    <svg className="ra-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Điểm các bài gần đây">
      {avg != null && <line x1={PAD} x2={W - PAD} y1={y(avg)} y2={y(avg)} className="ra-trend-avg" />}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.pct)}`).join(" ")} />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.pct)} r={p.isCurrent ? 5 : 3} className={p.isCurrent ? "is-me" : ""}>
          <title>{p.label} — {p.pct}%</title>
        </circle>
      ))}
    </svg>
  );
}

// Mỗi ô 1 câu: xanh = đúng, đỏ = sai, vàng = đúng một phần, xám = không chấm. Kèm các câu lệch hẳn so với lớp.
function QuestionMap({ questions, peerCount }) {
  if (!questions.length) return null;
  const withClass = peerCount >= 3;
  const cls = q => (q.score == null ? "is-na" : q.score >= 1 ? "is-ok" : q.score <= 0 ? "is-bad" : "is-part");
  const name = q => (q.section ? `${q.section} · câu ${q.label}` : `Câu ${q.label}`);
  const missed = withClass ? questions.filter(q => q.score != null && q.score < 1 && q.classRate >= 70) : [];
  const shone = withClass ? questions.filter(q => q.score === 1 && q.classRate != null && q.classRate <= 40) : [];
  return (
    <>
      <h3 className="ra-title">Bản đồ câu hỏi</h3>
      <div className="ra-qmap">
        {questions.map((q, i) => (
          <span key={i} className={cls(q)} title={`${name(q)}${withClass && q.classRate != null ? ` — lớp đúng ${q.classRate}%` : ""}`}>{q.label}</span>
        ))}
      </div>
      <Notable title="Sai trong khi đa số lớp làm đúng" list={missed} name={name} />
      <Notable title="Đúng trong khi đa số lớp làm sai" list={shone} name={name} good />
    </>
  );
}

function Notable({ title, list, name, good }) {
  if (!list.length) return null;
  return (
    <div className={`ra-notable${good ? " is-good" : ""}`}>
      <strong>{title}</strong>
      <ul>
        {list.map((q, i) => (
          <li key={i}>
            <span>{name(q)}{q.prompt && <small> — {q.prompt.slice(0, 90)}</small>}</span>
            <em>lớp đúng {q.classRate}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
