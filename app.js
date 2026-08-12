const state = { lessons: [], currentLesson: null };

const loadingScreen = document.getElementById("loading");
const errorScreen = document.getElementById("load-error");
const lessonMenu = document.getElementById("lesson-menu");
const modeMenu = document.getElementById("menu");
const modes = document.querySelectorAll(".mode");

document.querySelectorAll(".menu-card").forEach(btn => {
  btn.addEventListener("click", () => showMode(btn.dataset.mode));
});
document.querySelectorAll(".back-btn").forEach(btn => {
  btn.addEventListener("click", showModeMenu);
});
document.getElementById("back-to-lessons").addEventListener("click", showLessonMenu);

init();

async function init() {
  try {
    state.lessons = await loadAllLessons();
    loadingScreen.classList.add("hidden");
    renderLessonMenu();
    showLessonMenu();
  } catch (err) {
    loadingScreen.classList.add("hidden");
    errorScreen.classList.remove("hidden");
    errorScreen.querySelector(".error-detail").textContent = err.message;
  }
}

// ---------- Màn hình chọn bài học ----------
function renderLessonMenu() {
  lessonMenu.innerHTML = "<h2>Chọn bài học</h2>";
  const list = document.createElement("div");
  list.className = "menu-cards";
  state.lessons.forEach(lesson => {
    const btn = document.createElement("button");
    btn.className = "menu-card";
    btn.textContent = lesson.title;
    btn.addEventListener("click", () => {
      state.currentLesson = lesson;
      showModeMenu();
    });
    list.appendChild(btn);
  });
  lessonMenu.appendChild(list);
}

function showLessonMenu() {
  lessonMenu.classList.remove("hidden");
  modeMenu.classList.add("hidden");
  modes.forEach(m => m.classList.add("hidden"));
}

function showModeMenu() {
  lessonMenu.classList.add("hidden");
  modeMenu.classList.remove("hidden");
  modes.forEach(m => m.classList.add("hidden"));
}

function showMode(mode) {
  modeMenu.classList.add("hidden");
  modes.forEach(m => m.classList.add("hidden"));
  const section = document.getElementById(mode + "-mode");
  section.classList.remove("hidden");
  if (mode === "vocab") renderVocab();
  if (mode === "dragdrop") renderDragDrop();
  if (mode === "speaking") renderSpeaking();
}

// ---------- Thẻ từ vựng ----------
function renderVocab() {
  const container = document.getElementById("vocab-cards");
  container.innerHTML = "";
  state.currentLesson.vocab.forEach(v => {
    const card = document.createElement("div");
    card.className = "vocab-card";
    card.innerHTML = `
      <img src="${v.image}" alt="${v.word}" onerror="this.style.display='none'">
      <div class="word">${v.word}</div>
      <div class="meaning">${v.meaning}</div>
    `;
    card.addEventListener("click", () => {
      card.classList.toggle("flipped");
      speak(v.word);
    });
    container.appendChild(card);
  });
}

// ---------- Kéo thả ----------
function renderDragDrop() {
  const items = document.getElementById("dragdrop-items");
  const targets = document.getElementById("dragdrop-targets");
  const result = document.getElementById("dragdrop-result");
  items.innerHTML = "";
  targets.innerHTML = "";
  result.textContent = "";

  const data = state.currentLesson.dragdrop;
  const shuffledItems = [...data].sort(() => Math.random() - 0.5);
  const shuffledTargets = [...data].sort(() => Math.random() - 0.5);

  shuffledItems.forEach(d => {
    const el = document.createElement("div");
    el.className = "drag-item";
    el.draggable = true;
    el.dataset.item = d.item;
    el.innerHTML = `<img src="${d.image}" onerror="this.style.display='none'"><span>${d.item}</span>`;
    el.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", d.item);
    });
    items.appendChild(el);
  });

  shuffledTargets.forEach(d => {
    const el = document.createElement("div");
    el.className = "drop-target";
    el.dataset.target = d.target;
    el.innerHTML = `<span>${d.target}</span>`;
    el.addEventListener("dragover", e => e.preventDefault());
    el.addEventListener("drop", e => {
      e.preventDefault();
      const dragged = e.dataTransfer.getData("text/plain");
      if (el.classList.contains("filled")) return;
      if (dragged === el.dataset.target) {
        const matched = data.find(x => x.item === dragged);
        el.classList.add("correct", "filled");
        el.innerHTML = `<img src="${matched.image}" onerror="this.style.display='none'"><span>${dragged}</span>`;
        checkDragDropDone();
      } else {
        result.textContent = `Sai rồi, thử lại nhé!`;
        result.className = "result-bad";
      }
    });
    targets.appendChild(el);
  });
}

function checkDragDropDone() {
  const targets = document.querySelectorAll(".drop-target");
  const done = [...targets].every(t => t.classList.contains("filled"));
  const result = document.getElementById("dragdrop-result");
  if (done) {
    result.textContent = "🎉 Hoàn thành! Giỏi quá!";
    result.className = "result-ok";
  }
}

// ---------- Luyện nói (dạng hội thoại tuần tự, giống thi thật) ----------
const GREETING = {
  image: "",
  question: "Hello! What's your name?",
  answer_keywords: ""
};

function renderSpeaking() {
  const box = document.getElementById("speaking-box");
  state.speakingQueue = [GREETING, ...state.currentLesson.speaking];
  state.speakingIndex = 0;
  renderSpeakingStep(box);
}

function renderSpeakingStep(box) {
  const step = state.speakingQueue[state.speakingIndex];
  const isLast = state.speakingIndex === state.speakingQueue.length - 1;

  box.innerHTML = `
    <div class="sentence-box">
      <div class="speaking-progress">Câu ${state.speakingIndex + 1} / ${state.speakingQueue.length}</div>
      ${step.image ? `<img class="speaking-img" src="${step.image}" onerror="this.style.display='none'">` : ""}
      <div class="sentence-text">${step.question}</div>
      <button class="mic-btn" title="Bấm giữ để nói">🎤</button>
      <div class="heard-text"></div>
      <div class="speak-result"></div>
      <button class="next-btn hidden">${isLast ? "Hoàn thành ✅" : "Câu tiếp theo ➡"}</button>
    </div>
  `;

  const micBtn = box.querySelector(".mic-btn");
  const heard = box.querySelector(".heard-text");
  const resultEl = box.querySelector(".speak-result");
  const nextBtn = box.querySelector(".next-btn");

  speak(step.question);

  const startHold = e => {
    e.preventDefault();
    startSpeechCheck(step.answer_keywords, heard, resultEl, micBtn, nextBtn);
  };
  const stopHold = e => {
    e.preventDefault();
    stopSpeechCheck();
  };
  micBtn.addEventListener("mousedown", startHold);
  micBtn.addEventListener("touchstart", startHold, { passive: false });
  micBtn.addEventListener("mouseup", stopHold);
  micBtn.addEventListener("mouseleave", stopHold);
  micBtn.addEventListener("touchend", stopHold);

  nextBtn.addEventListener("click", () => {
    if (isLast) {
      showModeMenu();
      return;
    }
    state.speakingIndex++;
    renderSpeakingStep(box);
  });
}

function normalize(str) {
  return str.toLowerCase().replace(/[.,!?]/g, "").trim();
}

let activeRecognition = null;

function startSpeechCheck(answerKeywords, heardEl, resultEl, micBtn, nextBtn) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    resultEl.textContent = "Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome.";
    resultEl.className = "result-bad";
    return;
  }
  if (activeRecognition) return;

  const recognition = new SpeechRecognition();
  activeRecognition = recognition;
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micBtn.classList.add("recording");
  resultEl.textContent = "";
  heardEl.textContent = "";

  recognition.start();

  recognition.onresult = (event) => {
    const said = event.results[0][0].transcript;
    heardEl.textContent = `Bạn nói: "${said}"`;

    const keywords = answerKeywords
      ? answerKeywords.split(",").map(k => normalize(k)).filter(Boolean)
      : [];

    if (keywords.length === 0) {
      resultEl.textContent = "👍 Cảm ơn bạn đã trả lời!";
      resultEl.className = "result-ok";
    } else {
      const saidNorm = normalize(said);
      const ok = keywords.some(k => saidNorm.includes(k));
      if (ok) {
        resultEl.textContent = "✅ Đúng rồi, giỏi quá!";
        resultEl.className = "result-ok";
      } else {
        resultEl.textContent = "❌ Chưa đúng, thử lại nhé!";
        resultEl.className = "result-bad";
      }
    }
    nextBtn.classList.remove("hidden");
  };

  recognition.onerror = (event) => {
    resultEl.textContent = "Không nghe rõ, hãy thử lại (" + event.error + ")";
    resultEl.className = "result-bad";
  };

  recognition.onend = () => {
    micBtn.classList.remove("recording");
    activeRecognition = null;
  };
}

function stopSpeechCheck() {
  if (activeRecognition) activeRecognition.stop();
}

function speak(text) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  window.speechSynthesis.speak(utter);
}
