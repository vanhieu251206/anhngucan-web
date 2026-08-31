import { useEffect, useState } from "react";
import { YLE_SERIES } from "../../lib/yleData.js";
import { useAuth } from "../../lib/authContext.jsx";
import { listStudents } from "../../lib/adminUsers.js";
import { listTests, listReadingTests } from "../../lib/adminLessons.js";
import { listClassAssignments, setClassAssignment, clearClassAssignment } from "../../lib/classAssignments.js";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";

const MODE_LABEL = { listening: "Listening", speaking: "Speaking", reading: "Reading & Writing" };

// "Giao bài cho lớp" — mỗi lớp chỉ có ĐÚNG 1 bài đang mở tại 1 thời điểm (chốt 2026-08-27, xem
// lib/classAssignments.js). Học sinh dù đã có tài khoản vẫn KHÔNG vào được bài nào ngoài đúng bài
// đang mở cho lớp mình — xem LessonsPage.jsx.
export default function AssignmentsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [classes, setClasses] = useState(null);
  const [assignments, setAssignments] = useState({}); // className -> assignment
  const [loadError, setLoadError] = useState("");

  const [className, setClassName] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [level, setLevel] = useState("");
  const [mode, setMode] = useState("");
  const [testId, setTestId] = useState("");
  const [tests, setTests] = useState(null); // danh sách Test khi mode = speaking/reading
  const [expiresAt, setExpiresAt] = useState(""); // datetime-local string, rỗng = không hết hạn
  const [maxAttemptsOverride, setMaxAttemptsOverride] = useState(""); // rỗng = dùng theo Test
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  function reload() {
    setLoadError("");
    Promise.all([listStudents(), listClassAssignments()])
      .then(([students, list]) => {
        setClasses([...new Set(students.map(s => s.className).filter(Boolean))].sort());
        const map = {};
        list.forEach(a => { map[a.className] = a; });
        setAssignments(map);
      })
      .catch(err => setLoadError(err.message || String(err)));
  }
  useEffect(reload, []);

  const series = YLE_SERIES.find(s => s.id === seriesId) ?? null;
  const levelObj = series?.levels.find(l => String(l.number) === level) ?? null;

  // Tải danh sách Test khi đã chọn đủ bộ đề/cấp/loại bài (speaking/reading) — listening không có
  // Test riêng, chỉ có 1 bài Listening duy nhất cho cả cấp.
  useEffect(() => {
    setTestId("");
    if (!series || !levelObj || (mode !== "speaking" && mode !== "reading")) {
      setTests(null);
      return;
    }
    const loader = mode === "speaking" ? listTests : listReadingTests;
    loader(series.id, levelObj.number).then(setTests);
  }, [seriesId, level, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOpen(e) {
    e.preventDefault();
    setError("");
    if (!className || !series || !levelObj || !mode) {
      setError("Chọn đủ Lớp, Bộ đề, Cấp độ, Loại bài.");
      return;
    }
    if ((mode === "speaking" || mode === "reading") && !testId) {
      setError("Chọn Test cụ thể.");
      return;
    }
    const test = tests?.find(t => t.id === testId);
    setOpening(true);
    try {
      await setClassAssignment(
        className,
        {
          seriesId: series.id,
          level: levelObj.number,
          mode,
          testId: testId || null,
          testTitle: test?.title ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          maxAttempts: maxAttemptsOverride === "" ? null : Number(maxAttemptsOverride),
        },
        user.uid
      );
      setExpiresAt("");
      setMaxAttemptsOverride("");
      reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setOpening(false);
    }
  }

  async function handleClose(cls) {
    if (!(await confirm(`Đóng bài đang mở cho lớp "${cls}"? Học sinh lớp này sẽ không vào làm bài được nữa.`, { danger: true }))) return;
    await clearClassAssignment(cls);
    reload();
  }

  function isExpired(a) {
    return a.expiresAt && a.expiresAt.toDate() < new Date();
  }

  function describeAssignment(a) {
    const seriesTitle = YLE_SERIES.find(s => s.id === a.seriesId)?.title ?? a.seriesId;
    const parts = [`${seriesTitle} ${a.level}`, MODE_LABEL[a.mode] ?? a.mode];
    if (a.testTitle) parts.push(a.testTitle);
    let text = parts.join(" · ");
    if (a.maxAttempts) text += ` · tối đa ${a.maxAttempts} lượt`;
    if (a.expiresAt) text += ` · hạn tới ${a.expiresAt.toDate().toLocaleString("vi-VN")}`;
    return text;
  }

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2>Mở bài mới cho 1 lớp</h2>
        <p className="admin-muted-text">Mỗi lớp chỉ làm được ĐÚNG 1 bài đang mở tại 1 thời điểm — mở bài mới sẽ tự thay thế bài đang mở trước đó.</p>
        <form className="admin-form assignment-form" onSubmit={handleOpen}>
          <div className="assignment-form-grid">
            <label className="admin-mini-field">
              <span>Lớp</span>
              <select className="admin-input" value={className} onChange={e => setClassName(e.target.value)}>
                <option value="">— Chọn lớp —</option>
                {(classes ?? []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="admin-mini-field">
              <span>Bộ đề</span>
              <select className="admin-input" value={seriesId} onChange={e => { setSeriesId(e.target.value); setLevel(""); setMode(""); }}>
                <option value="">— Chọn bộ đề —</option>
                {YLE_SERIES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
            {series && (
              <label className="admin-mini-field">
                <span>Cấp độ</span>
                <select className="admin-input" value={level} onChange={e => { setLevel(e.target.value); setMode(""); }}>
                  <option value="">— Chọn cấp —</option>
                  {series.levels.map(l => <option key={l.number} value={l.number}>{`Cấp ${l.number}`}</option>)}
                </select>
              </label>
            )}
            {levelObj && (
              <label className="admin-mini-field">
                <span>Loại bài</span>
                <select className="admin-input" value={mode} onChange={e => setMode(e.target.value)}>
                  <option value="">— Chọn loại bài —</option>
                  <option value="listening">Listening</option>
                  <option value="speaking">Speaking</option>
                  <option value="reading">Reading & Writing</option>
                </select>
              </label>
            )}
            {(mode === "speaking" || mode === "reading") && (
              <label className="admin-mini-field">
                <span>Test</span>
                <select className="admin-input" value={testId} onChange={e => setTestId(e.target.value)} disabled={!tests}>
                  <option value="">{tests ? "— Chọn Test —" : "Đang tải..."}</option>
                  {tests?.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="assignment-form-grid assignment-form-grid-optional">
            <label className="admin-mini-field">
              <span>Thời hạn kết thúc</span>
              <input
                type="datetime-local"
                className="admin-input"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
              <small className="admin-field-hint">Để trống thì tự đóng bằng tay</small>
            </label>
            <label className="admin-mini-field">
              <span>Số lượt làm tối đa</span>
              <input
                type="number"
                min={1}
                className="admin-input"
                value={maxAttemptsOverride}
                onChange={e => setMaxAttemptsOverride(e.target.value)}
                placeholder="Theo Test"
              />
              <small className="admin-field-hint">Để trống thì dùng số lượt mặc định của Test</small>
            </label>
          </div>

          <button className="admin-btn-primary" type="submit" disabled={opening}>
            {opening ? "Đang mở..." : "Mở bài này cho lớp"}
          </button>
          {error && <p className="admin-error">{error}</p>}
        </form>
      </div>

      <div className="admin-card">
        <h2>Đang mở cho từng lớp</h2>
        {loadError && <p className="admin-error">Không tải được danh sách: {loadError}</p>}
        {classes === null && !loadError && <p className="admin-muted-text">Đang tải...</p>}
        {classes && classes.length === 0 && <p className="admin-muted-text">Chưa có lớp nào — tạo tài khoản học sinh trước ở mục "Tài khoản học sinh".</p>}
        {classes && classes.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Lớp</th>
                <th>Bài đang mở</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {classes.map(c => (
                <tr key={c}>
                  <td>{c}</td>
                  <td>
                    {assignments[c] ? (
                      <>
                        {describeAssignment(assignments[c])}
                        {isExpired(assignments[c]) && <span className="admin-error"> — Đã hết hạn</span>}
                      </>
                    ) : (
                      <span className="admin-muted-text">Chưa mở bài nào</span>
                    )}
                  </td>
                  <td>
                    {assignments[c] && (
                      <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => handleClose(c)}>
                        Đóng
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
