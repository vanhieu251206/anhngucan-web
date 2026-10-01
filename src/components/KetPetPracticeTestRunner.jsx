import { useEffect, useState } from "react";
import SubmittedNotice from "./SubmittedNotice.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { useTestSubmission } from "../lib/testSubmit.js";
import KetPetPracticeTestQuiz from "./KetPetPracticeTestQuiz.jsx";
import { getKetPetPracticeTest } from "../lib/adminLessons.js";

// Màn học sinh làm 1 Practice Test (1-4) của 1 Unit KET/PET — cùng khung với
// KetPetVocabularyRunner.jsx: tải nội dung từ Firestore rồi giao phần tương tác cho
// KetPetPracticeTestQuiz.jsx (dùng chung với Preview trong CMS). Cho làm lại thoải mái (không giới
// hạn lượt, không qua attempts.js).
export default function KetPetPracticeTestRunner({ grade, unit, testNumber, onBack, ctx }) {
  const { isStaff, isTester } = useAuth();
  const canReview = isStaff || isTester; // hiện đáp án + cho làm lại: admin/giáo viên/tài khoản đặc biệt
  const [doc, setDoc] = useState(undefined); // undefined = đang tải, null = chưa có nội dung
  const [submittedOk, setSubmittedOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getKetPetPracticeTest(grade, unit, testNumber).then(d => {
      if (!cancelled) setDoc(d?.groups?.length ? d : null);
    });
    return () => { cancelled = true; };
  }, [grade, unit, testNumber]);

  const submitToServer = useTestSubmission({
    kind: "ketpet-test", seriesId: "ket-pet", level: grade, testId: `unit${unit}-test${testNumber}`, openingId: ctx?.openingId,
    lessonLabel: `KET/PET Grade ${grade} · Unit ${unit} · Test ${testNumber}`, studentName: ctx?.studentName,
  });

  // Máy chủ chấm + ghi kết quả + cộng lượt (lib/testSubmit.js). Học sinh: trả Promise điểm để quiz hiện; admin/giáo
  // viên (có đáp án) chấm tại chỗ, chỉ gửi máy chủ để lưu.
  function handleSubmitted(graded, answers) {
    const pending = submitToServer({ answers });
    if (canReview) {
      pending.catch(() => {});
      return undefined;
    }
    // Học sinh: nộp thành công → chỉ báo "Nộp bài thành công", điểm xem sau hạn chót (SubmittedNotice.jsx).
    if (ctx?.openingId) pending.then(() => setSubmittedOk(true), () => {});
    return pending;
  }

  // Cùng khung toàn màn hình với bài Reading (LessonsPage.jsx): thanh "Quay lại" + tên bài, thân bài cuộn bên trong.
  return (
    <div className="reading-fullscreen">
      <div className="speaking-fullscreen-topbar">
        <button className="speaking-fullscreen-back" onClick={onBack}>⬅ Quay lại</button>
        <span className="speaking-fullscreen-title">{`Grade ${grade} · Unit ${unit} · Practice Test ${testNumber}`}</span>
      </div>
      <div className="speaking-fullscreen-body reading-fullscreen-body">
        {doc === undefined && <p className="ketpet-test-empty">Đang tải...</p>}
        {doc === null && <p className="ketpet-test-empty">Chưa có nội dung — quay lại sau nhé.</p>}
        {doc && submittedOk && <SubmittedNotice openingId={ctx.openingId} onDone={onBack} />}
        {doc && !submittedOk && <KetPetPracticeTestQuiz page groups={doc.groups} limitMinutes={ctx?.limitMinutes} canRetry={!ctx?.studentUid || canReview} revealAnswers={canReview} onSubmitted={ctx ? handleSubmitted : undefined} />}
      </div>
    </div>
  );
}
