export default function ListeningMode({ listening }) {
  return (
    <div className="listening-box">
      <div className="video-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${listening.videoId}`}
          title={listening.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <p className="listening-title">{listening.title}</p>
    </div>
  );
}
