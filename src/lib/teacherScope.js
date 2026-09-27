import { BOOK_OPTIONS } from "./classes.js";

// Phân quyền giáo viên phụ THEO CẤP (2026-09-27): hồ sơ `users/{uid}.levelAccess = { "<seriesId>-<cấp>": "view" | "edit" }`
// — key trùng id doc `lessons/{seriesId}-{level}` nên firestore.rules chặn thật theo đúng key này (Kids: "kids-<grade>",
// sách ở kidsBooks). "view" = chỉ xem/làm bài trên trang học sinh; "edit" = thêm soạn bài (CMS) cấp đó.
// Hồ sơ cũ chỉ có `allowedSeriesIds` (theo bộ đề) vẫn chạy: coi như "edit" mọi cấp trong bộ đề đó.
export const levelKey = (seriesId, level) => `${seriesId}-${level}`;

// Admin/giáo viên chính (không restricted) → "edit" mọi cấp; còn lại "edit" | "view" | null.
export function levelAccessOf(profile, role, seriesId, level) {
  if (role === "admin" || (role === "teacher" && !profile?.restricted)) return "edit";
  if (role !== "teacher") return null;
  if ((profile?.allowedSeriesIds ?? []).includes(seriesId)) return "edit";
  return profile?.levelAccess?.[levelKey(seriesId, level)] ?? null;
}

export function seriesLevels(seriesId) {
  return BOOK_OPTIONS.find(o => o.id === seriesId)?.levels ?? [];
}

// Có ít nhất 1 cấp trong bộ đề đạt quyền `need` ("view" = xem hoặc sửa, "edit" = chỉ sửa).
export function seriesHasAccess(profile, role, seriesId, need = "view") {
  return seriesLevels(seriesId).some(l => {
    const a = levelAccessOf(profile, role, seriesId, l);
    return need === "edit" ? a === "edit" : !!a;
  });
}

// Quy đổi hồ sơ (kể cả kiểu cũ allowedSeriesIds) ra map levelAccess đầy đủ — dùng khi mở modal sửa.
export function normalizedLevelAccess(profile) {
  const map = { ...(profile?.levelAccess ?? {}) };
  for (const s of profile?.allowedSeriesIds ?? []) {
    for (const l of seriesLevels(s)) map[levelKey(s, l)] = "edit";
  }
  return map;
}

// Tóm tắt ngắn cho bảng danh sách giáo viên: { edit: "Starters 1, 2 · Kids Grade 1", view: "..." }.
export function summarizeLevelAccess(profile) {
  const map = normalizedLevelAccess(profile);
  const out = { edit: [], view: [] };
  for (const o of BOOK_OPTIONS) {
    for (const want of ["edit", "view"]) {
      const levels = o.levels.filter(l => map[levelKey(o.id, l)] === want);
      if (!levels.length) continue;
      if (levels.length === o.levels.length && o.levels.length > 1) out[want].push(`${o.title} (cả bộ)`);
      else if (o.levels.length === 1) out[want].push(o.title);
      else out[want].push(`${o.title} ${levels.map(l => (o.levelLabel(l).startsWith(o.title) ? l : o.levelLabel(l))).join(", ")}`);
    }
  }
  return { edit: out.edit.join(" · "), view: out.view.join(" · ") };
}
