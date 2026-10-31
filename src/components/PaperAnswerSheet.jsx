import { Fragment } from "react";
import { optimizeImage } from "../lib/cloudinaryImage.js";
import { isChoiceAnswer } from "../lib/ketPetPracticeTest.js";

// Đề tải lên (paper.pages = ảnh từng trang của PDF, paper.html = file Word đã đổi sang HTML — lib/paperUpload.js).
// Dùng chung KET/PET Practice Test + IELTS Reading/Listening.
export function PaperView({ paper }) {
  if (paper?.pages?.length) {
    return paper.pages.map((url, i) => <img key={i} className="paper-page" src={optimizeImage(url)} alt={`Trang ${i + 1}`} loading={i > 1 ? "lazy" : undefined} />);
  }
  // HTML đã lọc thẻ lúc tải lên (sanitizePaperHtml) — chỉ còn thẻ định dạng + ảnh.
  if (paper?.html) return <div className="paper-html" dangerouslySetInnerHTML={{ __html: paper.html }} />;
  return null;
}

// Phiếu trả lời của đề tải lên: mỗi câu 1 hàng — số câu + nút A/B/C/D hoặc ô gõ. Audio theo đoạn câu (paper.audios,
// số câu hiển thị): khung "🎧 Nghe cho câu X–Y" + trình phát đặt ngay trên câu X, các câu X..Y có viền màu bên trái.
// startNumber: số của câu đầu (IELTS Passage 2 bắt đầu từ 14...). valueOf/resultOf/onAnswer theo chỉ số câu (0..).
export function AnswerSheet({ questions, audios, startNumber = 1, valueOf, resultOf, showKey, locked, onAnswer, rowId, rowRef }) {
  const clips = (audios ?? []).filter(a => a?.url && a.from).map(a => ({ ...a, to: Math.max(a.to || a.from, a.from) }));
  const inClip = n => clips.some(a => n >= a.from && n <= a.to);
  return (
    <ol className="paper-key-list paper-answer-list">
      {questions.map((q, qi) => {
        const num = startNumber + qi;
        const starts = clips.filter(a => a.from === num);
        return (
          <Fragment key={qi}>
            {starts.map((a, k) => (
              <li key={`audio-${k}`} className="paper-audio-head">
                <span className="paper-audio-label">🎧 Nghe cho {a.to > a.from ? `câu ${a.from}–${a.to}` : `câu ${a.from}`}</span>
                <audio src={a.url} controls preload="none" controlsList="nodownload" />
              </li>
            ))}
            {renderRow(q, qi, num, inClip(num) ? " paper-in-audio" : "")}
          </Fragment>
        );
      })}
    </ol>
  );

  function renderRow(q, qi, num, extraClass) {
    const value = valueOf(qi);
    const r = resultOf?.(qi);
    const common = { id: rowId?.(qi), ref: rowRef ? el => rowRef(qi, el) : undefined };
    if (q.skip) {
      return (
        <li {...common} className={`paper-key-row is-skipped${extraClass}`}>
          <span className="paper-skip-text">Câu {num}: không cần làm</span>
        </li>
      );
    }
    return (
      <li {...common} className={`paper-key-row${extraClass}`}>
        <span className="paper-key-num">{num}</span>
        {q.type === "multiple-choice" ? (
          <div className="paper-choice-row">
            {q.options.map((letter, oi) => {
              const picked = value === oi;
              const isRight = showKey && isChoiceAnswer(q, oi);
              return (
                <button
                  key={oi}
                  type="button"
                  disabled={locked}
                  aria-pressed={picked}
                  className={"paper-choice" + (picked ? " is-picked" : "") + (isRight ? " is-correct" : "") + (showKey && picked && !isRight ? " is-wrong" : "")}
                  onClick={() => onAnswer(qi, picked ? undefined : oi)}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="paper-text-cell">
            <input
              className={"vocab-input" + (r === true ? " is-correct" : "") + (r === false ? " is-wrong" : "")}
              value={value ?? ""}
              disabled={locked}
              aria-label={`Câu ${num}`}
              onChange={e => onAnswer(qi, e.target.value)}
            />
            {showKey && r === false && <p className="vocab-answer-key">Đáp án đúng: {(q.acceptedAnswers ?? []).join(" / ")}</p>}
          </div>
        )}
      </li>
    );
  }
}
