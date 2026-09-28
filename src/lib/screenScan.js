// "Quét màn hình" (CMS Luyện đề Listening, chỉ admin): chia sẻ cửa sổ đang mở PDF sách qua
// getDisplayMedia (trình duyệt bắt buộc hỏi chọn cửa sổ ở lần đầu), mỗi lần quét chụp 1 khung hình
// hiện tại để giáo viên tự kéo khung cắt từng tranh (components/dashboard/ScreenCropOverlay.jsx).
// Luồng chia sẻ được giữ lại giữa các lần quét — cuộn PDF sang trang sau rồi quét tiếp, không phải chọn lại.

export function isScreenScanSupported() {
  return !!navigator.mediaDevices?.getDisplayMedia;
}

export function createScreenScanner() {
  let stream = null;
  let video = null;

  async function ensureStream() {
    if (stream && stream.getVideoTracks().some(t => t.readyState === "live")) return;
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "window", width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 5 } },
      audio: false,
      selfBrowserSurface: "exclude",
    });
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    if (!video.videoWidth) await new Promise(res => video.addEventListener("loadeddata", res, { once: true }));
  }

  // Chờ 1 khung hình mới để chắc chắn lấy đúng nội dung đang hiện (sau khi vừa cuộn PDF).
  function waitFreshFrame() {
    return new Promise(res => {
      if (video.requestVideoFrameCallback) {
        const timer = setTimeout(res, 400);
        video.requestVideoFrameCallback(() => { clearTimeout(timer); res(); });
      } else setTimeout(res, 200);
    });
  }

  return {
    // Trả về canvas chứa khung hình hiện tại của cửa sổ đang chia sẻ (độ phân giải đầy đủ).
    async grab() {
      await ensureStream();
      await waitFreshFrame();
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      return canvas;
    },
    stop() {
      stream?.getTracks().forEach(t => t.stop());
      stream = null;
      video = null;
    },
  };
}

export function cropCanvasToFile(canvas, { x, y, w, h }, name) {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return new Promise((res, rej) =>
    out.toBlob(b => (b ? res(new File([b], name, { type: "image/png" })) : rej(new Error("Không cắt được ảnh."))), "image/png"),
  );
}
