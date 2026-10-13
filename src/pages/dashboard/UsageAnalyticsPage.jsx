import { useEffect, useMemo, useState } from "react";
import {
  buildReport, deletableOrphans, deleteCloudinaryFiles, formatBytes, loadActivity, loadCloudinaryResources,
  loadCloudinaryUsage, localDay, scanLessonAssets,
} from "../../lib/usageReport.js";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";

const WORKER_ERRORS = {
  "cloudinary-not-configured": "Worker chưa có khoá Cloudinary (xem worker/README.md).",
  "cloudinary-bad-credentials": "Khoá Cloudinary trên Worker không đúng.",
  "cloudinary-rate-limited": "Cloudinary đang giới hạn số lượt hỏi, thử lại sau ít phút.",
  "worker-not-configured": "Chưa cấu hình VITE_WORKER_URL.",
  forbidden: "Chỉ admin xem được.",
};
const describe = err => WORKER_ERRORS[err?.message] ?? `Không lấy được số liệu Cloudinary (${err?.message ?? "lỗi"}).`;

// Nhớ tạm trong phiên: mở lại trang không quét lại (mỗi lần quét đọc mọi bài + ~40 lượt hỏi Cloudinary).
let cached = null;

async function loadAll() {
  const [usage, resources, scan, activity] = await Promise.all([
    loadCloudinaryUsage().catch(err => ({ error: describe(err) })),
    loadCloudinaryResources().catch(err => ({ error: describe(err) })),
    scanLessonAssets(),
    loadActivity().catch(() => ({ submitsByDay: {}, activeOpenings: [], doneByPath: new Map() })),
  ]);
  return { usage, resources, scan, activity, at: new Date() };
}

// Dung lượng & băng thông (chỉ admin, 2026-10-10): số thật của Cloudinary theo ngày + bài nào/file nào nặng nhất + file
// không còn bài nào dùng (có nút xoá hẳn các file đó, 2026-10-12).
export default function UsageAnalyticsPage() {
  const [data, setData] = useState(cached);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("lessons");

  function reload() {
    setLoading(true);
    setError(null);
    loadAll()
      .then(d => { cached = d; setData(d); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { if (!cached) reload(); }, []);

  const report = useMemo(
    () => data && buildReport(data.scan, data.resources.files ?? [], data.activity.activeOpenings, data.activity.doneByPath),
    [data]
  );

  if (!data) {
    return (
      <div className="admin-card">
        <h2>Dung lượng &amp; băng thông</h2>
        {error ? <p className="admin-error">Lỗi: {error}</p> : <p className="admin-muted-text">Đang quét bài và hỏi Cloudinary...</p>}
      </div>
    );
  }

  const cloudError = data.usage.error ?? data.resources.error ?? null;
  const hasSizes = !data.resources.error;
  return (
    <div>
      <div className="admin-usage-head">
        <div className="admin-usage-tabs">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" className={`admin-usage-tab${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="admin-usage-head-right">
          <span className="admin-muted-text">Cập nhật {data.at.toLocaleTimeString("vi-VN")}</span>
          <button type="button" className="admin-btn-secondary" onClick={reload} disabled={loading}>
            {loading ? "Đang tải..." : "↻ Tải lại"}
          </button>
        </div>
      </div>
      {cloudError && <p className="admin-error">{cloudError}</p>}
      {data.resources.truncated && <p className="admin-error">Cloudinary có nhiều file hơn mức quét được, danh sách file chưa đủ.</p>}

      {tab === "overview" && !data.usage.error && <UsageCards now={data.usage.now} report={report} hasSizes={hasSizes} />}
      {tab === "overview" && !data.usage.error && <DailyTable days={data.usage.days} now={data.usage.now} submitsByDay={data.activity.submitsByDay} />}
      {tab === "lessons" && <LessonTable lessons={report.lessons} hasSizes={hasSizes} />}
      {tab === "files" && hasSizes && <BiggestFiles files={report.biggest} />}
      {tab === "files" && hasSizes && (
        <Orphans
          files={report.orphans}
          bytes={report.orphanBytes}
          canDelete={!data.resources.truncated && data.scan.keysScanned}
          onDeleted={reload}
        />
      )}
    </div>
  );
}

const TABS = [["lessons", "Theo bài"], ["overview", "Tổng quan"], ["files", "File"]];

function StatCard({ label, value, sub }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-card-label">{label}</div>
      <div className="admin-stat-card-value">{value}</div>
      {sub && <div className="admin-usage-sub">{sub}</div>}
    </div>
  );
}

const num = n => (n == null ? "—" : n.toLocaleString("vi-VN"));

function UsageCards({ now, report, hasSizes }) {
  const c = now.credits;
  return (
    <div className="admin-stat-row">
      <StatCard
        label="Credit 30 ngày"
        value={c?.usage != null ? `${c.usage.toFixed(1)}${c.limit ? ` / ${c.limit}` : ""}` : "—"}
        sub={c?.usedPercent != null ? `${c.usedPercent.toFixed(0)}% hạn mức` : null}
      />
      <StatCard
        label="Lưu trữ"
        value={formatBytes(now.storage)}
        sub={hasSizes ? `Audio ${formatBytes(report.audioBytes)} · Ảnh ${formatBytes(report.imageBytes)}` : null}
      />
      <StatCard label="Băng thông 30 ngày" value={formatBytes(now.bandwidth)} />
      <StatCard label="Biến đổi ảnh 30 ngày" value={num(now.transformations)} />
      <StatCard label="Số file" value={num(now.resources)} sub={now.derivedResources != null ? `${num(now.derivedResources)} bản nén` : null} />
    </div>
  );
}

function Bar({ value, max }) {
  return <span className="admin-usage-bar"><span style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} /></span>;
}

function DailyTable({ days, now, submitsByDay }) {
  const rows = days.filter(d => !d.missing);
  // Cloudinary có thể trả tổng 30 ngày tính tới ngày đó thay vì riêng ngày đó — nhận biết bằng tổng các ngày lớn bất thường.
  const rolling = rows.reduce((s, d) => s + (d.bandwidth ?? 0), 0) > 2 * (now.bandwidth ?? 0) && rows.length > 3;
  const maxBand = Math.max(0, ...rows.map(d => d.bandwidth ?? 0));
  const today = localDay(new Date());
  if (rows.length === 0) return null;
  return (
    <div className="admin-card admin-usage-card">
      <h2>{rolling ? "Tổng 30 ngày tính tới từng ngày" : "Theo ngày"}</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr><th>Ngày</th><th>Băng thông</th><th /><th>Biến đổi ảnh</th><th>Lượt tải</th><th>Lượt nộp bài</th></tr>
          </thead>
          <tbody>
            {[...rows].reverse().map(d => (
              <tr key={d.date}>
                <td>{d.date.slice(8, 10)}/{d.date.slice(5, 7)}{d.date === today ? " (hôm nay)" : ""}</td>
                <td>{formatBytes(d.bandwidth)}</td>
                <td className="admin-usage-bar-cell"><Bar value={d.bandwidth ?? 0} max={maxBand} /></td>
                <td>{num(d.transformations)}</td>
                <td>{num(d.requests)}</td>
                <td>{submitsByDay[d.date] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const LESSON_COLUMNS = [
  ["title", "Bài", l => `${l.group} ${l.title}`],
  ["skill", "Kỹ năng", l => l.skill],
  ["images", "Ảnh", l => l.imageBytes],
  ["audios", "Audio", l => l.audioBytes],
  ["bytes", "Mỗi lượt mở", l => l.bytes],
  ["students", "HS đã làm", l => l.students],
  ["usedBytes", "Ước tính đã tốn", l => l.usedBytes],
  ["openClasses", "Lớp đang mở", l => l.openClasses],
];
const PAGE_SIZE = 20;
const uniqueSorted = list => [...new Set(list)].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));

// Dung lượng từng bài: mỗi lượt mở tải bao nhiêu (số thật của Cloudinary) × số học sinh đã làm = ước tính đã tốn.
function LessonTable({ lessons, hasSizes }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [skill, setSkill] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState({ by: "usedBytes", desc: true });
  const [all, setAll] = useState(false);

  const groups = useMemo(() => uniqueSorted(lessons.map(l => l.group)), [lessons]);
  const skills = useMemo(() => uniqueSorted(lessons.map(l => l.skill)), [lessons]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const value = LESSON_COLUMNS.find(c => c[0] === sort.by)[2];
    const list = lessons.filter(l =>
      (!q || l.label.toLowerCase().includes(q)) && (!group || l.group === group) && (!skill || l.skill === skill) && (!onlyOpen || l.openClasses > 0)
    );
    return list.sort((a, b) => {
      const x = value(a), y = value(b);
      const d = typeof x === "string" ? x.localeCompare(y, "vi", { numeric: true }) : x - y;
      return (sort.desc ? -d : d) || b.bytes - a.bytes;
    });
  }, [lessons, search, group, skill, onlyOpen, sort]);

  const sum = key => rows.reduce((s, l) => s + l[key], 0);
  const max = Math.max(0, ...rows.map(l => l.usedBytes));
  const shown = all ? rows : rows.slice(0, PAGE_SIZE);
  const filtering = search || group || skill || onlyOpen;
  const size = n => (hasSizes ? formatBytes(n) : "—");

  function sortBy(key) {
    setSort(s => (s.by === key ? { by: key, desc: !s.desc } : { by: key, desc: key !== "title" && key !== "skill" }));
  }

  return (
    <div className="admin-card admin-usage-card">
      <div className="admin-filter-bar">
        <input className="admin-input" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm bài..." />
        <select className="admin-input" value={group} onChange={e => setGroup(e.target.value)}>
          <option value="">Mọi bộ đề</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="admin-input" value={skill} onChange={e => setSkill(e.target.value)}>
          <option value="">Mọi kỹ năng</option>
          {skills.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="admin-filter-checkbox">
          <input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} />
          Đang mở cho lớp
        </label>
        {filtering && (
          <button type="button" className="admin-link-btn" onClick={() => { setSearch(""); setGroup(""); setSkill(""); setOnlyOpen(false); }}>
            Bỏ lọc
          </button>
        )}
      </div>
      <p className="admin-usage-summary">
        <strong>{rows.length.toLocaleString("vi-VN")}</strong> bài · lưu trữ <strong>{size(sum("bytes"))}</strong> · ước tính đã tốn <strong>{size(sum("usedBytes"))}</strong>
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table admin-usage-table">
          <thead>
            <tr>
              {LESSON_COLUMNS.map(([key, label]) => (
                <th key={key} className={key === "title" || key === "skill" ? "" : "is-num"}>
                  <button type="button" className="admin-usage-sort" onClick={() => sortBy(key)}>
                    {label}{sort.by === key ? (sort.desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(l => (
              <tr key={l.path}>
                <td>
                  <div className="admin-usage-lesson-title">{l.title}</div>
                  <div className="admin-usage-sub">{l.group}</div>
                </td>
                <td>{l.skill}</td>
                <td className="is-num">{l.images ? `${l.images}${hasSizes ? ` · ${formatBytes(l.imageBytes)}` : ""}` : "—"}</td>
                <td className="is-num">{l.audios ? `${l.audios}${hasSizes ? ` · ${formatBytes(l.audioBytes)}` : ""}` : "—"}</td>
                <td className="is-num"><strong>{size(l.bytes)}</strong></td>
                <td className="is-num">{l.students || "—"}</td>
                <td className="is-num">
                  {l.students ? size(l.usedBytes) : "—"}
                  {hasSizes && <Bar value={l.usedBytes} max={max} />}
                </td>
                <td className="is-num">{l.openClasses || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={LESSON_COLUMNS.length} className="admin-muted-text">Không có bài nào khớp.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE_SIZE && (
        <button type="button" className="admin-btn-secondary" onClick={() => setAll(v => !v)}>
          {all ? "Thu gọn" : `Xem tất cả ${rows.length} bài`}
        </button>
      )}
    </div>
  );
}

const fileName = f => `${f.id.split("/").pop()}${f.format && f.type !== "raw" ? `.${f.format}` : ""}`;
const fileKind = f => (f.type === "image" ? "Ảnh" : f.type === "video" ? "Audio/Video" : "Khác");

function BiggestFiles({ files }) {
  return (
    <div className="admin-card admin-usage-card">
      <h2>File nặng nhất</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr><th>File</th><th>Loại</th><th>Dung lượng</th><th>Dùng ở</th></tr>
          </thead>
          <tbody>
            {files.map(f => (
              <tr key={`${f.type}/${f.id}`}>
                <td><a href={f.url} target="_blank" rel="noreferrer">{fileName(f)}</a></td>
                <td>{fileKind(f)}</td>
                <td>{formatBytes(f.bytes)}</td>
                <td>{f.usedBy.length ? f.usedBy.join("; ") : <em>Không bài nào dùng</em>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Orphans({ files, bytes, canDelete, onDeleted }) {
  const confirm = useConfirm();
  const [progress, setProgress] = useState(null); // "12/340" khi đang xoá
  const [message, setMessage] = useState(null);
  const deletable = useMemo(() => deletableOrphans(files), [files]);

  async function deleteAll() {
    const size = formatBytes(deletable.reduce((s, f) => s + f.bytes, 0));
    const ok = await confirm(
      `Xoá hẳn ${deletable.length.toLocaleString("vi-VN")} file (${size}) trên Cloudinary? Không khôi phục được.`,
      { danger: true }
    );
    if (!ok) return;
    setMessage(null);
    setProgress(`0/${deletable.length}`);
    try {
      const n = await deleteCloudinaryFiles(deletable, (done, total) => setProgress(`${done}/${total}`));
      setMessage(`Đã xoá ${n.toLocaleString("vi-VN")} file.`);
    } catch (err) {
      setMessage(`Xoá bị dừng giữa chừng: ${describe(err)}`);
    } finally {
      setProgress(null);
      onDeleted();
    }
  }

  function download() {
    const lines = ["url,loai,dung_luong_byte,ngay_tai_len", ...files.map(f => [f.url, f.type, f.bytes, f.createdAt ?? ""].join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "file-khong-dung.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="admin-card admin-usage-card">
      <h2>File không còn bài nào dùng</h2>
      <p>
        <strong>{files.length.toLocaleString("vi-VN")}</strong> file · <strong>{formatBytes(bytes)}</strong>
      </p>
      {message && <p className="admin-muted-text">{message}</p>}
      {files.length > 0 && (
        <>
          <div className="admin-filter-bar">
            <button type="button" className="admin-btn-secondary" onClick={download}>⬇ Tải danh sách (CSV)</button>
            {canDelete && deletable.length > 0 && (
              <button type="button" className="admin-btn-secondary admin-pill-btn-danger" onClick={deleteAll} disabled={progress != null}>
                {progress ? `Đang xoá ${progress}...` : `🗑 Xoá hết ${deletable.length.toLocaleString("vi-VN")} file`}
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th>File</th><th>Loại</th><th>Dung lượng</th><th>Tải lên</th></tr>
              </thead>
              <tbody>
                {files.slice(0, 20).map(f => (
                  <tr key={`${f.type}/${f.id}`}>
                    <td><a href={f.url} target="_blank" rel="noreferrer">{fileName(f)}</a></td>
                    <td>{fileKind(f)}</td>
                    <td>{formatBytes(f.bytes)}</td>
                    <td>{f.createdAt ? new Date(f.createdAt).toLocaleDateString("vi-VN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
