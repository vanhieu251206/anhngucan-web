import { useEffect, useMemo, useState } from "react";
import {
  buildReport, formatBytes, loadActivity, loadCloudinaryResources, loadCloudinaryUsage, localDay, scanLessonAssets,
} from "../../lib/usageReport.js";

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
    loadActivity().catch(() => ({ submitsByDay: {}, activeOpenings: [] })),
  ]);
  return { usage, resources, scan, activity, at: new Date() };
}

// Dung lượng & băng thông (chỉ admin, 2026-10-10): số thật của Cloudinary theo ngày + bài nào/file nào nặng nhất + file
// không còn bài nào dùng. Chỉ xem, không xoá gì.
export default function UsageAnalyticsPage() {
  const [data, setData] = useState(cached);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
    () => data && buildReport(data.scan, data.resources.files ?? [], data.activity.activeOpenings),
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
        <span className="admin-muted-text">Cập nhật lúc {data.at.toLocaleTimeString("vi-VN")}</span>
        <button type="button" className="admin-btn-secondary" onClick={reload} disabled={loading}>
          {loading ? "Đang tải..." : "↻ Tải lại"}
        </button>
      </div>
      {cloudError && <p className="admin-error">{cloudError}</p>}
      {data.resources.truncated && <p className="admin-error">Cloudinary có nhiều file hơn mức quét được, danh sách file chưa đủ.</p>}

      {!data.usage.error && <UsageCards now={data.usage.now} report={report} hasSizes={hasSizes} />}
      {!data.usage.error && <DailyTable days={data.usage.days} now={data.usage.now} submitsByDay={data.activity.submitsByDay} />}
      <LessonTable lessons={report.lessons} hasSizes={hasSizes} />
      {hasSizes && <BiggestFiles files={report.biggest} />}
      {hasSizes && <Orphans files={report.orphans} bytes={report.orphanBytes} />}
    </div>
  );
}

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

function LessonTable({ lessons, hasSizes }) {
  const [all, setAll] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const filtered = onlyOpen ? lessons.filter(l => l.openClasses > 0) : lessons;
  const shown = all ? filtered : filtered.slice(0, 20);
  const max = Math.max(0, ...lessons.map(l => l.bytes));
  return (
    <div className="admin-card admin-usage-card">
      <h2>Bài nặng nhất</h2>
      <div className="admin-filter-bar">
        <label className="admin-filter-checkbox">
          <input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} />
          Chỉ bài đang mở cho lớp
        </label>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr><th>Bài</th><th>Ảnh</th><th>Audio</th><th>Tổng</th><th /><th>Lớp đang mở</th></tr>
          </thead>
          <tbody>
            {shown.map(l => (
              <tr key={l.path}>
                <td>{l.label}</td>
                <td>{l.images}{hasSizes && l.images > 0 ? ` · ${formatBytes(l.imageBytes)}` : ""}</td>
                <td>{l.audios}{hasSizes && l.audios > 0 ? ` · ${formatBytes(l.audioBytes)}` : ""}</td>
                <td>{hasSizes ? formatBytes(l.bytes) : "—"}</td>
                <td className="admin-usage-bar-cell">{hasSizes && <Bar value={l.bytes} max={max} />}</td>
                <td>{l.openClasses || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 20 && (
        <button type="button" className="admin-btn-secondary" onClick={() => setAll(v => !v)}>
          {all ? "Thu gọn" : `Xem tất cả ${filtered.length} bài`}
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

function Orphans({ files, bytes }) {
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
      {files.length > 0 && (
        <>
          <button type="button" className="admin-btn-secondary" onClick={download}>⬇ Tải danh sách (CSV)</button>
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
