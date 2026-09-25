// Chuyển MỘT LẦN các đề soạn trước 2026-09-25 sang dạng tách đáp án (lib/grading/answerKeys.js): đề cũ vẫn chứa đáp
// án ngay trong đề nên học sinh đọc được. Chỉ admin chạy (Tổng quan → "Tách đáp án bài cũ"). Chạy lại nhiều lần không
// sao — đề đã tách (`answersSplit`) thì bỏ qua. Duyệt theo danh sách bộ đề/cấp cố định (yleData.js) vì doc lesson cha
// có thể không tồn tại (Firestore không liệt kê được subcollection của doc "ma").
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase.js";
import { YLE_SERIES, KET_PET_GRADES } from "./yleData.js";
import { saveWithAnswers } from "./answerStore.js";

const CONTENT_FIELD = {
  readingTests: "parts",
  listeningTests: "sections",
  listeningExamTests: "parts",
  vocabularyUnits: "groups",
};

function lessonTargets() {
  const targets = [];
  YLE_SERIES.forEach(series => {
    if (series.id === "ket-pet") return;
    (series.levels ?? []).forEach(level => {
      const lessonId = `${series.id}-${level.number}`;
      ["readingTests", "practiceTests", "listeningTests", "listeningExamTests"].forEach(col => targets.push({ seriesId: series.id, lessonId, col }));
    });
  });
  KET_PET_GRADES.forEach(grade => {
    const lessonId = `ket-pet-${grade}`;
    ["vocabularyUnits", "practiceTests"].forEach(col => targets.push({ seriesId: "ket-pet", lessonId, col }));
  });
  return targets;
}

// Trả về { migrated, skipped, failed }.
export async function migrateAnswerKeys(onProgress) {
  const stats = { migrated: 0, skipped: 0, failed: 0 };
  for (const { seriesId, lessonId, col } of lessonTargets()) {
    const snap = await getDocs(collection(db, "lessons", lessonId, col));
    for (const d of snap.docs) {
      const data = d.data();
      const field = col === "practiceTests" ? (lessonId.startsWith("ket-pet") ? "groups" : "passages") : CONTENT_FIELD[col];
      if (data.answersSplit || data[field] == null) {
        stats.skipped++;
        continue;
      }
      try {
        await saveWithAnswers(seriesId, lessonId, col, d.id, data);
        stats.migrated++;
      } catch {
        stats.failed++;
      }
      onProgress?.({ ...stats });
    }
  }
  return stats;
}
