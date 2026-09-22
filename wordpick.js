// ---------- Google Cloud Vision (1순위, 선택 사항이지만 가장 정확함) ----------
// 조직 보안 정책상 브라우저에 API 키를 직접 둘 수 없어서, Google Vision을 대신
// 호출해주는 작은 프록시 서버(Cloudflare Worker)를 거쳐요. 인증 정보(서비스 계정
// 키)는 그 Worker 안에만 있고 이 브라우저 코드에는 전혀 노출되지 않습니다.
// 설정 방법은 cloudflare-worker/README.md를 참고하세요. Worker를 배포한 뒤
// 아래에 그 URL을 채워 넣어주세요(예: "https://leap-vision-proxy.내이름.workers.dev").
// 비워두면 이 단계는 건너뛰고 TensorFlow.js(+Imagga)만으로 동작합니다.
const VISION_PROXY_URL = "";

// ---------- Imagga (3순위, 선택 사항) ----------
// 무료로 가입하면 API Key/Secret을 받을 수 있어요: https://imagga.com/
// 아래 두 값을 채우면 다른 결과에 Imagga 태그가 추가로 합쳐집니다.
// 비워두면 건너뜁니다 (기능상 문제 없음).
const IMAGGA_API_KEY = "";
const IMAGGA_API_SECRET = "";

const photo = document.getElementById("kwPhoto");
const kwVideo = document.getElementById("kwVideo");
const scanning = document.getElementById("kwScanning");
const scanningText = document.getElementById("kwScanningText");
const chipsWrap = document.getElementById("kwChips");
const btnBack = document.getElementById("btnBack");
const btnMic = document.getElementById("btnMic");
const voiceHint = document.getElementById("kwVoiceHint");
const input = document.getElementById("kwInput");
const btnSend = document.getElementById("btnSend");

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

const capturedMediaType = sessionStorage.getItem("leaf:capturedMediaType") || "image";
// 온보딩에서 고른 학습 언어. 저장된 값이 없으면(과거 사용자 등) 영어로 기본 동작해요.
const targetLang = localStorage.getItem("leaf:userLang") || "en";

function loadCapturedPhoto() {
  const saved = sessionStorage.getItem("leaf:capturedPhoto");
  if (!saved) return;
  if (capturedMediaType === "video") {
    kwVideo.src = saved;
    kwVideo.hidden = false;
    kwVideo.play().catch(() => {});
    photo.hidden = true;
  } else {
    photo.src = saved;
  }
}

/* ---------- Translation helpers (same MyMemory API used for comment translation) ---------- */
async function translateText(text, from, to) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
    );
    const data = await res.json();
    return data.responseData.translatedText || text;
  } catch (e) {
    return text;
  }
}

const translateEnToKo = (text) => translateText(text, "en", "ko");
const translateKoToEn = (text) => translateText(text, "ko", "en");

/* ---------- 1순위: TensorFlow.js (브라우저에서 직접 실행, 키 불필요) ---------- */
let cocoModel = null;
let mobilenetModel = null;

async function loadModels() {
  if (cocoModel && mobilenetModel) return;
  const [coco, mobile] = await Promise.all([
    window.cocoSsd.load(),
    window.mobilenet.load(),
  ]);
  cocoModel = coco;
  mobilenetModel = mobile;
}

async function detectWithTensorFlow(imgEl) {
  await loadModels();
  const candidates = [];

  const detections = await cocoModel.detect(imgEl);
  detections.forEach((d) => candidates.push({ label: d.class, score: d.score }));

  const classifications = await mobilenetModel.classify(imgEl);
  classifications.forEach((c) => {
    // mobilenet class names can look like "Granny Smith, apple" — use the first term
    const label = c.className.split(",")[0].trim();
    candidates.push({ label, score: c.probability });
  });

  return candidates;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ---------- 1순위: Google Cloud Vision (선택 사항, 프록시 URL이 있을 때만 동작) ----------
   Vision을 직접 부르지 않고, 인증 정보를 안전하게 들고 있는 Cloudflare Worker
   프록시(cloudflare-worker/vision-proxy.js)에 사진(base64)만 보내요. */
async function detectWithGoogleVision(dataUrl) {
  if (!VISION_PROXY_URL) return [];
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const base64 = await blobToBase64(blob);
    const res = await fetch(VISION_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
    });
    if (!res.ok) throw new Error("Vision proxy request failed");
    const data = await res.json();
    if (data.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
    const response = data.responses && data.responses[0];
    if (response && response.error) throw new Error(response.error.message || "Google Vision error");
    const annotations = (response && response.labelAnnotations) || [];
    return annotations
      .filter((a) => a.score > 0.5)
      .map((a) => ({ label: a.description, score: a.score }));
  } catch (e) {
    console.warn("Google Vision skipped:", e);
    return [];
  }
}

/* ---------- 2순위: Imagga (선택 사항, 키가 있을 때만 동작) ---------- */
async function detectWithImagga(dataUrl) {
  if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) return [];
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append("image", blob, "photo.jpg");
    const auth = btoa(`${IMAGGA_API_KEY}:${IMAGGA_API_SECRET}`);

    const res = await fetch("https://api.imagga.com/v2/tags", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form,
    });
    if (!res.ok) throw new Error("Imagga request failed");
    const data = await res.json();
    const tags = (data.result && data.result.tags) || [];
    return tags
      .filter((t) => t.confidence > 30)
      .slice(0, 5)
      .map((t) => ({ label: t.tag.en, score: t.confidence / 100 }));
  } catch (e) {
    console.warn("Imagga skipped:", e);
    return [];
  }
}

function mergeCandidates(lists) {
  const bestByLabel = new Map();
  lists.flat().forEach(({ label, score }) => {
    const key = label.toLowerCase();
    const existing = bestByLabel.get(key);
    if (!existing || existing.score < score) {
      bestByLabel.set(key, { label, score });
    }
  });
  return [...bestByLabel.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function recognizeImage(imgEl) {
  // 세 소스를 동시에 요청해서(키가 없는 소스는 즉시 빈 배열을 반환) 기다리는
  // 시간을 줄여요. Google Vision이 켜져 있으면 보통 가장 정확해서 우선순위를
  // 앞에 두지만, mergeCandidates가 라벨별 최고 점수를 골라주니 순서 자체는
  // 결과에 영향이 없어요.
  const [visionResults, tfResults, imaggaResults] = await Promise.all([
    detectWithGoogleVision(imgEl.src),
    detectWithTensorFlow(imgEl).catch((e) => {
      console.warn("TensorFlow.js recognition failed:", e);
      return [];
    }),
    detectWithImagga(imgEl.src),
  ]);

  return mergeCandidates([visionResults, tfResults, imaggaResults]);
}

/* ---------- Chips ---------- */
function selectChip(chipEl) {
  chipsWrap.querySelectorAll(".kw-chip").forEach((c) => c.classList.remove("is-selected"));
  chipEl.classList.add("is-selected");
  // 칩을 고른 것만으로는 넘어가지 않아요 — 우측 하단 "다음"(비행기) 버튼을 눌러야
  // 사전 화면으로 이동합니다.
}

function goToDictionary(chipEl) {
  const word = chipEl.textContent;
  const englishWord = chipEl.dataset.en || "";
  sessionStorage.setItem("leaf:selectedWord", word);
  if (englishWord) sessionStorage.setItem("leaf:selectedWordEn", englishWord);
  sessionStorage.setItem("leaf:selectedWordLang", targetLang);
  window.location.href = "dictionary.html";
}

function addChip(word, autoSelect, englishWord) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "kw-chip";
  chip.textContent = word;
  if (englishWord) chip.dataset.en = englishWord;
  chip.addEventListener("click", () => selectChip(chip));
  chipsWrap.appendChild(chip);
  if (autoSelect) selectChip(chip);
  return chip;
}

function showChips() {
  scanning.hidden = true;
  chipsWrap.hidden = false;
}

const FALLBACK_KEYWORDS = ["사과", "바구니", "과일", "빨간색", "원"];

async function analyzeAndShowKeywords() {
  if (capturedMediaType === "video") {
    showChips();
    showToast("동영상은 자동 인식이 아직 지원되지 않아요. 직접 입력해 주세요!");
    return;
  }

  try {
    if (!photo.complete) {
      await new Promise((resolve) => photo.addEventListener("load", resolve, { once: true }));
    }

    scanningText.textContent = "AI 모델을 불러오는 중이에요...";
    const results = await recognizeImage(photo);

    if (results.length === 0) {
      showChips();
      showToast("사진을 자동으로 인식하지 못했어요. 직접 입력해 주세요!");
      return;
    }

    scanningText.textContent = "인식된 단어를 번역하는 중이에요...";
    for (const r of results) {
      const ko = await translateEnToKo(r.label);
      // 학습 언어가 영어가 아니면, 인식된 영어 라벨을 그 언어 단어로 한 번 더 번역해요.
      const targetWord = targetLang === "en" ? r.label : await translateConceptWord(r.label, targetLang);
      addChip(ko, false, targetWord);
    }
    showChips();
  } catch (e) {
    console.warn("Image recognition failed, falling back:", e);
    for (const word of FALLBACK_KEYWORDS) {
      const targetWord = await translateText(word, "ko", targetLang);
      addChip(word, false, targetWord || undefined);
    }
    showChips();
  }
}

async function submitCustomWord(word) {
  const trimmed = word.trim();
  if (!trimmed) return;
  if (chipsWrap.hidden) showChips();
  const targetWord =
    targetLang === "en" ? await translateKoToEn(trimmed) : await translateText(trimmed, "ko", targetLang);
  addChip(trimmed, true, targetWord);
  input.value = "";
}

btnBack.addEventListener("click", () => {
  window.history.back();
});

// 우측 하단 "다음"(비행기) 버튼 — 입력창에 직접 입력해뒀다면 먼저 그 단어를 칩으로
// 만들어 선택하고, 이미 선택된 칩이 있으면(추천 칩을 눌렀거나 방금 직접 입력했거나)
// 사전 화면으로 넘어가요.
async function confirmSelection() {
  const typed = input.value.trim();
  if (typed) {
    await submitCustomWord(typed);
  }
  const selected = chipsWrap.querySelector(".kw-chip.is-selected");
  if (selected) {
    goToDictionary(selected);
  } else {
    showToast("먼저 단어를 선택하거나 입력해 주세요");
  }
}

btnSend.addEventListener("click", confirmSelection);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") confirmSelection();
});

let recognition = null;
let listening = false;

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btnMic.addEventListener("click", () => {
      showToast("이 브라우저는 음성 인식을 지원하지 않아요");
    });
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    listening = true;
    btnMic.classList.add("is-listening");
    voiceHint.textContent = "듣고 있어요...";
  });

  recognition.addEventListener("result", (e) => {
    const transcript = e.results[0][0].transcript;
    submitCustomWord(transcript);
  });

  recognition.addEventListener("error", () => {
    showToast("음성을 인식하지 못했어요. 다시 시도해 주세요");
  });

  recognition.addEventListener("end", () => {
    listening = false;
    btnMic.classList.remove("is-listening");
    voiceHint.textContent = "더 도움이 필요하다면, 직접 이야기해 주세요!";
  });

  btnMic.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

loadCapturedPhoto();
setupSpeechRecognition();
analyzeAndShowKeywords();
