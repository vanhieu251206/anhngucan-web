export function speak(text, { onEnd } = {}) {
  if (!onEnd) {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.85;
    window.speechSynthesis.speak(utter);
    return;
  }

  // Dùng timeout dự phòng: onend của SpeechSynthesis không phải lúc nào cũng bắn
  // (đặc biệt trên một số trình duyệt/thiết bị) — không để luồng bị treo vĩnh viễn.
  let done = false;
  function finish() {
    if (done) return;
    done = true;
    onEnd();
  }

  if (!window.speechSynthesis) {
    finish();
    return;
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.85;
  utter.onend = finish;
  utter.onerror = finish;
  window.speechSynthesis.speak(utter);

  const estimatedMs = Math.max(800, text.length * 90);
  setTimeout(finish, estimatedMs + 1500);
}

export function normalize(str) {
  return str.toLowerCase().replace(/[.,!?]/g, "").trim();
}
