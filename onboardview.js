const stepSplash = document.getElementById("stepSplash");
const stepIntro = document.getElementById("stepIntro");
const stepName = document.getElementById("stepName");
const stepLang = document.getElementById("stepLang");
const nameInput = document.getElementById("nameInput");
const btnMic = document.getElementById("btnMic");
const obVoiceHint = document.getElementById("obVoiceHint");
const btnNameNext = document.getElementById("btnNameNext");

const langInput = document.getElementById("langInput");
const langDropdown = document.getElementById("langDropdown");
const btnLangNext = document.getElementById("btnLangNext");
const obGreeting = document.getElementById("obGreeting");
const btnLangBack = document.getElementById("btnLangBack");

const LANGUAGES = [
  { code: "ko", label: "한국어", aliases: ["한국어", "korean", "한국말"] },
  { code: "en", label: "English", aliases: ["english", "영어"] },
  { code: "ja", label: "日本語", aliases: ["일본어", "japanese", "日本語", "니홍고"] },
  { code: "es", label: "Español", aliases: ["스페인어", "spanish", "español", "espanol"] },
  { code: "fr", label: "Français", aliases: ["프랑스어", "french", "français", "francais"] },
  { code: "zh", label: "中文", aliases: ["중국어", "chinese", "中文", "중문"] },
];

function goToIntro() {
  stepSplash.hidden = true;
  stepIntro.hidden = false;

  const lines = [...document.querySelectorAll(".ob-line")];
  lines.forEach((line, i) => {
    setTimeout(() => line.classList.add("is-visible"), i * 900);
  });

  const totalDelay = lines.length * 900 + 1400;
  setTimeout(goToName, totalDelay);
}

function goToName() {
  stepIntro.hidden = true;
  stepName.hidden = false;
  nameInput.focus();
}

function submitName() {
  const name = nameInput.value.trim();
  if (!name) return;
  try {
    localStorage.setItem("leaf:userName", name);
  } catch (e) {
    /* storage unavailable */
  }
  goToLang(name);
}

function goToLang(name) {
  stepName.hidden = true;
  stepLang.hidden = false;
  obGreeting.textContent = `안녕하세요 ${name}님!`;
  renderLangOptions();
}

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitName();
});

// 우측 하단 "다음"(비행기) 버튼 — 이름을 입력한 것만으로는 넘어가지 않고, 이 버튼을
// 눌러야(또는 Enter를 쳐야) 다음 화면으로 이동해요.
btnNameNext.addEventListener("click", submitName);

// 좌측 상단 뒤로가기 — 언어 선택 화면에서 이름 입력 화면으로 돌아가요. 입력해둔
// 이름은 그대로 남아있어요.
btnLangBack.addEventListener("click", () => {
  stepLang.hidden = true;
  stepName.hidden = false;
  nameInput.focus();
});

function renderLangOptions() {
  langDropdown.innerHTML = "";
  LANGUAGES.forEach((lang) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ob-lang-option";
    btn.textContent = lang.label;
    if (langInput.dataset.code === lang.code) btn.classList.add("is-current");
    btn.addEventListener("click", () => selectLanguage(lang));
    li.appendChild(btn);
    langDropdown.appendChild(li);
  });
}

function selectLanguage(lang) {
  langInput.value = lang.label;
  langInput.dataset.code = lang.code;
  langInput.classList.add("is-selected");
  langDropdown.hidden = true;
  try {
    localStorage.setItem("leaf:userLang", lang.code);
  } catch (e) {
    /* storage unavailable */
  }
  // 언어를 고른 것만으로는 넘어가지 않아요 — 우측 하단 "다음"(비행기) 버튼을
  // 눌러야 홈 화면으로 이동합니다.
}

function finishOnboarding() {
  window.location.href = "index.html";
}

langInput.addEventListener("click", () => {
  renderLangOptions();
  langDropdown.hidden = !langDropdown.hidden;
});

document.addEventListener("click", (e) => {
  if (!langDropdown.hidden && !e.target.closest(".ob-lang-input-wrap")) {
    langDropdown.hidden = true;
  }
});

// 우측 하단 "다음"(비행기) 버튼 — 드롭다운에서 언어를 선택해야만 넘어갈 수 있어요.
btnLangNext.addEventListener("click", () => {
  if (langInput.dataset.code) {
    finishOnboarding();
  }
});

function setupMic(button, hintEl, onResult) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    button.addEventListener("click", () => {
      hintEl.textContent = "이 브라우저는 음성 인식을 지원하지 않아요";
    });
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let listening = false;
  const defaultHint = hintEl.textContent;

  recognition.addEventListener("start", () => {
    listening = true;
    button.classList.add("is-listening");
    hintEl.textContent = "듣고 있어요...";
  });

  recognition.addEventListener("result", (e) => {
    onResult(e.results[0][0].transcript);
  });

  recognition.addEventListener("error", () => {
    hintEl.textContent = "음성을 인식하지 못했어요. 다시 시도해 주세요";
  });

  recognition.addEventListener("end", () => {
    listening = false;
    button.classList.remove("is-listening");
    hintEl.textContent = defaultHint;
  });

  button.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

setupMic(btnMic, obVoiceHint, (transcript) => {
  nameInput.value = transcript;
});

requestAnimationFrame(() => {
  stepSplash.classList.add("is-visible");
});
setTimeout(goToIntro, 2200);
