import { describeSubmitError } from "../lib/testSubmit.js";

// Màn chờ/lỗi khi nộp bài qua máy chủ (lib/testSubmit.js) — dùng chung cho các trang làm bài. Lỗi thì bài làm vẫn
// giữ nguyên, học sinh bấm "Nộp lại".
export default function SubmitStatus({ error, onRetry }) {
  return (
    <div className="submit-status">
      {error ? (
        <>
          <p className="submit-status-error">{describeSubmitError(error)}</p>
          {onRetry && (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Nộp lại
            </button>
          )}
        </>
      ) : (
        <p className="submit-status-wait">Đang nộp bài...</p>
      )}
    </div>
  );
}
