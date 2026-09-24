import { useEffect, useState } from "react";
import { useAuth } from "../../lib/authContext.jsx";
import { KIDS_GRADES, KIDS_BOOK_KINDS } from "../../lib/yleData.js";
import { getKidsBook, saveKidsBook } from "../../lib/adminLessons.js";
import KidsBookStudio from "../../components/dashboard/KidsBookStudio.jsx";

const ACCENT = "#F2A93B";

// CMS soạn Kids — chia theo Grade 1-5, mỗi Grade có ĐÚNG 2 quyển cố định: Student Book và Workbook
// (chốt 2026-09-23, thay cho danh sách sách tự do ban đầu) — Listening/Speaking Kids vẫn chưa có
// nội dung thật ở web công khai nên chưa soạn ở đây. Tách riêng khỏi CreateLessonPage.jsx vì Kids
// không theo Level/Test như YLE (giống KetPetContentPage.jsx).
export default function KidsContentPage() {
  const { user, isAdmin } = useAuth();
  // CMS dạng Sách (Student Book/Workbook) CHỈ admin thấy — giáo viên ẩn (chốt người dùng 2026-09-24).
  const bookKinds = isAdmin ? KIDS_BOOK_KINDS : [];
  const [grade, setGrade] = useState(null);
  const [kind, setKind] = useState(null); // "student" | "workbook"
  const [pages, setPages] = useState([]);
  const [sounds, setSounds] = useState([]); // Array<{x,y,url}>[] — cùng chỉ số với pages
  const [tabs, setTabs] = useState([]); // [{ label, page, color }] — tab đánh dấu unit ở mép sách
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (grade == null || kind == null) return;
    let cancelled = false;
    setLoading(true);
    setSaved(false);
    getKidsBook(grade, kind).then(book => {
      if (cancelled) return;
      setPages(book?.pages ?? []);
      setSounds(book?.sounds ?? []);
      setTabs(book?.tabs ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [grade, kind]);

  async function handleSave() {
    setSaving(true);
    await saveKidsBook(grade, kind, { pages, sounds, tabs }, user.uid);
    setSaving(false);
    setSaved(true);
  }

  if (grade == null) {
    return (
      <div className="admin-card">
        <h2>Kids — chọn khối lớp</h2>
        <div className="admin-picker-grid">
          {KIDS_GRADES.map(g => (
            <button key={g} className="admin-picker-tile" style={{ "--accent": ACCENT }} onClick={() => setGrade(g)}>
              <span className="admin-picker-tile-dot" />
              <span className="admin-picker-tile-title">{`Grade ${g}`}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (kind == null || !isAdmin) {
    return (
      <div className="admin-card">
        <button type="button" className="admin-pill-btn" onClick={() => setGrade(null)}>← Chọn khối khác</button>
        <h2>{`Grade ${grade} — chọn sách`}</h2>
        <div className="admin-picker-grid">
          {bookKinds.length === 0 && <p className="admin-muted-text">Chưa có nội dung.</p>}
          {bookKinds.map(k => (
            <button key={k.key} className="admin-picker-tile" style={{ "--accent": ACCENT }} onClick={() => setKind(k.key)}>
              <span className="admin-picker-tile-dot" />
              <span className="admin-picker-tile-title">{k.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="admin-card">Đang tải...</div>;

  const kindLabel = KIDS_BOOK_KINDS.find(k => k.key === kind)?.label;
  return (
    <KidsBookStudio
      title={`Grade ${grade} — ${kindLabel}`}
      pages={pages}
      sounds={sounds}
      tabs={tabs}
      onTabsChange={next => { setTabs(next); setSaved(false); }}
      onChange={(nextPages, nextSounds) => { setPages(nextPages); setSounds(nextSounds); }}
      onBack={() => setKind(null)}
      onSave={handleSave}
      saving={saving}
      saved={saved}
    />
  );
}
