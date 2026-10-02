import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/authContext.jsx";
import { listClassDocs, formatSchedule } from "../../lib/classes.js";
import { listStudents } from "../../lib/adminUsers.js";
import { loadBill, saveBill, deleteBill, listBillsForMonth } from "../../lib/tuitionStore.js";
import { downloadTuitionBills } from "../../lib/tuitionPdf.js";
import { DEFAULT_ITEM_NAMES, blankItem, itemAmount, itemsFor, totalFor, hasBill, fmtMoney, parseMoney, currentMonth, today, prevMonth, monthLabel } from "../../lib/tuition.js";
import { useConfirm } from "../../components/dashboard/ConfirmDialog.jsx";

// Ô nhập số tiền: hiện có dấu chấm ngăn nghìn, lưu số (null = để trống).
function MoneyInput({ value, onChange, disabled, placeholder }) {
  return (
    <input
      className="admin-input tuition-num"
      inputMode="numeric"
      value={value == null ? "" : fmtMoney(value)}
      onChange={e => onChange(parseMoney(e.target.value))}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

// Chọn các em áp dụng 1 khoản. Chọn hết = cả lớp (uids = null) — em vào lớp sau cũng tự được tính.
function StudentPicker({ students, uids, onSave, onClose }) {
  const [picked, setPicked] = useState(() => new Set(uids ?? students.map(s => s.uid)));
  const all = picked.size === students.length;
  function toggle(uid) {
    const next = new Set(picked);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    setPicked(next);
  }
  return (
    <div className="confirm-overlay" role="presentation" onClick={onClose}>
      <div className="opening-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="opening-list-head">
          <h2>Áp dụng cho</h2>
          <button type="button" className="admin-link-btn" onClick={() => setPicked(all ? new Set() : new Set(students.map(s => s.uid)))}>
            {all ? "Bỏ chọn hết" : "Chọn cả lớp"}
          </button>
        </div>
        <div className="tuition-picker-list">
          {students.map(s => (
            <label key={s.uid} className="tuition-picker-row">
              <input type="checkbox" checked={picked.has(s.uid)} onChange={() => toggle(s.uid)} />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
        <div className="opening-form-actions" style={{ marginTop: 14 }}>
          <button type="button" className="admin-pill-btn" onClick={onClose}>Huỷ</button>
          <button type="button" className="admin-btn-primary" disabled={picked.size === 0} onClick={() => onSave(all ? null : [...picked])}>Xong</button>
        </div>
      </div>
    </div>
  );
}

const studentsOf = (allStudents, className) =>
  (allStudents ?? [])
    .filter(s => s.className === className)
    .map(s => ({ uid: s.uid, name: s.displayName || s.username || "" }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

// Học phí (2026-10-02, chỉ admin + giáo viên chính). Vào là thấy TỔNG QUAN các lớp của tháng đang chọn (lớp nào đã
// lập phiếu, bao nhiêu phiếu, tổng tiền), bấm 1 lớp mới vào nhập các khoản + xuất PDF (ClassBill bên dưới).
export default function TuitionPage() {
  const [month, setMonth] = useState(currentMonth());
  const [className, setClassName] = useState(null);
  const [classDocs, setClassDocs] = useState([]);
  const [allStudents, setAllStudents] = useState(null);
  const [bills, setBills] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listClassDocs().then(setClassDocs).catch(() => {});
    listStudents().then(setAllStudents).catch(e => setError(e.message));
  }, []);

  // Nạp lại mỗi khi đổi tháng hoặc quay về từ 1 lớp (có thể vừa lưu phiếu).
  useEffect(() => {
    if (className != null) return;
    let cancelled = false;
    setBills(null);
    setError("");
    listBillsForMonth(month)
      .then(map => { if (!cancelled) setBills(map); })
      .catch(e => { if (!cancelled) { setBills({}); setError(e.message); } });
    return () => { cancelled = true; };
  }, [month, className]);

  // Lớp đã tạo + lớp cũ chỉ tồn tại qua className của học sinh (như listClassNames()).
  const rows = useMemo(() => {
    const docs = Object.fromEntries(classDocs.map(c => [c.name, c]));
    const names = [...new Set([...classDocs.map(c => c.name), ...(allStudents ?? []).map(s => s.className).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
    return names.map(name => {
      const bill = bills?.[name];
      const billed = (bill?.students ?? []).filter(s => hasBill(bill.items, s.uid));
      return {
        name,
        schedule: formatSchedule(docs[name]),
        studentCount: studentsOf(allStudents, name).length,
        bill,
        billCount: billed.length,
        total: billed.reduce((sum, s) => sum + totalFor(bill.items, s.uid), 0),
      };
    });
  }, [classDocs, allStudents, bills]);

  if (className != null) {
    return <ClassBill className={className} month={month} onMonthChange={setMonth} allStudents={allStudents} onBack={() => setClassName(null)} />;
  }

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const ready = allStudents !== null && bills !== null;
  return (
    <>
    <div className="results-stats">
      <div className="results-stat"><span>{ready ? `${rows.filter(r => r.bill).length}/${rows.length}` : "—"}</span><small>Lớp đã lập phiếu</small></div>
      <div className="results-stat"><span>{ready ? rows.reduce((sum, r) => sum + r.billCount, 0) : "—"}</span><small>Phiếu học phí</small></div>
      <div className="results-stat"><span>{ready ? fmtMoney(grandTotal) : "—"}</span><small>Tổng tiền tháng {monthLabel(month)}</small></div>
    </div>
    <div className="admin-card">
      <div className="opening-list-head">
        <h2>Học phí các lớp</h2>
        <label className="admin-mini-field">
          <span>Tháng</span>
          <input className="admin-input" type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} />
        </label>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {allStudents === null && <p className="admin-muted-text">Đang tải...</p>}
      {allStudents && rows.length === 0 && <p className="admin-muted-text">Chưa có lớp nào.</p>}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table opening-table">
            <thead>
              <tr><th>Lớp</th><th>Lịch học</th><th>Học sinh</th><th>Phiếu tháng này</th><th className="tuition-right">Tổng tiền</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name} className="tuition-class-row" onClick={() => setClassName(r.name)}>
                  <td><span className="opening-chip opening-chip-class">{r.name}</span></td>
                  <td className="admin-muted-text">{r.schedule || "—"}</td>
                  <td>{r.studentCount}</td>
                  <td>
                    {bills === null ? "…" : r.bill
                      ? <span className="opening-chip opening-chip-on">{r.billCount} phiếu</span>
                      : <span className="opening-chip opening-chip-wait">Chưa lập</span>}
                  </td>
                  <td className="tuition-right"><strong>{r.bill ? fmtMoney(r.total) : "—"}</strong></td>
                  <td><div className="opening-actions"><button type="button" className="opening-btn">Mở</button></div></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={4}><strong>Tổng các lớp</strong></td><td className="tuition-right"><strong>{fmtMoney(grandTotal)}</strong></td><td></td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
    </>
  );
}

// 1 lớp + 1 tháng: nhập các khoản (cho cả lớp hoặc các em được chọn), xuất PDF mỗi em 1 phiếu (lib/tuitionPdf.js).
// Tháng chưa lập thì lấy sẵn các khoản của tháng trước.
function ClassBill({ className, month, onMonthChange, allStudents, onBack }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [savedStudents, setSavedStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(null); // "all" | uid
  const [deleting, setDeleting] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const bill = await loadBill(className, month);
        const template = bill ?? (await loadBill(className, prevMonth(month)));
        if (cancelled) return;
        setItems(template?.items?.length ? template.items.map(it => ({ ...blankItem(), ...it })) : DEFAULT_ITEM_NAMES.map(blankItem));
        setDueDate(bill?.dueDate ?? "");
        setIssueDate(bill?.issueDate || today());
        setSavedStudents(bill?.students ?? []);
        setDirty(false);
        setSavedAt(false);
      } catch (e) {
        // Đọc lỗi (vd chưa publish firestore.rules) vẫn cho nhập + xuất PDF với các khoản mặc định.
        if (!cancelled) {
          setItems(DEFAULT_ITEM_NAMES.map(blankItem));
          setError(e.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [className, month]);

  // Học sinh đang ở lớp + em có trong phiếu đã lưu nhưng nay đã chuyển lớp/bị xoá (giữ để phiếu tháng cũ vẫn đủ).
  const students = useMemo(() => {
    const current = studentsOf(allStudents, className);
    const have = new Set(current.map(s => s.uid));
    return [...current, ...savedStudents.filter(s => !have.has(s.uid))];
  }, [allStudents, className, savedStudents]);

  async function leaveOk() {
    return !dirty || (await confirm("Các khoản vừa nhập chưa lưu. Bỏ thay đổi?", { danger: true }));
  }
  async function goBack() {
    if (await leaveOk()) onBack();
  }
  async function changeMonth(value) {
    if (value && (await leaveOk())) onMonthChange(value);
  }

  function touch() {
    setDirty(true);
    setSavedAt(false);
  }
  function updateItem(i, patch) {
    setItems(list => list.map((it, k) => (k === i ? { ...it, ...patch } : it)));
    touch();
  }
  function removeItem(i) {
    setItems(list => list.filter((_, k) => k !== i));
    touch();
  }

  const bill = { className, month, items, dueDate, issueDate };

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await saveBill(className, month, { items, dueDate, issueDate, students }, user?.uid);
      setSavedStudents(students);
      setDirty(false);
      setSavedAt(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Xoá vĩnh viễn phiếu của lớp + tháng này (cả phần đang nhập dở) rồi quay về tổng quan.
  async function handleDelete() {
    const ok = await confirm(
      `Xoá toàn bộ dữ liệu học phí tháng ${monthLabel(month)} của lớp ${className}?\n\nXoá vĩnh viễn, không khôi phục được. File PDF đã tải về máy không bị ảnh hưởng.`,
      { danger: true }
    );
    if (!ok) return;
    setDeleting(true);
    setError("");
    try {
      await deleteBill(className, month);
      onBack();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  async function handlePdf(list, key) {
    setPdfBusy(key);
    setError("");
    try {
      await downloadTuitionBills(bill, list);
    } catch (e) {
      setError(e.message);
    } finally {
      setPdfBusy(null);
    }
  }

  const billCount = students.filter(s => hasBill(items, s.uid)).length;
  const classTotal = students.reduce((sum, s) => sum + totalFor(items, s.uid), 0);

  return (
    <div>
      {pickerIndex != null && (
        <StudentPicker
          students={students}
          uids={items[pickerIndex]?.uids}
          onClose={() => setPickerIndex(null)}
          onSave={uids => { updateItem(pickerIndex, { uids }); setPickerIndex(null); }}
        />
      )}

      <div className="admin-card">
        <div className="tuition-back">
          <button type="button" className="admin-pill-btn" onClick={goBack}>← Các lớp</button>
          <h2>Lớp {className}</h2>
        </div>
        <div className="tuition-head">
          <label className="admin-mini-field">
            <span>Tháng</span>
            <input className="admin-input" type="month" value={month} onChange={e => changeMonth(e.target.value)} />
          </label>
          <label className="admin-mini-field">
            <span>Hạn thanh toán</span>
            <input className="admin-input" type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); touch(); }} />
          </label>
          <label className="admin-mini-field">
            <span>Ngày lập phiếu</span>
            <input className="admin-input" type="date" value={issueDate} onChange={e => { setIssueDate(e.target.value); touch(); }} />
          </label>
          <div className="tuition-head-actions">
            {savedAt && <span className="admin-success">✓ Đã lưu</span>}
            <button type="button" className="admin-btn-primary" onClick={handleSave} disabled={saving || loading || !className}>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
        {error && <p className="admin-error">{error}</p>}
      </div>

      <div className="admin-card">
        <h2>Các khoản</h2>
        {loading ? <p className="admin-muted-text">Đang tải...</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table tuition-table">
                <thead>
                  <tr><th>Tên khoản</th><th>Số buổi</th><th>Đơn giá</th><th>Thành tiền</th><th>Áp dụng</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const byRate = it.sessions != null && it.unitPrice != null;
                    return (
                      <tr key={i}>
                        <td><input className="admin-input" value={it.name} onChange={e => updateItem(i, { name: e.target.value })} placeholder="VD: Anh văn" /></td>
                        <td><MoneyInput value={it.sessions} onChange={sessions => updateItem(i, { sessions })} /></td>
                        <td><MoneyInput value={it.unitPrice} onChange={unitPrice => updateItem(i, { unitPrice })} /></td>
                        <td><MoneyInput value={byRate ? itemAmount(it) : it.amount} onChange={amount => updateItem(i, { amount })} disabled={byRate} /></td>
                        <td>
                          <button type="button" className="opening-btn" onClick={() => setPickerIndex(i)} disabled={!students.length}>
                            {it.uids == null ? "Cả lớp" : `${it.uids.length} em`}
                          </button>
                        </td>
                        <td><button type="button" className="opening-btn opening-btn-danger" onClick={() => removeItem(i)} aria-label="Xoá khoản">🗑</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="admin-link-btn" onClick={() => { setItems(list => [...list, blankItem()]); touch(); }}>+ Thêm khoản</button>
          </>
        )}
      </div>

      <div className="admin-card">
        <div className="opening-list-head">
          <h2>Phiếu của lớp {className}</h2>
          <div className="opening-actions">
            <button type="button" className="admin-pill-btn admin-pill-btn-danger" onClick={handleDelete} disabled={deleting || loading}>
              {deleting ? "Đang xoá..." : "🗑 Xoá"}
            </button>
            <button type="button" className="admin-btn-primary" onClick={() => handlePdf(students, "all")} disabled={!!pdfBusy || !billCount}>
              {pdfBusy === "all" ? "Đang tạo PDF..." : `⬇ Xuất PDF (${billCount} phiếu)`}
            </button>
          </div>
        </div>
        {allStudents === null && <p className="admin-muted-text">Đang tải...</p>}
        {allStudents && students.length === 0 && <p className="admin-muted-text">Lớp chưa có học sinh.</p>}
        {students.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table opening-table">
              <thead>
                <tr><th>STT</th><th>Học sinh</th><th>Các khoản</th><th className="tuition-right">Tổng cộng</th><th></th></tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const own = itemsFor(items, s.uid).filter(it => itemAmount(it) != null);
                  return (
                    <tr key={s.uid}>
                      <td>{i + 1}</td>
                      <td>{s.name}</td>
                      <td className="admin-muted-text">{own.map(it => it.name || "(chưa đặt tên)").join(", ") || "—"}</td>
                      <td className="tuition-right"><strong>{own.length ? fmtMoney(totalFor(items, s.uid)) : "—"}</strong></td>
                      <td>
                        <div className="opening-actions">
                          <button type="button" className="opening-btn" onClick={() => handlePdf([s], s.uid)} disabled={!!pdfBusy || !own.length}>
                            {pdfBusy === s.uid ? "Đang tạo..." : "⬇ Phiếu"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}><strong>Tổng cả lớp</strong></td><td className="tuition-right"><strong>{fmtMoney(classTotal)}</strong></td><td></td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
