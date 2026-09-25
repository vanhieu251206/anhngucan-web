// Đọc/ghi Firestore qua REST API bằng khoá service account (bỏ qua Security Rules — CHỈ Worker có quyền này).
// Dùng cho chấm bài phía máy chủ (submit.js): đọc đề + đáp án, hồ sơ học sinh, lần mở bài, số lượt; ghi kết quả.
import { getAccessToken, parseServiceAccount, adminError } from "./admin.js";

// ---------- Chuyển đổi giá trị Firestore (typed JSON) <-> JS ----------
export function decodeValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields ?? {});
  if ("referenceValue" in v) return v.referenceValue;
  if ("geoPointValue" in v) return v.geoPointValue;
  return null;
}

export function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = decodeValue(v);
  return out;
}

export function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { nullValue: null };
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) {
    // Firestore cấm mảng lồng trực tiếp trong mảng — bọc mảng con thành map { items }.
    return { arrayValue: { values: v.map(x => (Array.isArray(x) ? encodeValue({ items: x }) : encodeValue(x))) } };
  }
  if (typeof v === "object") return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
}

export function encodeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v !== undefined) out[k] = encodeValue(v);
  }
  return out;
}

// ---------- Client ----------
export function firestore(env) {
  const sa = parseServiceAccount(env);
  const projectId = sa.project_id;
  const root = `projects/${projectId}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;

  async function authHeaders() {
    return { authorization: `Bearer ${await getAccessToken(sa)}`, "Content-Type": "application/json" };
  }

  return {
    projectId,
    // Tên đầy đủ của 1 document, dùng trong commit.
    name: path => `${root}/${path}`,

    // Đọc 1 document → object JS, hoặc null nếu không tồn tại.
    async get(path) {
      const res = await fetch(`${base}/${path.split("/").map(encodeURIComponent).join("/")}`, { headers: await authHeaders() });
      if (res.status === 404) return null;
      if (!res.ok) throw adminError(502, "firestore-read-failed");
      const doc = await res.json();
      return decodeFields(doc.fields);
    },

    // Ghi nhiều thao tác nguyên tử (writes theo định dạng REST `Write`).
    async commit(writes) {
      const res = await fetch(`${base}:commit`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ writes }),
      });
      if (!res.ok) {
        console.error("firestore commit", res.status, await res.text());
        throw adminError(502, "firestore-write-failed");
      }
    },
  };
}

export function randomDocId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}
