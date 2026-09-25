import { useState } from "react";
import { useConfirm } from "./ConfirmDialog.jsx";
import { PageHead, PageHeadSaveButton } from "./AdminPageHead.jsx";
import { uploadToCloudinary } from "../../lib/cloudinaryUpload.js";
import { pdfToPageImages } from "../../lib/pdfToImages.js";
import KidsBookSoundEditor from "./KidsBookSoundEditor.jsx";
import KidsBookTabsEditor from "./KidsBookTabsEditor.jsx";
import { optimizeImage } from "../../lib/cloudinaryImage.js";

// Soạn 1 quyển sách cố định của Kids (Student Book/Workbook theo Grade — xem KidsContentPage.jsx)
// — danh sách ảnh từng trang (lật kiểu flipbook, xem BookReader.jsx) + các track audio đặt ngay
// trên ảnh trang (sounds[i]: [{x,y,url}], soạn qua "Xem trước & gắn audio" — KidsBookSoundEditor.jsx,
// lật từng trang thật để đặt Track 1, Track 2... rồi tải hàng loạt file khớp theo thứ tự, chốt
// người dùng 2026-09-23). Trang chủ yếu vào bằng "Tải sách (PDF)" (tự tách+upload hàng loạt) nên
// danh sách bên dưới chỉ hiện thumbnail xem lại + sắp xếp/xoá trang.
export default function KidsBookStudio({ title, pages, sounds, tabs, onTabsChange, onChange, onBack, onSave, saving, saved }) {
  const confirm = useConfirm();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfStage, setPdfStage] = useState(""); // "Đang tách trang..." / "Đang tải lên 3/20..."
  const [pdfError, setPdfError] = useState("");
  const [soundEditorOpen, setSoundEditorOpen] = useState(false);
  const [tabsEditorOpen, setTabsEditorOpen] = useState(false);

  async function removePage(i) {
    if (!(await confirm("Xoá trang này khỏi sách?", { danger: true }))) return;
    onChange(
      pages.filter((_, idx) => idx !== i),
      (sounds ?? []).filter((_, idx) => idx !== i),
    );
    // Tab gắn theo số trang — xoá 1 trang thì các tab phía sau lùi lại 1 trang cho khớp.
    if (tabs?.some(t => t.page > i)) {
      onTabsChange(tabs.map(t => (t.page > i ? { ...t, page: t.page - 1 } : t)));
    }
  }
  function movePage(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const nextPages = [...pages];
    [nextPages[i], nextPages[j]] = [nextPages[j], nextPages[i]];
    const nextSounds = [...(sounds ?? [])];
    [nextSounds[i], nextSounds[j]] = [nextSounds[j], nextSounds[i]];
    onChange(nextPages, nextSounds);
  }

  // Tải cả file PDF sách quét → tự tách từng trang thành ảnh ngay trên trình duyệt (pdf.js, không
  // qua server) → tự tải từng ảnh lên Cloudinary theo đúng thứ tự → thay hẳn danh sách trang hiện
  // có (chỉ cần bấm 1 nút, không soạn thủ công từng trang nữa). Các track audio đã đặt theo trang
  // cũ mất hết vì số trang/thứ tự đổi hoàn toàn.
  async function handlePdfPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (pages?.length && !(await confirm("Thay toàn bộ trang hiện có bằng nội dung PDF này?", { danger: true }))) return;
    setPdfError("");
    setPdfBusy(true);
    try {
      setPdfStage("Đang tách trang...");
      const images = await pdfToPageImages(file, {
        onProgress: (done, total) => setPdfStage(`Đang tách trang ${done}/${total}...`),
      });
      const urls = [];
      for (let i = 0; i < images.length; i++) {
        setPdfStage(`Đang tải lên ${i + 1}/${images.length}...`);
        urls.push(await uploadToCloudinary(images[i]));
      }
      onChange(urls, new Array(urls.length).fill(null).map(() => []));
    } catch (err) {
      setPdfError(err.message || "Xử lý PDF thất bại");
    } finally {
      setPdfBusy(false);
      setPdfStage("");
    }
  }

  if (tabsEditorOpen) {
    return (
      <KidsBookTabsEditor
        pages={pages}
        tabs={tabs ?? []}
        onChange={onTabsChange}
        onClose={() => setTabsEditorOpen(false)}
      />
    );
  }

  if (soundEditorOpen) {
    return (
      <KidsBookSoundEditor
        pages={pages}
        sounds={sounds}
        onChange={nextSounds => onChange(pages, nextSounds)}
        onClose={() => setSoundEditorOpen(false)}
      />
    );
  }

  return (
    <div className="admin-card" style={{ "--accent": "#F2A93B" }}>
      <PageHead backLabel="← Quay lại chọn sách" onBack={onBack}>
        <span className="admin-practice-page-label">{title}</span>
        <PageHeadSaveButton onSave={onSave} saving={saving} saved={saved} />
      </PageHead>

      <div className="kids-book-actions">
        <label className="admin-pill-btn" style={{ cursor: pdfBusy ? "wait" : "pointer", opacity: pdfBusy ? 0.6 : 1 }}>
          {pdfBusy ? pdfStage : "📕 Tải sách (PDF)"}
          <input type="file" accept="application/pdf" hidden disabled={pdfBusy} onChange={handlePdfPicked} />
        </label>
        {pages.length > 0 && (
          <button type="button" className="admin-pill-btn" onClick={() => setSoundEditorOpen(true)}>
            🎧 Xem trước & gắn audio
          </button>
        )}
        {pages.length > 0 && (
          <button type="button" className="admin-pill-btn" onClick={() => setTabsEditorOpen(true)}>
            🔖 Tab đánh dấu unit{tabs?.length ? ` (${tabs.length})` : ""}
          </button>
        )}
      </div>
      {pdfError && <p className="admin-upload-error">{pdfError}</p>}

      <div className="kids-page-grid">
        {(pages ?? []).map((p, i) => (
          <div className="kids-page-thumb" key={i}>
            <span className="admin-scene-list-index">{i + 1}</span>
            {p && <img src={optimizeImage(p)} alt={`Trang ${i + 1}`} />}
            <div className="admin-scene-list-actions">
              <button type="button" className="admin-link-btn" onClick={() => movePage(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="admin-link-btn" onClick={() => movePage(i, 1)} disabled={i === pages.length - 1}>↓</button>
              <button type="button" className="admin-link-btn admin-pill-btn-danger" onClick={() => removePage(i)}>Xoá</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
