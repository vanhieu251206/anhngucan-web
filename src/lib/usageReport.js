// Trang admin "Dung lượng & băng thông" (2026-10-10, pages/dashboard/UsageAnalyticsPage.jsx): ghép SỐ THẬT của
// Cloudinary (lấy qua Worker /admin/cloudinary — worker/src/cloudinary.js, chỉ admin) với dữ liệu của web mình (bài nào
// dùng file nào, bài nào đang mở cho lớp, ngày nào có bao nhiêu lượt nộp) để biết thứ gì đang ngốn hạn mức.
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase.js";
import { callWorker } from "./testSubmit.js";
import { collectDocs, mapStrings } from "./audioRecompress.js";
import { YLE_SERIES } from "./yleData.js";

const CLOUDINARY_URL = /https:\/\/res\.cloudinary\.com\/[^\s"'<>\\)]+/g;
const SUBCOLLECTION_LABEL = {
  tests: "Speaking",
  readingTests: "Reading",
  dictationTests: "Dictation",
  vocabTests: "Vocabulary",
  comprehensionTests: "Đọc hiểu",
  practiceTests: "Luyện đề",
  listeningExamTests: "Listening luyện đề",
  listeningTests: "Listening",
  vocabularyUnits: "Vocabulary",
};

// Khoá chung cho 1 file dù link trong bài có kèm phần nén (f_auto,q_auto...) hay số phiên bản (v123...) hay không:
// "<image|video|raw>/<public_id>". File "raw" giữ nguyên đuôi vì đuôi là một phần public_id.
export function assetKey(url) {
  const m = /res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(.+)$/.exec(String(url).split(/[?#]/)[0]);
  if (!m) return null;
  let parts = m[2].split("/");
  const v = parts.findIndex(p => /^v\d+$/.test(p));
  if (v !== -1) parts = parts.slice(v + 1);
  else while (parts.length > 1 && /^[a-z]{1,3}_[^/]+/.test(parts[0])) parts = parts.slice(1);
  let id = parts.join("/");
  if (m[1] !== "raw") id = id.replace(/\.[a-z0-9]+$/i, "");
  try { id = decodeURIComponent(id); } catch { /* giữ nguyên */ }
  return `${m[1]}/${id}`;
}

function lessonLabel(lessonId) {
  const m = /^(.*)-(\d+)$/.exec(lessonId);
  if (!m) return lessonId;
  if (m[1] === "ket-pet") return `KET/PET Grade ${m[2]}`;
  if (m[1] === "kids") return `Kids Grade ${m[2]}`;
  return `${YLE_SERIES.find(s => s.id === m[1])?.title ?? m[1]} ${m[2]}`;
}

function docLabel(path, data) {
  const p = path.split("/");
  if (p[0] === "kidsBooks") return `Sách Kids · ${data.title ?? p[1]}`;
  if (p[0] !== "lessons") return path;
  if (p.length === 2) return `${lessonLabel(p[1])} · Listening (video)`;
  return `${lessonLabel(p[1])} · ${SUBCOLLECTION_LABEL[p[2]] ?? p[2]} · ${data.title ?? data.name ?? p[3]}`;
}

// Mọi bài + sách Kids kèm danh sách file Cloudinary mà bài đó dùng. Đáp án tách riêng (answerKeys) cũng quét để file
// chỉ nằm trong đáp án không bị tính nhầm là "không bài nào dùng".
export async function scanLessonAssets() {
  const [docs, keySnap] = await Promise.all([collectDocs(), getDocs(collection(db, "answerKeys")).catch(() => null)]);
  const out = docs.map(({ ref, data }) => {
    const keys = new Set();
    mapStrings(data, s => {
      for (const m of s.matchAll(CLOUDINARY_URL)) {
        const k = assetKey(m[0]);
        if (k) keys.add(k);
      }
      return s;
    });
    const p = ref.path.split("/");
    return { path: ref.path, lessonId: p[0] === "lessons" ? p[1] : null, docId: p[p.length - 1], label: docLabel(ref.path, data), keys };
  });
  const extraKeys = new Set();
  keySnap?.docs.forEach(d => mapStrings(d.data(), s => {
    for (const m of s.matchAll(CLOUDINARY_URL)) {
      const k = assetKey(m[0]);
      if (k) extraKeys.add(k);
    }
    return s;
  }));
  return { docs: out.filter(d => d.keys.size > 0), extraKeys };
}

export const loadCloudinaryUsage = () => callWorker("/admin/cloudinary", { action: "usage" });
export const loadCloudinaryResources = () => callWorker("/admin/cloudinary", { action: "resources" });

// Lượt nộp bài theo ngày (giờ máy) + các lần mở bài còn hạn. testResults chỉ giữ tới 48h sau hạn chót nên ngày cũ có thể thiếu.
export async function loadActivity() {
  const [results, openings] = await Promise.all([getDocs(collection(db, "testResults")), getDocs(collection(db, "openings"))]);
  const submitsByDay = {};
  results.docs.forEach(d => {
    const at = d.data().submittedAt?.toDate?.();
    if (!at) return;
    const key = localDay(at);
    submitsByDay[key] = (submitsByDay[key] ?? 0) + 1;
  });
  const now = Date.now();
  const active = openings.docs.map(d => d.data()).filter(o => !o.expiresAt?.toMillis || o.expiresAt.toMillis() > now);
  return { submitsByDay, activeOpenings: active };
}

export function localDay(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Ghép file Cloudinary (có dung lượng thật) với bài dùng nó. files có thể rỗng (Worker chưa cấu hình) — khi đó chỉ còn số file.
export function buildReport({ docs, extraKeys }, files, activeOpenings = []) {
  const byKey = new Map(files.map(f => [`${f.type}/${f.id}`, f]));
  const usedBy = new Map(); // key → [label bài]
  const openCount = new Map(); // "<lessonId>|<docId>" → số lớp đang mở
  activeOpenings.forEach(o => {
    const k = `${o.seriesId}-${o.level}|${o.testId}`;
    openCount.set(k, (openCount.get(k) ?? 0) + 1);
  });

  const lessons = docs.map(d => {
    let images = 0, audios = 0, imageBytes = 0, audioBytes = 0;
    d.keys.forEach(k => {
      usedBy.set(k, [...(usedBy.get(k) ?? []), d.label]);
      const bytes = byKey.get(k)?.bytes ?? 0;
      if (k.startsWith("image/")) { images += 1; imageBytes += bytes; }
      else { audios += 1; audioBytes += bytes; }
    });
    return {
      path: d.path, label: d.label, images, audios, imageBytes, audioBytes, bytes: imageBytes + audioBytes,
      openClasses: openCount.get(`${d.lessonId}|${d.docId}`) ?? 0,
    };
  }).sort((a, b) => b.bytes - a.bytes || b.images + b.audios - (a.images + a.audios));

  const withUse = files.map(f => ({ ...f, usedBy: usedBy.get(`${f.type}/${f.id}`) ?? [] }));
  const orphans = withUse.filter(f => f.usedBy.length === 0 && !extraKeys.has(`${f.type}/${f.id}`)).sort((a, b) => b.bytes - a.bytes);
  const sum = list => list.reduce((s, f) => s + f.bytes, 0);
  return {
    lessons,
    biggest: [...withUse].sort((a, b) => b.bytes - a.bytes).slice(0, 30),
    orphans,
    orphanBytes: sum(orphans),
    totalBytes: sum(files),
    imageBytes: sum(files.filter(f => f.type === "image")),
    audioBytes: sum(files.filter(f => f.type !== "image")),
  };
}

export function formatBytes(n) {
  if (n == null) return "—";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
