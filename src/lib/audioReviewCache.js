// Lưu tạm audio ghi âm của học sinh (từng câu mic) NGAY TRÊN TRÌNH DUYỆT (IndexedDB) để học
// sinh tự nghe lại bài mình vừa nói ở màn tổng kết cuối bài — KHÔNG upload lên đâu cả, không ai
// khác (kể cả giáo viên) xem được, tự xoá sau 48h. Xem CLAUDE.md — đây KHÔNG phải dịch vụ ngoài,
// không phát sinh chi phí gì (chỉ dùng ổ đĩa của máy học sinh).
const DB_NAME = "speaking-audio-review";
const DB_VERSION = 1;
const RECORDINGS_STORE = "recordings";
const RUNS_STORE = "runs";

// Xoá cứng sau 48h (dữ liệu biến mất khỏi máy hẳn) — nhưng CHỈ CHO PHÉP nghe lại trong 24h đầu kể
// từ lúc nộp bài (xem isWithinViewWindow), khoảng 24h-48h còn lại chỉ để dọn dẹp tự nhiên, không
// hiện cho học sinh nghe nữa.
const HARD_DELETE_MS = 48 * 60 * 60 * 1000;
export const VIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
        const store = db.createObjectStore(RECORDINGS_STORE, { keyPath: "id" });
        store.createIndex("runId", "runId", { unique: false });
      }
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        db.createObjectStore(RUNS_STORE, { keyPath: "progressKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Trình duyệt cũ/chế độ ẩn danh 1 số máy chặn IndexedDB — mọi hàm dưới đây đều tự nuốt lỗi (không
// throw ra ngoài) vì đây chỉ là tiện ích "nghe lại", không phải luồng chính của bài học.
async function withStore(storeName, mode, fn) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = fn(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return null;
  }
}

// Lưu audio 1 câu mic vừa ghi xong — gọi khi học sinh trả lời ĐÚNG hoặc bị lộ đáp án (hết lượt),
// tức lượt ghi âm CUỐI CÙNG của câu đó (không lưu các lượt sai giữa chừng, đỡ tốn dung lượng).
export async function saveRecording(runId, sceneIndex, examinerLine, blob) {
  await withStore(RECORDINGS_STORE, "readwrite", store => {
    store.put({ id: `${runId}:${sceneIndex}`, runId, sceneIndex, examinerLine, blob, createdAt: Date.now() });
  });
}

// Đánh dấu 1 lượt làm bài đã NỘP (làm xong tới scene cuối) — mốc thời gian này dùng để tính cửa
// sổ 24h được nghe lại. progressKey định danh đúng 1 bài Speaking (vd "starters-1-test1"), ghi đè
// lượt làm trước đó của cùng bài trên máy này (không cần giữ lịch sử nhiều lượt cũ).
export async function submitRun(progressKey, runId) {
  await withStore(RUNS_STORE, "readwrite", store => {
    store.put({ progressKey, runId, submittedAt: Date.now() });
  });
}

export async function getRunRecordings(runId) {
  const all = await withStore(RECORDINGS_STORE, "readonly", store => {
    return new Promise(resolve => {
      const items = [];
      const req = store.index("runId").openCursor(IDBKeyRange.only(runId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => resolve(items);
    });
  });
  const list = (await all) || [];
  return list.sort((a, b) => a.sceneIndex - b.sceneIndex);
}

export function isWithinViewWindow(submittedAt) {
  return typeof submittedAt === "number" && Date.now() - submittedAt < VIEW_WINDOW_MS;
}

// Dọn rác: xoá mọi lượt làm bài + audio đã quá 48h — gọi khi bắt đầu 1 bài Speaking mới (đủ để
// dữ liệu không tồn đọng vô thời hạn trên máy học sinh, không cần lịch/cron riêng).
export async function cleanupExpiredAudio() {
  const now = Date.now();
  const expiredRunIds = await withStore(RUNS_STORE, "readwrite", store => {
    return new Promise(resolve => {
      const expired = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (now - cursor.value.submittedAt > HARD_DELETE_MS) {
            expired.push(cursor.value.runId);
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve(expired);
        }
      };
      req.onerror = () => resolve(expired);
    });
  });
  for (const runId of (await expiredRunIds) || []) {
    await withStore(RECORDINGS_STORE, "readwrite", store => {
      const req = store.index("runId").openCursor(IDBKeyRange.only(runId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    });
  }
}
