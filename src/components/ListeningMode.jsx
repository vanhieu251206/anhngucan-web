function extractDriveFileId(raw) {
  if (!raw) return "";
  const match = raw.match(/[-\w]{25,}/);
  return match ? match[0] : raw.trim();
}

// Tiêu đề khoá cứng dạng "Starters 1 - Test 2 - Part 3 & 4" (xem CreateLessonPage.jsx) — tách ra
// nhãn nhóm "Test 2" + phần còn lại "Part 3 & 4" để gom video theo Test, hiện gọn hơn khi cuộn.
// Tiêu đề tự do (series chưa khoá cứng) không khớp mẫu này thì giữ nguyên, không gom nhóm.
function parseFixedTitle(title) {
  const match = /^(.*) - (Test \d+) - (.*)$/.exec(title ?? "");
  return match ? { testLabel: match[2], partLabel: match[3] } : null;
}

function VideoCard({ v, label }) {
  const fileId = extractDriveFileId(v.videoId);
  return (
    <div className="listening-item">
      {fileId ? (
        <div className="video-frame">
          <a
            className="video-frame-link"
            href={`https://drive.google.com/file/d/${fileId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="video-frame-play">▶</span>
            <span className="video-frame-hint">Bấm để mở video</span>
          </a>
        </div>
      ) : (
        <div className="video-frame video-frame-empty">
          <span className="video-frame-empty-text">Chưa có video</span>
        </div>
      )}
      <p className="listening-title">{label ?? v.title}</p>
    </div>
  );
}

// listening luôn là mảng { videoId, title }[] — hỗ trợ nhiều video/bài nghe trong 1 cấp độ
// (backward-compat với dữ liệu cũ dạng object đơn được chuẩn hoá thành mảng ở lib/lessons.js).
export default function ListeningMode({ listening }) {
  const videos = Array.isArray(listening) ? listening : [listening];

  const groups = [];
  let ungrouped = [];
  for (const v of videos) {
    const parsed = parseFixedTitle(v.title);
    if (!parsed) {
      ungrouped.push(v);
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && last.testLabel === parsed.testLabel) {
      last.items.push({ v, partLabel: parsed.partLabel });
    } else {
      groups.push({ testLabel: parsed.testLabel, items: [{ v, partLabel: parsed.partLabel }] });
    }
  }

  if (groups.length === 0) {
    return (
      <div className="listening-box listening-box-multi">
        {ungrouped.map((v, i) => <VideoCard v={v} key={i} />)}
      </div>
    );
  }

  return (
    <div className="listening-box">
      {groups.map((g, gi) => (
        <div className="listening-test-group" key={gi}>
          <h3 className="listening-test-heading">{g.testLabel}</h3>
          <div className="listening-box-multi">
            {g.items.map(({ v, partLabel }, i) => (
              <VideoCard v={v} label={partLabel} key={i} />
            ))}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="listening-box-multi">
          {ungrouped.map((v, i) => <VideoCard v={v} key={i} />)}
        </div>
      )}
    </div>
  );
}
