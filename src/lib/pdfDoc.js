// Khởi tạo file PDF dùng chung (phiếu chấm bài lib/resultSheetPdf.js, phiếu học phí lib/tuitionPdf.js): jsPDF A4 dọc
// + font Be Vietnam Pro nhúng sẵn (public/assets/fonts, giấy phép OFL) để chữ tiếng Việt là vector, in sắc nét.
// Thư viện + font chỉ tải khi bấm nút xuất file.
export const FONT = "BeVietnamPro";

async function loadFontBase64(file) {
  const res = await fetch(`${import.meta.env.BASE_URL}assets/fonts/${file}`);
  if (!res.ok) throw new Error("Không tải được font cho phiếu PDF.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

let fontsPromise = null;
function loadFonts() {
  fontsPromise ??= Promise.all([loadFontBase64("BeVietnamPro-Regular.ttf"), loadFontBase64("BeVietnamPro-Bold.ttf")]).catch(err => {
    fontsPromise = null;
    throw err;
  });
  return fontsPromise;
}

export async function newDoc() {
  const [{ jsPDF }, { autoTable }, [regular, bold]] = await Promise.all([import("jspdf"), import("jspdf-autotable"), loadFonts()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.addFileToVFS("BeVietnamPro-Regular.ttf", regular);
  pdf.addFont("BeVietnamPro-Regular.ttf", FONT, "normal");
  pdf.addFileToVFS("BeVietnamPro-Bold.ttf", bold);
  pdf.addFont("BeVietnamPro-Bold.ttf", FONT, "bold");
  pdf.setFont(FONT, "normal");
  pdf.setTextColor(0);
  return { pdf, autoTable };
}

export const safeName = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9.]+/gi, "-").replace(/^-|-$/g, "");
