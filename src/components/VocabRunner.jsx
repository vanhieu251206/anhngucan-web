import { useMemo, useRef, useState } from "react";
import ExamTimer, { useExamTimer } from "./ExamTimer.jsx";
import SubmitStatus from "./SubmitStatus.jsx";
import TestScoreReport from "./TestScoreReport.jsx";
import { useAuth } from "../lib/authContext.jsx";
import { useTestSubmission } from "../lib/testSubmit.js";
import { optimizeImage } from "../lib/cloudinaryImage.js";
import { scrambleWord } from "../lib/grading/reading.js";
import { acceptedAnswers, gradeVocabItems, vocabItemReady, vocabTypeInfo } from "../lib/grading/vocab.js";

// Học sinh làm 1 bài Vocabulary (Starters/Movers/Flyers) — mọi câu trên 1 trang, nộp 1 lần, máy chủ chấm
// (lib/grading/vocab.js). Học sinh chỉ thấy số câu đúng/tổng; admin/giáo viên/tester (đề có đáp án) thấy đúng/sai.
// preview: nút "👁 Preview" trong CMS — chấm tại chỗ, không gửi máy chủ.
export default function VocabRunner({ items, onFinish, seriesId, level, testId, limitMinutes, studentName, lessonLabel, openingId, preview = false }) {
  const { isStaff, isTester } = useAuth();
  const canReview = preview || isStaff || isTester;
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitState, setSubmitState] = useState(null);
  const elapsedRef = useRef(null);

  // Giữ chỉ số gốc — máy chủ chấm theo vị trí trong mảng `items` đầy đủ.
  const shown = useMemo(() => (items ?? []).map((item, i) => ({ item, i })).filter(({ item }) => vocabItemReady(item)), [items]);

  const submitToServer = useTestSubmission({ kind: "yle-vocab", seriesId, level, testId, openingId, lessonLabel, studentName });

  async function handleSubmit() {
    if (result || (submitState && !submitState.error)) return;
    elapsedRef.current = timer.getElapsedMs();
    if (preview) {
      setResult(gradeVocabItems(items, answers));
      return;
    }
    const pending = submitToServer({ answers, elapsedMs: elapsedRef.current });
    if (canReview) {
      pending.catch(() => {});
      setResult(gradeVocabItems(items, answers));
      return;
    }
    setSubmitState({});
    try {
      const r = await pending;
      setResult({ correct: r.correct, total: r.total, results: [] });
      setSubmitState(null);
    } catch (error) {
      setSubmitState({ error });
    }
  }

  const timer = useExamTimer({ limitMinutes: preview ? null : limitMinutes, running: !result && !submitState, onExpire: handleSubmit });

  function setAnswer(i, value) {
    setAnswers(a => ({ ...a, [i]: value }));
  }

  if (result && !canReview) {
    return <TestScoreReport correct={result.correct} total={result.total} elapsedMs={elapsedRef.current} onDone={onFinish} openingId={openingId} />;
  }

  const answeredCount = shown.filter(({ i }) => String(answers[i] ?? "").trim()).length;

  return (
    <div className="vocab-runner yle-vocab-runner">
      {!result && <ExamTimer timer={timer} />}
      {result && (
        <p className="yle-vocab-score">
          Đúng {result.correct}/{result.total}
        </p>
      )}
      {shown.map(({ item, i }, n) => (
        <VocabQuestion
          key={i}
          number={n + 1}
          item={item}
          value={answers[i] ?? ""}
          onChange={v => setAnswer(i, v)}
          locked={result != null}
          verdict={result ? result.results[i] : null}
        />
      ))}

      {submitState ? (
        <SubmitStatus error={submitState.error} onRetry={handleSubmit} />
      ) : result ? (
        <div className="yle-vocab-actions">
          <button type="button" className="btn btn-primary" onClick={onFinish}>Xong</button>
        </div>
      ) : (
        <div className="yle-vocab-actions">
          <span className="yle-vocab-progress">Đã làm {answeredCount}/{shown.length} câu</span>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>Nộp bài</button>
        </div>
      )}
    </div>
  );
}

function VocabQuestion({ number, item, value, onChange, locked, verdict }) {
  const info = vocabTypeInfo(item.type);
  const stateClass = verdict === true ? " is-correct" : verdict === false ? " is-wrong" : "";
  return (
    <div className={`vocab-question yle-vocab-question${stateClass}`}>
      <div className="reading-question-badge"><span className="reading-question-num">Question {number}</span></div>
      <p className="vocab-group-instruction">{info.instruction}</p>

      {item.type === "picture" && <img className="yle-vocab-img" src={optimizeImage(item.imageUrl)} alt="" />}
      {item.type === "listen" && <audio className="vocab-audio" src={item.audioUrl} controls preload="none" />}
      {item.type === "definition" && <p className="vocab-passage">{item.definition}</p>}

      {item.type === "scramble" ? (
        <ScrambleInput item={item} value={value} onChange={onChange} locked={locked} />
      ) : (
        <input
          className="dictation-input yle-vocab-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={locked}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="Write the word..."
        />
      )}

      {verdict === false && item.answer && (
        <p className="yle-vocab-correct">Đáp án: {acceptedAnswers(item.answer).join(" / ")}</p>
      )}
    </div>
  );
}

// Chữ cái đã xáo (chỉ đọc) + dãy ô gõ từng chữ kiểu mã PIN — cùng giao diện dạng xếp chữ của Reading.
function ScrambleInput({ item, value, onChange, locked }) {
  const word = item.answer ? acceptedAnswers(item.answer)[0] ?? "" : "";
  const scrambled = useMemo(() => (word ? scrambleWord(word) : item.scrambled ?? ""), [word, item.scrambled]);
  const length = word ? word.length : item.answerLength ?? scrambled.length;
  const chars = Array.from({ length }, (_, k) => value[k] ?? "");
  const refs = useRef([]);

  function setChar(pos, raw) {
    const ch = raw.slice(-1);
    const next = [...chars];
    next[pos] = ch || " ";
    onChange(next.join("").replace(/\s+$/, ""));
    if (ch && pos < length - 1) refs.current[pos + 1]?.focus();
  }

  function handleKeyDown(pos, e) {
    if (e.key === "Backspace" && !chars[pos].trim() && pos > 0) {
      const next = [...chars];
      next[pos - 1] = " ";
      onChange(next.join("").replace(/\s+$/, ""));
      refs.current[pos - 1]?.focus();
    }
  }

  return (
    <>
      <div className="reading-scramble-prompt">
        {scrambled.split("").map((c, k) => (
          <span className="reading-scramble-prompt-tile" key={k}>{c}</span>
        ))}
      </div>
      <div className="reading-scramble-pin-row">
        {chars.map((c, pos) => (
          <input
            key={pos}
            ref={el => (refs.current[pos] = el)}
            className="reading-scramble-pin-input"
            value={c.trim()}
            maxLength={1}
            disabled={locked}
            autoCapitalize="off"
            autoComplete="off"
            onFocus={e => e.target.select()}
            onChange={e => setChar(pos, e.target.value)}
            onKeyDown={e => handleKeyDown(pos, e)}
          />
        ))}
      </div>
    </>
  );
}
