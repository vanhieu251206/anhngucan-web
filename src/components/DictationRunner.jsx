import { useEffect, useRef, useState } from "react";
import { normalize } from "../lib/speech.js";
import { incrementAttempt } from "../lib/attempts.js";
import { BEE } from "./sceneVisuals.jsx";

// Runner học sinh cho Dictation (Nghe & gõ lại) — mô phỏng dailydictation.com: chấm theo TỪNG TỪ
// (không phải khớp cả câu 1 lần) — từ gõ đúng hiện xanh, từ còn lại (sai/chưa gõ tới) bị CHE bằng
// dấu "*" theo đúng độ dài (không lộ đáp án ngay), cho phép SỬA LẠI VÀ KIỂM TRA LẠI nhiều lần thay
// vì ép qua câu kế tiếp khi sai, có nút "Bỏ qua" riêng để xem đáp án thật khi chịu thua (khớp đúng
// cơ chế Check/Skip của trang tham khảo — chốt người dùng 2026-09-08).

// So khớp TỪNG TỪ theo đúng vị trí — dùng cho panel che đáp án (che *, live theo từng lần gõ) LẪN
// cho câu "Đã kiểm tra" ở màn tổng kết cuối bài (đã hoàn thành — không cần che nữa, xem buildResultDiff).
function wordDiff(typed, correct) {
  const typedWords = typed.trim().split(/\s+/).filter(Boolean);
  const correctWords = correct.trim().split(/\s+/).filter(Boolean);
  return correctWords.map((w, i) => {
    const t = typedWords[i] ?? "";
    return { word: w, ok: !!t && normalize(t) === normalize(w) };
  });
}

// Panel "che đáp án" hiện SỐNG theo từng lần gõ lại (không đợi bấm Kiểm tra) — từ đã gõ đúng hiện
// nguyên văn (kèm dấu câu thật) tô xanh đậm, từ còn lại thay bằng đúng số dấu "*" theo độ dài (giữ
// nguyên cả dấu câu dính liền, vd "Club." -> "*****" 5 ký tự) — không đưa ra chữ thật để học sinh
// không thấy trước đáp án, chỉ thấy được cấu trúc/độ dài câu.
function maskedPreview(typed, correct) {
  return wordDiff(typed, correct).map(({ word, ok }) => (ok ? word : "*".repeat(word.length)));
}

// Diff dùng cho màn tổng kết CUỐI BÀI (đã xong hẳn, không còn lý do che) — hiện đúng chữ thật, chỉ
// khác màu xanh/đỏ theo đúng/sai để học sinh ôn lại.
function revealDiff(typed, correct) {
  return wordDiff(typed, correct).map(({ word, ok }) => ({ word, ok }));
}

// Màn "Xem lại transcript" mở từ màn tổng kết — liệt kê lại TOÀN BỘ câu đúng của Test, mỗi dòng có
// nút play riêng để nghe lại (không phải 1 thanh audio liên tục chạy xuyên suốt cả bài kiểu
// dailydictation.com — audio của mình lưu theo TỪNG CÂU riêng lẻ qua CMS, không phải 1 file dài,
// nên danh sách nút play từng dòng là cách tự nhiên nhất, đã chốt với người dùng 2026-09-08 là đủ
// dùng, không cần ghép thành audio liên tục).
function TranscriptReview({ sentences, onBack }) {
  const [playingIndex, setPlayingIndex] = useState(null);
  const audioRef = useRef(null);

  function playLine(i) {
    const el = audioRef.current;
    if (!el) return;
    if (playingIndex === i) {
      el.pause();
      setPlayingIndex(null);
      return;
    }
    el.src = sentences[i].audioUrl;
    el.currentTime = 0;
    el.play().catch(() => {});
    setPlayingIndex(i);
  }

  return (
    <div className="dictation-transcript">
      <audio ref={audioRef} onEnded={() => setPlayingIndex(null)} />
      <div className="dictation-transcript-head">
        <button type="button" className="dictation-transcript-back" onClick={onBack}>← Quay lại kết quả</button>
        <h2 className="dictation-transcript-title">Xem lại toàn bộ transcript</h2>
      </div>
      <ol className="dictation-transcript-list">
        {sentences.map((s, i) => (
          <li key={i} className={`dictation-transcript-row${playingIndex === i ? " is-playing" : ""}`}>
            <button
              type="button"
              className="dictation-transcript-play"
              onClick={() => playLine(i)}
              aria-label={playingIndex === i ? "Tạm dừng" : "Nghe câu này"}
            >
              {playingIndex === i ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <span className="dictation-transcript-text">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Trạng thái từng câu: null = chưa kiểm tra lần nào; "wrong" = đã kiểm tra, sai (vẫn SỬA + KIỂM
// TRA LẠI được); "correct" = đúng; "skipped" = bấm "Bỏ qua", đã lộ đáp án thật, không sửa được nữa.
function blankAnswer() {
  return { typed: "", attemptStatus: null };
}

// Các mức tốc độ phát lại — khớp kiểu dropdown "Speed: 0.5x/0.75x/1x..." của trang tham khảo
// (dailydictation.com), thay cho nút bật/tắt "Nghe chậm" chỉ có đúng 1 mức cố định trước đây (chốt
// người dùng 2026-09-08). Không cần dày như bản gốc (0.25x tới 2x) — học sinh nhỏ tuổi chỉ cần vài
// mức chậm rõ rệt + tốc độ thường.
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25];

function formatTime(t) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Thanh audio gọn kiểu trình duyệt/trang tham khảo (play/pause + thời gian + thanh tua) thay cho
// nút tròn to "▶ Nghe câu này" trước đây (chốt người dùng 2026-09-08) — tua được bằng cách bấm vào
// thanh, không chỉ nghe lại từ đầu mỗi lần bấm play.
function AudioBar({ audioRef }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const barRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    // src đổi (chuyển sang câu khác) — reset thời gian hiển thị, trạng thái playing tự cập nhật lại
    // qua sự kiện "play" khi autoplay của DictationRunner kích hoạt (xem effect [index] ở component cha).
    setCurrentTime(0);
    setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnded = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    if (el.duration) setDuration(el.duration);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef.current?.src]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play().catch(() => {});
  }

  function seek(e) {
    const el = audioRef.current;
    const bar = barRef.current;
    if (!el || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    el.currentTime = ratio * duration;
  }

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="dictation-audio-bar">
      <button type="button" className="dictation-audio-playbtn" onClick={togglePlay} aria-label={playing ? "Tạm dừng" : "Nghe câu này"}>
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <span className="dictation-audio-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
      <div className="dictation-audio-track" ref={barRef} onClick={seek}>
        <div className="dictation-audio-track-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SpeedDropdown({ speed, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dictation-speed-dropdown">
      <button type="button" className="dictation-speed-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        🐢 Tốc độ: {speed}x
      </button>
      {open && (
        <div className="dictation-speed-menu">
          {SPEED_OPTIONS.map(s => (
            <button
              type="button"
              key={s}
              className={`dictation-speed-option${s === speed ? " is-selected" : ""}`}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              {s}x{s === 1 ? " (thường)" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DictationRunner({ sentences, onFinish, studentUid, seriesId, level, testId }) {
  const [index, setIndex] = useState(0);
  // Lưu RIÊNG trạng thái từng câu theo chỉ số (thay vì 1 biến typed/attemptStatus dùng chung) — cho
  // phép bấm mũi tên ←/→ nhảy qua lại xem/sửa câu bất kỳ (giống "← 1/70 →" của trang tham khảo) mà
  // không mất dữ liệu đã gõ ở các câu khác (chốt người dùng 2026-09-08).
  const [answers, setAnswers] = useState(() => sentences.map(blankAnswer));
  const [done, setDone] = useState(false);
  const [viewingTranscript, setViewingTranscript] = useState(false);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  const total = sentences.length;
  const current = sentences[index];
  const { typed, attemptStatus } = answers[index];
  const isLast = index === total - 1;
  const isFirst = index === 0;
  const isDone = attemptStatus === "correct" || attemptStatus === "skipped";
  const doneCount = answers.filter(a => a.attemptStatus === "correct" || a.attemptStatus === "skipped").length;

  function updateAnswer(i, patch) {
    setAnswers(a => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function goTo(i) {
    if (i < 0 || i >= total) return;
    setIndex(i);
  }

  useEffect(() => {
    inputRef.current?.focus();
    // Tự phát audio ngay khi vào câu mới (kể cả câu đầu tiên) — học sinh không cần bấm thêm 1 lần
    // "Nghe câu này" mới nghe được, nút đó chỉ còn dùng để NGHE LẠI. Trình duyệt có thể chặn autoplay
    // ở câu đầu tiên (chưa có tương tác nào) — bắt lỗi im lặng, học sinh vẫn bấm nút được bình thường.
    const el = audioRef.current;
    if (el) {
      el.playbackRate = speed;
      el.currentTime = 0;
      el.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function handleCheck() {
    if (isDone) return;
    const isCorrect = normalize(typed) === normalize(current.text);
    updateAnswer(index, { attemptStatus: isCorrect ? "correct" : "wrong" });
  }

  function handleSkip() {
    if (attemptStatus === "correct") return;
    updateAnswer(index, { attemptStatus: "skipped" });
  }

  // "Câu tiếp theo" chỉ SANG câu kế (không đụng dữ liệu câu khác) — khi đang ở câu CUỐI mới thật sự
  // chốt bài + tính 1 lượt nộp bài, khác trước đây (mỗi lần next mới "commit" 1 kết quả) vì giờ có
  // thể nhảy qua lại tự do nên kết quả cuối cùng phải tính lại từ `answers` lúc chốt bài.
  function handleNext() {
    if (isLast) {
      setDone(true);
      if (studentUid) incrementAttempt({ uid: studentUid, mode: "dictation", testId, seriesId, level });
      return;
    }
    goTo(index + 1);
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (isDone) handleNext();
    else handleCheck();
  }

  const preview = attemptStatus === "wrong" ? maskedPreview(typed, current.text).join(" ") : null;

  if (done && viewingTranscript) {
    return <TranscriptReview sentences={sentences} onBack={() => setViewingTranscript(false)} />;
  }

  if (done) {
    const results = sentences.map((s, i) => {
      const a = answers[i];
      const isCorrect = a.attemptStatus === "correct";
      const finalTyped = a.attemptStatus === "skipped" ? "" : a.typed;
      return { text: s.text, typed: finalTyped, isCorrect, diff: revealDiff(finalTyped, s.text) };
    });
    const correctCount = results.filter(r => r.isCorrect).length;
    return (
      <div className="dictation-report">
        <h2 className="dictation-report-title">Hoàn thành! 🐝</h2>
        <p className="dictation-report-score">
          Đúng <strong>{correctCount}</strong>/{total} câu
        </p>
        <ol className="dictation-report-list">
          {results.map((r, i) => (
            <li key={i} className={`dictation-report-item${r.isCorrect ? " is-correct" : " is-wrong"}`}>
              <span className="dictation-report-icon">{r.isCorrect ? "✓" : "✗"}</span>
              <div className="dictation-report-body">
                <p className="dictation-report-answer">
                  {r.diff.map((w, wi) => (
                    <span key={wi} className={w.ok ? "dictation-word-ok" : "dictation-word-bad"}>
                      {w.word}{" "}
                    </span>
                  ))}
                </p>
                {!r.isCorrect && <p className="dictation-report-typed">Con đã gõ: "{r.typed || "(bỏ trống)"}"</p>}
              </div>
            </li>
          ))}
        </ol>
        <div className="dictation-report-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setViewingTranscript(true)}>
            📜 Xem lại toàn bộ transcript
          </button>
          <button type="button" className="btn btn-primary dictation-report-done" onClick={onFinish}>
            Xong
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dictation-runner">
      <div className="dictation-progress">
        <div className="dictation-progress-bar">
          <div className="dictation-progress-fill" style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
        <div className="dictation-progress-nav">
          <button type="button" className="dictation-nav-btn" onClick={() => goTo(index - 1)} disabled={isFirst} aria-label="Câu trước">
            ←
          </button>
          <span className="dictation-progress-label">Câu {index + 1}/{total}</span>
          <button type="button" className="dictation-nav-btn" onClick={() => goTo(index + 1)} disabled={isLast} aria-label="Câu sau">
            →
          </button>
        </div>
      </div>

      <div className="dictation-card">
        <img src={BEE} alt="" className="dictation-mascot" />
        <p className="dictation-instruction">Nghe rồi gõ lại đúng câu con nghe được nhé!</p>

        <audio ref={audioRef} src={current.audioUrl} preload="auto" />
        <div className="dictation-audio-row">
          <AudioBar audioRef={audioRef} />
          <SpeedDropdown
            speed={speed}
            onChange={s => {
              setSpeed(s);
              if (audioRef.current) audioRef.current.playbackRate = s;
            }}
          />
        </div>

        <input
          ref={inputRef}
          className={`dictation-input${attemptStatus === "correct" ? " is-correct" : attemptStatus === "wrong" ? " is-wrong" : ""}`}
          value={attemptStatus === "skipped" ? current.text : typed}
          onChange={e => updateAnswer(index, { typed: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Gõ câu con nghe được ở đây..."
          disabled={isDone}
          autoComplete="off"
          autoCapitalize="sentences"
        />

        {attemptStatus === "wrong" && (
          <div className="dictation-feedback is-wrong">
            <p className="dictation-feedback-label">⚠️ Chưa đúng — sửa lại rồi bấm Kiểm tra lần nữa nhé!</p>
            <p className="dictation-feedback-masked">{preview}</p>
          </div>
        )}

        {attemptStatus === "correct" && (
          <div className="dictation-feedback is-correct">
            <p className="dictation-feedback-label">Chính xác! 🎉</p>
          </div>
        )}

        {attemptStatus === "skipped" && (
          <div className="dictation-feedback is-wrong">
            <p className="dictation-feedback-label">Câu đúng là:</p>
            <p className="dictation-feedback-answer">{current.text}</p>
          </div>
        )}

        <div className="dictation-actions">
          {isDone ? (
            <button type="button" className="btn btn-primary" onClick={handleNext}>
              {isLast ? "Xem kết quả" : "Câu tiếp theo"}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={handleCheck}>
                {attemptStatus === "wrong" ? "Kiểm tra lại" : "Kiểm tra"}
              </button>
              <button type="button" className="dictation-skip-btn" onClick={handleSkip}>Bỏ qua</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
