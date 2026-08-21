function extractDriveFileId(raw) {
  if (!raw) return "";
  const match = raw.match(/[-\w]{25,}/);
  return match ? match[0] : raw.trim();
}

// listening luôn là mảng { videoId, title }[] — hỗ trợ nhiều video/bài nghe trong 1 cấp độ
// (backward-compat với dữ liệu cũ dạng object đơn được chuẩn hoá thành mảng ở lib/lessons.js).
export default function ListeningMode({ listening }) {
  const videos = Array.isArray(listening) ? listening : [listening];

  return (
    <div className="listening-box listening-box-multi">
      {videos.map((v, i) => {
        const fileId = extractDriveFileId(v.videoId);
        return (
          <div className="listening-item" key={i}>
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
            <p className="listening-title">{v.title}</p>
          </div>
        );
      })}
    </div>
  );
}
