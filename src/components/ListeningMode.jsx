function extractDriveFileId(raw) {
  if (!raw) return "";
  const match = raw.match(/[-\w]{25,}/);
  return match ? match[0] : raw.trim();
}

export default function ListeningMode({ listening }) {
  const fileId = extractDriveFileId(listening.videoId);
  return (
    <div className="listening-box">
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
      <p className="listening-title">{listening.title}</p>
    </div>
  );
}
