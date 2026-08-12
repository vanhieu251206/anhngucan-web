// Đọc dữ liệu từ Google Sheets công khai qua API gviz (miễn phí, không cần backend).
// Mỗi tab trong Sheet trả về mảng object, key = tiêu đề cột ở hàng đầu tiên.

function gvizUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?headers=1&tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

async function fetchSheetTab(sheetName) {
  const res = await fetch(gvizUrl(sheetName));
  if (!res.ok) throw new Error(`Không đọc được tab "${sheetName}" (HTTP ${res.status})`);
  const text = await res.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const json = JSON.parse(text.substring(start, end + 1));
  const headers = json.table.cols.map(c => c.label || c.id);
  return json.table.rows
    .filter(row => row.c)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row.c[i] && row.c[i].v != null ? row.c[i].v : "";
      });
      return obj;
    });
}

// Nạp toàn bộ dữ liệu từ 4 tab: Lessons, Vocab, DragDrop, Speaking
async function loadAllLessons() {
  const [lessonsRows, vocabRows, dragdropRows, speakingRows] = await Promise.all([
    fetchSheetTab("Lessons"),
    fetchSheetTab("Vocab"),
    fetchSheetTab("DragDrop"),
    fetchSheetTab("Speaking")
  ]);

  return lessonsRows
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map(l => ({
      id: String(l.lesson_id),
      title: l.title,
      vocab: vocabRows
        .filter(v => String(v.lesson_id) === String(l.lesson_id))
        .map(v => ({ word: v.word, meaning: v.meaning, image: v.image })),
      dragdrop: dragdropRows
        .filter(d => String(d.lesson_id) === String(l.lesson_id))
        .map(d => ({ item: d.item, target: d.target, image: d.image })),
      speaking: speakingRows
        .filter(s => String(s.lesson_id) === String(l.lesson_id))
        .sort((a, b) => Number(a.order) - Number(b.order))
        .map(s => ({
          image: s.image,
          question: s.question,
          answer_keywords: s.answer_keywords
        }))
    }));
}
