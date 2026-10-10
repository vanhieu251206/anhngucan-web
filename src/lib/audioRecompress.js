// Nén lại audio ĐÃ tải lên Cloudinary (2026-10-10, chỉ admin — Tổng quan → "Nén lại audio cũ"): audio gốc 128-160 kbps
// stereo ngốn băng thông Cloudinary gấp 2-3 lần mức cần cho giọng nói. Làm 3 bước, 1 thư mục trên máy:
//   1) exportAudio(): quét mọi link audio Cloudinary trong bài, tải về thư mục đánh số 0001.mp3, 0002.mp3... + manifest.json
//   2) nén ngoài web (ffmpeg) vào thư mục con "nen/" GIỮ NGUYÊN SỐ (0001.mp3...) — file nào không cần nén thì bỏ trống
//   3) importAudio(): tải từng file trong "nen/" lên Cloudinary rồi thay link cũ → mới trong bài, ghi ket-qua.json
// Chạy lại được nhiều lần: file đã tải về thì bỏ qua, link đã thay thì không còn trong bài nên tự bỏ qua. File cũ trên
// Cloudinary KHÔNG bị xoá (preset unsigned không xoá được) — danh sách link cũ nằm trong ket-qua.json để xoá tay.
// Dùng File System Access API (showDirectoryPicker) — chỉ Chrome/Edge trên máy tính.
import { collection, getDocs, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { YLE_SERIES, KET_PET_GRADES, KIDS_GRADES } from "./yleData.js";
import { uploadToCloudinary } from "./cloudinaryUpload.js";

const SUBCOLLECTIONS = [
  "tests", "readingTests", "dictationTests", "vocabTests", "comprehensionTests",
  "practiceTests", "listeningExamTests", "listeningTests", "vocabularyUnits",
];
// Chỉ đuôi audio — không đụng video thật (mp4/webm) nếu có.
const AUDIO_URL = /https:\/\/res\.cloudinary\.com\/[^\s"'<>\\]+?\.(?:mp3|wav|m4a|ogg|aac|flac|opus)/gi;
const MANIFEST = "manifest.json";
const RESULT = "ket-qua.json";
const COMPRESSED_DIR = "nen";

export const canRecompressAudio = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

// Áp fn lên mọi chuỗi trong dữ liệu doc (kể cả link nằm lẫn trong chuỗi dài). Chỉ đi vào mảng + object thường — giữ
// nguyên Timestamp và các kiểu riêng của Firestore.
function mapStrings(value, fn) {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map(v => mapStrings(v, fn));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = mapStrings(value[k], fn);
    return out;
  }
  return value;
}

function audioUrlsIn(data) {
  const found = [];
  mapStrings(data, s => {
    for (const m of s.matchAll(AUDIO_URL)) found.push(m[0]);
    return s;
  });
  return found;
}

// Mọi doc có thể chứa audio: doc lesson cha + các subcollection (duyệt cả id cố định vì doc cha có thể không tồn tại —
// xem answerMigration.js), sách Kids, sách IELTS.
async function collectDocs() {
  const docs = [];
  const add = snap => snap.docs.forEach(d => docs.push({ ref: d.ref, data: d.data() }));
  const lessonIds = new Set();
  YLE_SERIES.forEach(s => (s.levels ?? []).forEach(l => lessonIds.add(`${s.id}-${l.number}`)));
  KET_PET_GRADES.forEach(g => lessonIds.add(`ket-pet-${g}`));
  KIDS_GRADES.forEach(g => lessonIds.add(`kids-${g}`));
  const parents = await getDocs(collection(db, "lessons"));
  add(parents);
  parents.docs.forEach(d => lessonIds.add(d.id));
  for (const lessonId of lessonIds) {
    const snaps = await Promise.all(SUBCOLLECTIONS.map(col => getDocs(collection(db, "lessons", lessonId, col))));
    snaps.forEach(add);
  }
  add(await getDocs(collection(db, "kidsBooks")));
  add(await getDocs(collection(db, "ieltsBooks")));
  return docs;
}

async function readJson(dir, name) {
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

async function writeFile(dir, name, data) {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(data);
  await writable.close();
}

async function fileSize(dir, name) {
  try {
    return (await (await dir.getFileHandle(name)).getFile()).size;
  } catch {
    return 0;
  }
}

async function retry(fn, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= tries) throw err;
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }
}

// Bước 1. Trả về { total, downloaded, failed }.
export async function exportAudio(onProgress) {
  const dir = await window.showDirectoryPicker({ mode: "readwrite" });
  onProgress?.({ stage: "Đang quét bài..." });
  const docs = await collectDocs();
  const manifest = (await readJson(dir, MANIFEST)) ?? { files: [] };
  const known = new Set(manifest.files.map(f => f.url));
  for (const { data } of docs) {
    for (const url of audioUrlsIn(data)) {
      if (known.has(url)) continue;
      known.add(url);
      const n = String(manifest.files.length + 1).padStart(4, "0");
      manifest.files.push({ n, name: `${n}.${url.split(".").pop().toLowerCase()}`, url, bytes: 0 });
    }
  }

  const stats = { total: manifest.files.length, downloaded: 0, failed: 0 };
  try {
    for (const f of manifest.files) {
      onProgress?.({ stage: `Đang tải về ${f.n}/${manifest.files.length}...` });
      if (f.bytes && (await fileSize(dir, f.name)) === f.bytes) continue;
      try {
        const blob = await retry(async () => {
          const res = await fetch(f.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        });
        await writeFile(dir, f.name, blob);
        f.bytes = blob.size;
        stats.downloaded++;
      } catch {
        stats.failed++;
      }
    }
  } finally {
    await writeFile(dir, MANIFEST, JSON.stringify(manifest, null, 2));
  }
  return stats;
}

// Bước 3. Trả về { replaced, skipped, failed, docs }.
export async function importAudio(onProgress) {
  const dir = await window.showDirectoryPicker({ mode: "readwrite" });
  const manifest = await readJson(dir, MANIFEST);
  if (!manifest) throw new Error("Thư mục này không có manifest.json — chọn đúng thư mục đã tải audio về");
  let compressed;
  try {
    compressed = await dir.getDirectoryHandle(COMPRESSED_DIR);
  } catch {
    throw new Error(`Chưa có thư mục con "${COMPRESSED_DIR}" chứa file đã nén`);
  }
  onProgress?.({ stage: "Đang quét bài..." });
  const docs = await collectDocs();
  const result = (await readJson(dir, RESULT)) ?? { done: [] };
  const stats = { replaced: 0, skipped: 0, failed: 0, docs: 0 };

  for (const f of manifest.files) {
    onProgress?.({ stage: `Đang tải lên ${f.n}/${manifest.files.length}...` });
    const name = `${f.n}.mp3`;
    const using = docs.filter(d => audioUrlsIn(d.data).includes(f.url));
    let file = null;
    try {
      file = await (await compressed.getFileHandle(name)).getFile();
    } catch {
      // không có bản nén cho số này
    }
    // Bỏ qua: không có bản nén, bài không còn dùng link cũ (đã thay ở lần chạy trước), hoặc bản nén không nhẹ hơn.
    if (!file || !file.size || !using.length || (f.bytes && file.size >= f.bytes)) {
      stats.skipped++;
      continue;
    }
    try {
      const newUrl = await retry(() => uploadToCloudinary(new File([file], name, { type: "audio/mpeg" })));
      for (const d of using) {
        const next = mapStrings(d.data, s => s.split(f.url).join(newUrl));
        const patch = {};
        for (const k of Object.keys(next)) {
          if (JSON.stringify(next[k]) !== JSON.stringify(d.data[k])) patch[k] = next[k];
        }
        await updateDoc(d.ref, patch);
        d.data = next;
        stats.docs++;
      }
      result.done.push({ n: f.n, oldUrl: f.url, newUrl, oldBytes: f.bytes, newBytes: file.size, docs: using.map(d => d.ref.path) });
      await writeFile(dir, RESULT, JSON.stringify(result, null, 2));
      stats.replaced++;
    } catch {
      stats.failed++;
    }
  }
  return stats;
}
