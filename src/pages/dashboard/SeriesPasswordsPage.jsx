import { useEffect, useState } from "react";
import PasswordInput from "../../components/PasswordInput.jsx";
import { YLE_SERIES } from "../../lib/yleData.js";
import { getSeriesPasswordHashes, setSeriesPassword } from "../../lib/seriesAccess.js";

// Đặt/đổi mật khẩu mở khoá theo TỪNG BỘ ĐỀ (Starters/Movers/Flyers/...) — thay cho tài khoản học
// sinh (chốt 2026-09-17, xem lib/seriesAccess.js). Mỗi bộ đề 1 mật khẩu riêng, học sinh chỉ cần
// biết đúng mật khẩu của bộ đề muốn học, không cần tài khoản.
export default function SeriesPasswordsPage() {
  const [hashes, setHashes] = useState(null); // { seriesId: hash } — chỉ dùng để biết đã đặt hay chưa
  const [inputs, setInputs] = useState({}); // { seriesId: mật khẩu mới đang gõ }
  const [saving, setSaving] = useState(null); // seriesId đang lưu
  const [savedFlash, setSavedFlash] = useState(null); // seriesId vừa lưu xong (hiện "✓ Đã lưu" thoáng qua)
  const [error, setError] = useState("");

  function reload() {
    getSeriesPasswordHashes()
      .then(setHashes)
      .catch(err => setError(err.message || String(err)));
  }
  useEffect(reload, []);

  async function handleSave(seriesId) {
    const value = (inputs[seriesId] || "").trim();
    if (!value) return;
    setError("");
    setSaving(seriesId);
    try {
      await setSeriesPassword(seriesId, value);
      setInputs(s => ({ ...s, [seriesId]: "" }));
      setSavedFlash(seriesId);
      setTimeout(() => setSavedFlash(f => (f === seriesId ? null : f)), 2000);
      reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(null);
    }
  }

  // KET/PET và IELTS dùng khung điều hướng riêng (không qua LessonsPage.jsx) nhưng vẫn qua đúng
  // màn App.jsx gate theo `series.id` — nên vẫn đặt mật khẩu được như các bộ YLE bình thường.
  const series = YLE_SERIES;

  return (
    <div className="admin-card">
      <h2>Mật khẩu bộ đề</h2>
      <p className="admin-muted-text">
        Mỗi bộ đề (Starters, Movers, Flyers...) có 1 mật khẩu riêng để học sinh mở khoá — không cần
        tài khoản. Đặt/đổi mật khẩu ở đây rồi báo cho học sinh/phụ huynh biết.
      </p>
      {error && <p className="admin-error">{error}</p>}
      {hashes === null && !error && <p className="admin-muted-text">Đang tải...</p>}
      {hashes && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Bộ đề</th>
              <th>Trạng thái</th>
              <th>Mật khẩu mới</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {series.map(s => (
              <tr key={s.id}>
                <td>
                  <span style={{ color: s.color, fontWeight: 700 }}>{s.title}</span>
                </td>
                <td>
                  {hashes[s.id] ? (
                    <span className="admin-success">Đã đặt mật khẩu</span>
                  ) : (
                    <span className="admin-muted-text">Chưa đặt</span>
                  )}
                </td>
                <td>
                  <PasswordInput
                    className="admin-input"
                    placeholder="Mật khẩu mới (ít nhất 4 ký tự)"
                    value={inputs[s.id] || ""}
                    onChange={e => setInputs(v => ({ ...v, [s.id]: e.target.value }))}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    disabled={saving === s.id || (inputs[s.id] || "").trim().length < 4}
                    onClick={() => handleSave(s.id)}
                  >
                    {saving === s.id ? "Đang lưu..." : savedFlash === s.id ? "✓ Đã lưu" : hashes[s.id] ? "Đổi mật khẩu" : "Đặt mật khẩu"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
