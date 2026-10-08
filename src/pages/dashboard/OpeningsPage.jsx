import { useEffect, useMemo, useState } from "react";
import { YLE_SERIES, KET_PET_GRADES, KET_PET_UNITS_PER_GRADE, KIDS_GRADES } from "../../lib/yleData.js";
import { loadLevelContent } from "../../lib/lessons.js";
import { listListeningExamTests } from "../../lib/adminLessons.js";
import { listClassNames, listClassDocs, bookAllowsLevel, bookAllowsSeries, bookKeys } from "../../lib/classes.js";
import { OPENING_KINDS, listOpenings, createOpening, updateOpening, closeOpening, isExpired, activeExtensions, latestDeadlineMs } from "../../lib/openings.js";
import ReopenDialog from "../../components/dashboard/ReopenDialog.jsx";
import { useAuth } from "../../lib/authContext.jsx";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";
import { listResultsForOpening } from "../../lib/testResults.js";
import { downloadClassResultSheets, canDownloadSheets } from "../../lib/resultSheetPdf.js";
import { assignmentLink } from "../../lib/assignmentUtils.js";

// Dạng bài mở được theo từng bộ đề.
function kindsFor(seriesId) {
  if (seriesId === "ket-pet") return ["ketpet-vocab", "ketpet-test"];
  if (seriesId === "ielts") return ["ielts-reading", "ielts-listening", "dictation"];
  const base = ["speaking", "reading", "dictation", "listening-exam"];
  return ["starters", "movers", "flyers"].includes(seriesId) ? [...base, "yle-vocab"] : base;
}

function toLocalInput(date) {
  if (!date) return "";
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

// Các cách sắp xếp danh sách bài đang mở — `value` trả số hoặc chuỗi; nhãn nút đảo chiều theo từng kiểu dữ liệu.
const SORT_STORAGE_KEY = "openings.sort";
const TIME_LABELS = { ascLabel: "↑ Cũ → mới", descLabel: "↓ Mới → cũ" };
const TEXT_LABELS = { ascLabel: "↑ A → Z", descLabel: "↓ Z → A" };
const NUM_LABELS = { ascLabel: "↑ Ít → nhiều", descLabel: "↓ Nhiều → ít" };
const SORT_FIELDS = {
  created: { label: "Lúc mở bài", value: o => o.createdAt?.toMillis?.() ?? Infinity, ...TIME_LABELS },
  deadline: { label: "Hạn chót", value: o => o.expiresAt?.toMillis?.() ?? Infinity, ascLabel: "↑ Gần → xa", descLabel: "↓ Xa → gần" },
  class: { label: "Lớp", value: o => o.className || "", ...TEXT_LABELS },
  title: { label: "Tên bài", value: o => o.testTitle || "", ...TEXT_LABELS },
  kind: { label: "Dạng bài", value: o => OPENING_KINDS[o.kind] ?? o.kind ?? "", ...TEXT_LABELS },
  attempts: { label: "Số lượt", value: o => o.maxAttempts ?? Infinity, ...NUM_LABELS },
  minutes: { label: "Số phút", value: o => o.timeLimitMinutes ?? Infinity, ...NUM_LABELS },
  status: { label: "Trạng thái", value: o => (isExpired(o) ? 1 : 0), ascLabel: "↑ Đang mở trước", descLabel: "↓ Hết hạn trước" },
};

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString("vi-VN") : "Không hạn";
}

// Trang giáo viên: MỞ BÀI cho lớp (mặc định mọi bài khoá). Mỗi lần mở có mật khẩu vào bài, hạn chót, số lượt,
// số phút — sửa lại bất cứ lúc nào (vd cấp thêm lượt lần 2, 3 = tăng "Số lượt"). Xem lib/openings.js.
export default function OpeningsPage() {
  const { user, isTeacher, profile } = useAuth();
  // Giáo viên bị giới hạn (restricted, vd dạy ngắn hạn) chỉ mở/xem bài cho đúng lớp trong
  // allowedClasses — chặn thật ở firestore.rules `canManageClass()`, đây chỉ là lọc UI (2026-09-22).
  const isRestricted = isTeacher && !!profile?.restricted;
  const allowedClassSet = isRestricted ? new Set(profile?.allowedClasses ?? []) : null;
  const confirm = useConfirm();
  const [classes, setClasses] = useState([]);
  const [classBooks, setClassBooks] = useState({}); // tên lớp -> sách được gán (lib/classes.js)
  const [openings, setOpenings] = useState(null);
  const [error, setError] = useState("");

  const [className, setClassName] = useState("");
  const [seriesId, setSeriesId] = useState("starters");
  const [levelNo, setLevelNo] = useState(1);
  const [kind, setKind] = useState("speaking");
  const [unit, setUnit] = useState(1);
  const [testChoice, setTestChoice] = useState("");
  const [choices, setChoices] = useState([]); // [{ id, title }]
  const [expiresAt, setExpiresAt] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("");
  const [minutes, setMinutes] = useState("");
  const [maxWrong, setMaxWrong] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // { id, ...fields }
  const [showForm, setShowForm] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [reopening, setReopening] = useState(null); // lần mở bài đang mở hộp "Mở lại" cho từng em

  const isKetPet = seriesId === "ket-pet";
  const series = YLE_SERIES.find(s => s.id === seriesId);
  // Chỉ cho mở bài thuộc SÁCH của lớp (2026-09-25) — mở bài ngoài sách thì học sinh thấy xám, không vào được.
  // Lớp chưa gán sách: vẫn chọn tự do nhưng hiện cảnh báo.
  const book = classBooks[className] ?? null;
  const seriesChoices = book ? YLE_SERIES.filter(s => bookAllowsSeries(book, s.id)) : YLE_SERIES;
  // Kids chia Grade 1-5 (KIDS_GRADES), khác 4 cấp mặc định của buildSeries.
  const baseLevels = isKetPet ? KET_PET_GRADES : seriesId === "kids" ? KIDS_GRADES : (series?.levels ?? []).map(l => l.number);
  const levelOptions = book && bookAllowsSeries(book, seriesId) ? baseLevels.filter(n => bookAllowsLevel(book, seriesId, n)) : baseLevels;
  const levelKey = levelOptions.join(",");
  const kinds = kindsFor(seriesId);

  function reload() {
    listOpenings()
      .then(list => setOpenings(allowedClassSet ? list.filter(o => allowedClassSet.has(o.className)) : list))
      .catch(e => setError(e.message));
  }
  useEffect(() => {
    reload();
    listClassDocs()
      .then(docs => setClassBooks(Object.fromEntries(docs.map(c => [c.name, c.book ?? null]))))
      .catch(() => {});
    listClassNames().then(list => {
      let cls = list;
      if (allowedClassSet) cls = cls.filter(c => allowedClassSet.has(c));
      setClasses(cls);
      setClassName(c => c || cls[0] || "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đổi lớp → nếu bộ đề đang chọn không thuộc sách lớp đó thì nhảy về bộ đề đầu tiên của sách.
  const bookSig = bookKeys(book).join(",");
  useEffect(() => {
    if (book && !bookAllowsSeries(book, seriesId) && seriesChoices[0]) setSeriesId(seriesChoices[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, bookSig]);

  // Đổi bộ đề → đưa dạng bài về giá trị hợp lệ.
  useEffect(() => {
    setKind(kindsFor(seriesId)[0]);
  }, [seriesId]);

  // Cấp đang chọn không còn hợp lệ (đổi bộ đề / đổi lớp có sách khác) → về cấp đầu tiên được phép.
  useEffect(() => {
    if (!levelOptions.includes(levelNo)) setLevelNo(levelOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, levelKey]);

  // Nạp danh sách bài chọn được theo bộ đề/cấp/dạng.
  useEffect(() => {
    let cancelled = false;
    setTestChoice("");
    if (isKetPet) {
      const list =
        kind === "ketpet-vocab"
          ? [{ id: `unit${unit}`, title: `Grade ${levelNo} – Unit ${unit} – Vocabulary` }]
          : [1, 2, 3, 4].map(n => ({ id: `unit${unit}-test${n}`, title: `Grade ${levelNo} – Unit ${unit} – Practice Test ${n}` }));
      setChoices(list);
      setTestChoice(list[0].id);
      return;
    }
    (async () => {
      let list = [];
      try {
        if (kind === "listening-exam") {
          list = (await listListeningExamTests(seriesId, levelNo)).map(t => ({ id: t.id, title: t.title ?? t.id }));
        } else {
          const levelObj = series.levels.find(l => l.number === levelNo);
          // Kids Grade 5 chưa có cấp tương ứng trong dữ liệu bài học → chưa có bài để mở.
          const content = levelObj ? await loadLevelContent(series, levelObj) : {};
          const src = { speaking: content.tests, reading: content.readingTests, dictation: content.dictationTests, "yle-vocab": content.vocabTests, "ielts-reading": content.practiceTests, "ielts-listening": content.ieltsListeningTests }[kind] ?? [];
          list = src.map(t => ({ id: t.id, title: t.title ?? t.id }));
        }
      } catch (e) {
        setError(e.message);
      }
      if (!cancelled) {
        setChoices(list);
        setTestChoice(list[0]?.id ?? "");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, levelNo, kind, unit]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    const test = choices.find(c => c.id === testChoice);
    if (!className || !test) return setError("Chọn lớp và bài cần mở.");
    // Bắt buộc có hạn chót: kết quả bài làm chỉ giữ tới 48h sau hạn chót rồi bị xoá (lib/testResults.js).
    if (!expiresAt) return setError("Chọn hạn chót cho bài.");
    setSaving(true);
    try {
      await createOpening(
        {
          className, seriesId, level: levelNo, kind, testId: test.id, testTitle: test.title,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          maxAttempts: maxAttempts ? Number(maxAttempts) : null,
          timeLimitMinutes: minutes ? Number(minutes) : null,
          maxWrong: maxWrong === "" ? null : Number(maxWrong),
        },
        user.uid
      );
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    setError("");
    if (!editing.expiresAt) return setError("Chọn hạn chót cho bài.");
    setSaving(true);
    try {
      await updateOpening(editing.id, {
        expiresAt: editing.expiresAt ? new Date(editing.expiresAt) : null,
        maxAttempts: editing.maxAttempts ? Number(editing.maxAttempts) : null,
        timeLimitMinutes: editing.minutes ? Number(editing.minutes) : null,
        maxWrong: editing.maxWrong === "" || editing.maxWrong == null ? null : Number(editing.maxWrong),
      });
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  // Phiếu chấm bài cả lớp (1 PDF: bảng điểm + mỗi lượt nộp 1 phiếu) — chỉ sau hạn chót, trong 48h trước khi kết quả bị xoá.
  async function handleSheets(o) {
    setError("");
    setDownloadingId(o.id);
    try {
      const results = await listResultsForOpening(o.id);
      await downloadClassResultSheets({ results, className: o.className, title: o.testTitle, deadline: o.expiresAt?.toDate?.() });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setDownloadingId(null);
    }
  }

  // Copy link vào thẳng bài để gửi cho học sinh (Zalo...). Clipboard API bị trình duyệt từ chối (quyền clipboard của
  // trang bị chặn...) thì copy kiểu cũ qua ô textarea ẩn; vẫn không được mới hiện link để copy tay.
  async function handleCopyLink(o) {
    const link = assignmentLink(o);
    setError("");
    let ok = false;
    try {
      await navigator.clipboard.writeText(link);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch {}
      ta.remove();
    }
    if (!ok) return setError(`Không copy được — link bài: ${link}`);
    setCopiedId(o.id);
    setTimeout(() => setCopiedId(id => (id === o.id ? null : id)), 2000);
  }

  async function handleClose(o) {
    if (!(await confirm(`Đóng "${o.testTitle}" của lớp ${o.className}? Học sinh sẽ không vào được nữa.`, { danger: true }))) return;
    await closeOpening(o.id);
    reload();
  }

  // Lọc + sắp xếp: mặc định cũ nhất → mới nhất theo lúc mở bài (bài vừa mở chưa có giờ máy chủ thì nằm cuối).
  // Bấm tiêu đề cột để sắp theo cột đó, bấm lần nữa để đảo chiều; lựa chọn sắp xếp được nhớ trên máy này.
  const [classFilter, setClassFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSortState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY));
      if (SORT_FIELDS[saved?.by]) return { by: saved.by, desc: !!saved.desc };
    } catch { /* bỏ qua */ }
    return { by: "created", desc: false };
  });
  function setSort(next) {
    setSortState(next);
    try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(next)); } catch { /* bỏ qua */ }
  }
  const sortBy = by => setSort({ by, desc: sort.by === by ? !sort.desc : false });
  const filtering = !!(classFilter || kindFilter || statusFilter || search);

  const listClasses = useMemo(() => [...new Set((openings ?? []).map(o => o.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })), [openings]);
  const listKinds = useMemo(() => [...new Set((openings ?? []).map(o => o.kind).filter(Boolean))], [openings]);
  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const value = SORT_FIELDS[sort.by].value;
    const cmp = (x, y) => (typeof x === "string" ? x.localeCompare(y, "vi", { numeric: true }) : x === y ? 0 : x < y ? -1 : 1);
    const created = SORT_FIELDS.created.value;
    return (openings ?? [])
      .filter(o => !classFilter || o.className === classFilter)
      .filter(o => !kindFilter || o.kind === kindFilter)
      .filter(o => !statusFilter || (statusFilter === "expired") === isExpired(o))
      .filter(o => !q || (o.testTitle ?? "").toLowerCase().includes(q))
      .sort((a, b) => (sort.desc ? -1 : 1) * cmp(value(a), value(b)) || cmp(created(a), created(b)));
  }, [openings, classFilter, kindFilter, statusFilter, search, sort]);

  return (
    <div>
      {showForm && (
        <div className="confirm-overlay" role="presentation" onClick={() => setShowForm(false)}>
          <div className="opening-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2>Mở bài cho lớp</h2>
            <p className="admin-muted-text">Mặc định mọi bài đều khoá. Mở bài nào thì học sinh của lớp đó mới vào làm được.</p>
            {classes.length === 0 && <p className="admin-hint">Chưa có lớp nào — tạo lớp ở mục "Quản lý học sinh" trước.</p>}
            {className && !book && <p className="admin-hint">Lớp {className} chưa gán sách — học sinh chưa vào được bài nào.</p>}
        <form className="admin-form opening-form-grid" onSubmit={handleCreate}>
          <label className="admin-mini-field">
            <span>Lớp</span>
            <select className="admin-input" value={className} onChange={e => setClassName(e.target.value)}>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="admin-mini-field">
            <span>Bộ đề</span>
            <select className="admin-input" value={seriesId} onChange={e => setSeriesId(e.target.value)}>
              {seriesChoices.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <label className="admin-mini-field">
            <span>{isKetPet ? "Grade" : "Cấp"}</span>
            <select className="admin-input" value={levelNo} onChange={e => setLevelNo(Number(e.target.value))}>
              {levelOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="admin-mini-field">
            <span>Dạng bài</span>
            <select className="admin-input" value={kind} onChange={e => setKind(e.target.value)}>
              {kinds.map(k => <option key={k} value={k}>{OPENING_KINDS[k]}</option>)}
            </select>
          </label>
          {isKetPet && (
            <label className="admin-mini-field opening-span-2">
              <span>Unit</span>
              <select className="admin-input" value={unit} onChange={e => setUnit(Number(e.target.value))}>
                {Array.from({ length: KET_PET_UNITS_PER_GRADE }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <label className="admin-mini-field opening-span-2">
            <span>Bài</span>
            <select className="admin-input" value={testChoice} onChange={e => setTestChoice(e.target.value)}>
              {choices.length === 0 && <option value="">(chưa có bài)</option>}
              {choices.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="admin-mini-field opening-span-2">
            <span>Hạn chót</span>
            <input className="admin-input" type="datetime-local" required value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </label>
          <div className="opening-row-3">
            <label className="admin-mini-field">
              <span>Số lượt</span>
              <input className="admin-input" type="number" min="1" placeholder="Không giới hạn" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} />
            </label>
            <label className="admin-mini-field">
              <span>Số phút</span>
              <input className="admin-input" type="number" min="1" placeholder="Theo bài" value={minutes} onChange={e => setMinutes(e.target.value)} />
            </label>
            <label className="admin-mini-field">
              <span>Sai tối đa (câu)</span>
              <input className="admin-input" type="number" min="0" placeholder="Không yêu cầu" value={maxWrong} onChange={e => setMaxWrong(e.target.value)} />
            </label>
          </div>
          <div className="opening-form-actions">
            {error && <p className="admin-error">{error}</p>}
            <button type="button" className="admin-pill-btn" onClick={() => setShowForm(false)}>Huỷ</button>
            <button className="admin-btn-primary" type="submit" disabled={saving || !testChoice}>{saving ? "Đang mở..." : "Mở bài"}</button>
          </div>
        </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="confirm-overlay" role="presentation" onClick={() => setEditing(null)}>
          <div className="opening-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h2>Sửa bài đang mở</h2>
            <p className="admin-muted-text">Lớp {editing.className} · {editing.testTitle} · {OPENING_KINDS[editing.kind] ?? editing.kind}</p>
            <form className="admin-form opening-form-grid" onSubmit={e => { e.preventDefault(); handleSaveEdit(); }}>
              <label className="admin-mini-field opening-span-2">
                <span>Hạn chót</span>
                <input className="admin-input" type="datetime-local" required value={editing.expiresAt} onChange={e => setEditing({ ...editing, expiresAt: e.target.value })} />
              </label>
              <div className="opening-row-3">
                <label className="admin-mini-field">
                  <span>Số lượt</span>
                  <input className="admin-input" type="number" min="1" placeholder="Không giới hạn" value={editing.maxAttempts} onChange={e => setEditing({ ...editing, maxAttempts: e.target.value })} />
                </label>
                <label className="admin-mini-field">
                  <span>Số phút</span>
                  <input className="admin-input" type="number" min="1" placeholder="Theo bài" value={editing.minutes} onChange={e => setEditing({ ...editing, minutes: e.target.value })} />
                </label>
                <label className="admin-mini-field">
                  <span>Sai tối đa (câu)</span>
                  <input className="admin-input" type="number" min="0" placeholder="Không yêu cầu" value={editing.maxWrong} onChange={e => setEditing({ ...editing, maxWrong: e.target.value })} />
                </label>
              </div>
              <div className="opening-form-actions">
                {error && <p className="admin-error">{error}</p>}
                <button type="button" className="admin-pill-btn" onClick={() => setEditing(null)}>Huỷ</button>
                <button className="admin-btn-primary" type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reopening && <ReopenDialog opening={reopening} onClose={() => setReopening(null)} onSaved={reload} />}

      <div className="admin-card">
        <div className="opening-list-head">
          <h2>Các bài đang mở</h2>
          <button className="admin-btn-primary" type="button" onClick={() => { setError(""); setShowForm(true); }}>+ Mở bài</button>
        </div>
        {error && !showForm && !editing && <p className="admin-error">{error}</p>}
        {openings === null && <p className="admin-muted-text">Đang tải...</p>}
        {openings && openings.length === 0 && <p className="admin-muted-text">Chưa mở bài nào.</p>}
        {openings && openings.length > 0 && (
          <div className="admin-filter-bar">
            <label>
              Lớp
              <select className="admin-input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                <option value="">Tất cả lớp</option>
                {listClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Dạng bài
              <select className="admin-input" value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
                <option value="">Tất cả</option>
                {listKinds.map(k => <option key={k} value={k}>{OPENING_KINDS[k] ?? k}</option>)}
              </select>
            </label>
            <label>
              Trạng thái
              <select className="admin-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="open">Đang mở</option>
                <option value="expired">Hết hạn</option>
              </select>
            </label>
            <label>
              Bài
              <input className="admin-input" type="text" placeholder="Tìm theo tên bài" value={search} onChange={e => setSearch(e.target.value)} />
            </label>
            <label>
              Sắp xếp theo
              <select className="admin-input" value={sort.by} onChange={e => setSort({ by: e.target.value, desc: false })}>
                {Object.entries(SORT_FIELDS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
              </select>
            </label>
            <button className="opening-btn" type="button" onClick={() => setSort({ ...sort, desc: !sort.desc })}>
              {sort.desc ? SORT_FIELDS[sort.by].descLabel : SORT_FIELDS[sort.by].ascLabel}
            </button>
            {filtering && (
              <button className="opening-btn" type="button" onClick={() => { setClassFilter(""); setKindFilter(""); setStatusFilter(""); setSearch(""); }}>
                Xoá lọc
              </button>
            )}
            <span className="opening-count">{sorted.length}/{openings.length} bài</span>
          </div>
        )}
        {openings && openings.length > 0 && sorted.length === 0 && <p className="admin-muted-text">Không có bài nào khớp bộ lọc.</p>}
        {openings && sorted.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table opening-table">
              <thead>
                <tr>
                  {[["class", "Lớp"], ["title", "Bài"], ["deadline", "Hạn chót"], ["attempts", "Lượt"], ["minutes", "Phút"], ["status", "Trạng thái"]].map(([by, label]) => (
                    <th key={by} aria-sort={sort.by === by ? (sort.desc ? "descending" : "ascending") : "none"}>
                      <button type="button" className={`opening-sort-th${sort.by === by ? " is-active" : ""}`} onClick={() => sortBy(by)}>
                        {label}<span>{sort.by === by ? (sort.desc ? "▼" : "▲") : "↕"}</span>
                      </button>
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(o => (
                  <tr key={o.id}>
                    <td><span className="opening-chip opening-chip-class">{o.className}</span></td>
                    <td>
                      <div className="opening-test-title">{o.testTitle}</div>
                      <div className="opening-test-kind">{OPENING_KINDS[o.kind] ?? o.kind}</div>
                    </td>
                    <td>{o.expiresAt?.toDate ? o.expiresAt.toDate().toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Không hạn"}</td>
                    <td>{o.maxAttempts ?? "∞"}</td>
                    <td>{o.timeLimitMinutes ?? "—"}</td>
                    <td>
                      {isExpired(o) ? <span className="opening-chip opening-chip-off">Hết hạn</span> : <span className="opening-chip opening-chip-on">Đang mở</span>}
                      {activeExtensions(o).length > 0 && <div><span className="opening-chip opening-chip-wait">Mở lại · {activeExtensions(o).length} em</span></div>}
                    </td>
                    <td>
                      <div className="opening-actions">
                        {isExpired(o) && <button className="opening-btn" onClick={() => { setError(""); setReopening(o); }}>↻ Mở lại</button>}
                        {/* Có em được mở lại thì kết quả của em đó giữ tới 48h sau hạn riêng → phiếu chấm tải được tới lúc đó. */}
                        {isExpired(o) && canDownloadSheets(latestDeadlineMs(o), Math.max(Date.now(), latestDeadlineMs(o) ?? 0)) && (
                          <button className="opening-btn" disabled={!!downloadingId} onClick={() => handleSheets(o)}>
                            {downloadingId === o.id ? "Đang tạo PDF..." : "⬇ Phiếu chấm"}
                          </button>
                        )}
                        {!isExpired(o) && (
                          <button className="opening-btn" onClick={() => handleCopyLink(o)}>
                            {copiedId === o.id ? "✓ Đã copy" : "🔗 Copy link"}
                          </button>
                        )}
                        <button className="opening-btn" onClick={() => setEditing({ id: o.id, className: o.className, testTitle: o.testTitle, kind: o.kind, expiresAt: toLocalInput(o.expiresAt?.toDate?.()), maxAttempts: o.maxAttempts ?? "", minutes: o.timeLimitMinutes ?? "", maxWrong: o.maxWrong ?? "" })}>✏️ Sửa</button>
                        <button className="opening-btn opening-btn-danger" onClick={() => handleClose(o)}>🗑 Đóng bài</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
