import { useEffect, useState } from "react";
import Header from "./Header.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { incrementAttempt } from "../lib/attempts.js";
import { saveTestResult } from "../lib/testResults.js";
import { attemptKey } from "../lib/openings.js";
import KetPetVocabularyQuiz from "./KetPetVocabularyQuiz.jsx";
import { getVocabularyUnit } from "../lib/adminLessons.js";

// Màn học sinh làm Vocabulary 1 Unit KET/PET — tải nội dung từ Firestore rồi giao phần tương tác
// cho KetPetVocabularyQuiz.jsx (dùng chung với Preview trong CMS). Cho làm lại thoải mái (không
// giới hạn lượt, không qua attempts.js) — chốt người dùng 2026-09-14.
export default function KetPetVocabularyRunner({ grade, unit, onNavigate, onBack, ctx }) {
  const { isStaff, isTester } = useAuth();
  const canReview = isStaff || isTester; // hiện đáp án + cho làm lại: admin/giáo viên/tài khoản đặc biệt
  const [doc, setDoc] = useState(undefined); // undefined = đang tải, null = chưa có nội dung

  useEffect(() => {
    let cancelled = false;
    getVocabularyUnit(grade, unit).then(d => {
      if (!cancelled) setDoc(d?.groups?.length ? d : null);
    });
    return () => { cancelled = true; };
  }, [grade, unit]);

  // Học sinh nộp bài: đếm 1 lượt (theo lần mở bài) + lưu chi tiết cho giáo viên; học sinh chỉ thấy số câu đúng.
  function handleSubmitted(graded, answers) {
    const tid = `unit${unit}`;
    if (ctx?.studentUid) incrementAttempt({ uid: ctx.studentUid, mode: "ketpet-vocab", testId: attemptKey(tid, ctx.openingId), seriesId: "ket-pet", level: grade });
    saveTestResult({
      mode: "ketpet-vocab", seriesId: "ket-pet", level: grade, testId: tid, lessonLabel: `KET/PET Grade ${grade} · Unit ${unit} · Vocabulary`,
      studentName: ctx?.studentName, studentClass: ctx?.studentClass, uid: ctx?.studentUid,
      correct: graded.correct, total: graded.total,
      items: graded.results.flatMap((row, gi) => row.map((ok, qi) => ({ group: gi + 1, qNumber: qi + 1, isCorrect: ok, studentAnswer: String(answers[`${gi}-${qi}`] ?? "") }))),
    });
  }

  return (
    <div className="home-v2 lessons-screen-v2">
      <Header page="lessons" onNavigate={onNavigate} />
      <div className="dark-hero-band dark-hero-band-sm">
        <div className="dark-hero-inner dark-hero-inner-row">
          <div className="dark-hero-text dark-hero-text-row">
            <button className="lesson-back-link" onClick={onBack}>⬅ {`Grade ${grade} — Unit ${unit}`}</button>
            <div className="dark-hero-titles">
              <h1 className="dark-hero-title">Vocabulary</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid-section content-grid-section-dark">
        {doc === undefined && <p className="vocab-empty">Đang tải...</p>}
        {doc === null && <p className="vocab-empty">Chưa có nội dung — quay lại sau nhé.</p>}
        {doc && <KetPetVocabularyQuiz groups={doc.groups} limitMinutes={ctx?.limitMinutes} canRetry={!ctx?.studentUid || canReview} revealAnswers={canReview} onSubmitted={ctx ? handleSubmitted : undefined} />}
      </div>
    </div>
  );
}
