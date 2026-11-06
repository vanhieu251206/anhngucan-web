import { useMemo, useRef, useState } from "react";
import ExamTimer, { useExamTimer } from "./ExamTimer.jsx";
import SubmitStatus from "./SubmitStatus.jsx";
import TestScoreReport from "./TestScoreReport.jsx";
import { AnswerSheet, PaperView } from "./PaperAnswerSheet.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { useTestSubmission } from "../lib/testSubmit.js";
import { gradeSubmission } from "../lib/grading/index.js";

// Học sinh làm 1 đề "Tải đề lên" — DÙNG CHUNG mọi dạng bài (2026-11-06): đề có `paperMode` + `paper` + `sheet`
// (components/dashboard/PaperModeGate.jsx). Đề trái, phiếu phải; câu trả lời gửi máy chủ dạng { [số câu]: giá trị },
// máy chủ chấm bằng `gradeSubmission` (nhánh isPaperTest). preview: CMS xem trước — chấm tại chỗ, hiện đáp án.
export default function PaperSheetRunner({ test, kind, seriesId, level, testId, limitMinutes, studentName, lessonLabel, openingId, onFinish, preview = false, submit = null }) {
  const { isStaff, isTester } = useAuth();
  const canReview = preview || isStaff || isTester;
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitState, setSubmitState] = useState(null);
  const elapsedRef = useRef(null);
  const questions = useMemo(() => test?.sheet ?? [], [test]);

  // submit: hàm nộp của trang cha đã có useTestSubmission sẵn (KET/PET Vocabulary) — khi đó hook ở đây tắt (openingId
  // null) để không ghi giờ bắt đầu / giám sát rời tab 2 lần.
  const ownSubmit = useTestSubmission({ kind, seriesId, level, testId, openingId: submit ? null : openingId, lessonLabel, studentName });
  const submitToServer = submit ?? ownSubmit;

  function gradeHere() {
    return gradeSubmission(kind, test, answers);
  }

  async function handleSubmit() {
    if (result || (submitState && !submitState.error)) return;
    elapsedRef.current = timer.getElapsedMs();
    if (preview) {
      setResult(gradeHere());
      return;
    }
    const pending = submitToServer({ answers, elapsedMs: elapsedRef.current });
    if (canReview) {
      pending.catch(() => {});
      setResult(gradeHere());
      return;
    }
    setSubmitState({});
    try {
      const r = await pending;
      setResult({ correct: r.correct, total: r.total, items: [] });
      setSubmitState(null);
    } catch (error) {
      setSubmitState(error?.retry ? null : { error });
    }
  }

  const timer = useExamTimer({ limitMinutes: preview ? null : limitMinutes, running: !result && !submitState, onExpire: handleSubmit });

  if (result && !canReview) {
    return <TestScoreReport correct={result.correct} total={result.total} elapsedMs={elapsedRef.current} onDone={onFinish} openingId={openingId} />;
  }

  const verdicts = new Map((result?.items ?? []).map(it => [it.qNumber, it.isCorrect]));
  const active = questions.filter(q => !q.skip).length;
  const answered = questions.filter((q, i) => !q.skip && String(answers[i + 1] ?? "").trim()).length;

  return (
    <div className="paper-sheet-runner">
      {!result && <ExamTimer timer={timer} />}
      <div className="paper-layout">
        <div className="paper-doc"><PaperView paper={test.paper} /></div>
        <div className="paper-sheet">
          {result && <p className="yle-vocab-score">Đúng {result.correct}/{result.total}</p>}
          <AnswerSheet
            questions={questions}
            audios={test.paper?.audios}
            valueOf={qi => answers[qi + 1]}
            resultOf={qi => (result ? verdicts.get(qi + 1) ?? null : null)}
            showKey={result != null}
            locked={result != null}
            onAnswer={(qi, v) => setAnswers(a => ({ ...a, [qi + 1]: v }))}
          />
          {submitState ? (
            <SubmitStatus error={submitState.error} onRetry={handleSubmit} />
          ) : result ? (
            <div className="yle-vocab-actions">
              <button type="button" className="btn btn-primary" onClick={onFinish}>Xong</button>
            </div>
          ) : (
            <div className="yle-vocab-actions">
              <span className="yle-vocab-progress">Đã làm {answered}/{active} câu</span>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>Nộp bài</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
