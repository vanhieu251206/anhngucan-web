// Số liệu thật của Cloudinary cho trang admin "Dung lượng & băng thông" (2026-10-10, src/lib/usageReport.js). Admin API
// của Cloudinary cần API Secret nên trình duyệt không gọi thẳng được — Worker giữ khoá, chỉ admin gọi được, CHỈ ĐỌC
// (không xoá/sửa file nào). Secret: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (worker/README.md).
import { adminError, firebaseProjectId, verifyIdToken } from "./admin.js";
import { firestore } from "./firestore.js";

const MAX_DAYS = 30; // Worker gói free tối đa 50 lượt gọi ra ngoài mỗi request — 30 ngày + 1 lượt tổng là vừa
const RESOURCE_TYPES = ["image", "video", "raw"]; // audio nằm trong "video"
const MAX_PAGES_PER_TYPE = 12; // 500 file/trang

async function cloudinaryGet(env, path) {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}${path}`, {
    headers: { authorization: `Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}` },
  });
  if (res.status === 401 || res.status === 403) throw adminError(502, "cloudinary-bad-credentials");
  if (res.status === 420 || res.status === 429) throw adminError(429, "cloudinary-rate-limited");
  if (!res.ok) throw adminError(502, "cloudinary-error");
  return res.json();
}

function slimUsage(u) {
  return {
    plan: u.plan ?? null,
    lastUpdated: u.last_updated ?? null,
    credits: u.credits ? { usage: u.credits.usage ?? null, limit: u.credits.limit ?? null, usedPercent: u.credits.used_percent ?? null } : null,
    storage: u.storage?.usage ?? null,
    bandwidth: u.bandwidth?.usage ?? null,
    transformations: u.transformations?.usage ?? null,
    requests: u.requests ?? null,
    resources: u.resources ?? null,
    derivedResources: u.derived_resources ?? null,
  };
}

// Cloudinary nhận ngày dạng dd-mm-yyyy (giờ UTC).
function cloudinaryDate(d) {
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

async function usageReport(env, days) {
  const n = Math.min(Math.max(Number(days) || MAX_DAYS, 1), MAX_DAYS);
  const dates = []; // n ngày gần nhất, tính cả hôm nay (số hôm nay còn tăng tiếp)
  for (let i = n - 1; i >= 0; i--) dates.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
  const [now, ...daily] = await Promise.all([
    cloudinaryGet(env, "/usage"),
    // 1 ngày lỗi (vd Cloudinary chưa có số của hôm qua) không làm hỏng cả báo cáo.
    ...dates.map(d => cloudinaryGet(env, `/usage?date=${cloudinaryDate(d)}`).catch(() => null)),
  ]);
  return {
    now: slimUsage(now),
    days: dates.map((d, i) => ({ date: d.toISOString().slice(0, 10), ...(daily[i] ? slimUsage(daily[i]) : { missing: true }) })),
  };
}

async function resourceList(env) {
  const files = [];
  let truncated = false;
  for (const type of RESOURCE_TYPES) {
    let cursor = null;
    for (let page = 0; page < MAX_PAGES_PER_TYPE; page++) {
      const data = await cloudinaryGet(env, `/resources/${type}/upload?max_results=500${cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : ""}`);
      for (const r of data.resources ?? []) {
        files.push({ type, id: r.public_id, format: r.format ?? null, bytes: r.bytes ?? 0, createdAt: r.created_at ?? null, url: r.secure_url });
      }
      cursor = data.next_cursor ?? null;
      if (!cursor) break;
    }
    if (cursor) truncated = true;
  }
  return { files, truncated };
}

// body: { action: "usage", days? } | { action: "resources" }. Chỉ admin.
export async function cloudinaryReport(request, env) {
  const db = firestore(env);
  const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const uid = await verifyIdToken(idToken, firebaseProjectId(env));
  const profile = await db.get(`users/${uid}`);
  if (!profile || profile.disabled || profile.role !== "admin") throw adminError(403, "forbidden");
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw adminError(500, "cloudinary-not-configured");
  }
  const body = await request.json().catch(() => null);
  if (body?.action === "usage") return usageReport(env, body.days);
  if (body?.action === "resources") return resourceList(env);
  throw adminError(400, "bad-request");
}
