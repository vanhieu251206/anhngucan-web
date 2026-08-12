import { useEffect, useState } from "react";
import { loadTranscriber, isRecordingSupported } from "../lib/whisperSpeech.js";

export default function ModelPreloader() {
  const [status, setStatus] = useState("loading"); // loading | done | unsupported | error
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (!isRecordingSupported()) {
      setStatus("unsupported");
      return;
    }
    loadTranscriber(progress => {
      if (progress?.status === "progress") {
        setPercent(Math.round(progress.progress || 0));
      }
    })
      .then(() => setStatus("done"))
      .catch(() => setStatus("error"));
  }, []);

  if (status !== "loading") return null;

  return (
    <div className="model-preload-card" role="status">
      <span className="model-preload-spinner" aria-hidden="true" />
      <div>
        <div className="model-preload-title">Đang chuẩn bị phần luyện nói...</div>
        <div className="model-preload-sub">{percent > 0 ? `${percent}%` : "Đang tải..."}</div>
      </div>
    </div>
  );
}
