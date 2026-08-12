export function speak(text) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  window.speechSynthesis.speak(utter);
}

export function normalize(str) {
  return str.toLowerCase().replace(/[.,!?]/g, "").trim();
}
