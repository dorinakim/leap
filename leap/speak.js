// 영어 단어 발음 재생 — 브라우저 기본 음성 중 장난스러운(노벨티) 목소리를 피하고
// 사전 앱에서 흔히 들리는 차분하고 자연스러운 목소리를 우선 선택합니다.
// 학습 언어(en/ja/es/fr/zh)에 따라 그 언어의 음성 중에서 골라요.

// macOS/iOS 등에 기본 내장된 "재미용" 음성들 — 절대 고르지 않도록 제외
const NOVELTY_VOICE_NAMES = [
  "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "wobble",
  "hysterical", "zarvox", "trinoids", "whisper", "deranged", "pipe organ",
  "albert", "fred", "junior", "kathy", "ralph", "organ", "jester",
  "good news", "superstar", "bahh", "eddy", "flo", "grandma", "grandpa",
  "reed", "rocko", "sandy", "shelley",
];

// 실제 사전 앱에서 흔히 쓰이는, 차분하고 또렷한 음성들 — 언어별 우선순위 순
const PREFERRED_VOICE_NAMES_BY_LANG = {
  en: [
    "google us english", "samantha", "daniel", "moira", "karen", "tessa",
    "alex", "victoria", "microsoft aria", "microsoft guy",
  ],
  ja: ["google 日本語", "kyoko", "o-ren", "microsoft nanami", "microsoft keita"],
  es: ["google español", "monica", "paulina", "microsoft alvaro", "microsoft elvira"],
  fr: ["google français", "thomas", "amelie", "microsoft henri", "microsoft denise"],
  zh: ["google 普通话", "ting-ting", "tingting", "microsoft yunxi", "microsoft xiaoxiao"],
};

const cachedVoices = {};

// 브라우저가 켜진 뒤 이 기기의 OS 음성 서비스를 처음 쓸 때는 목록을 채우는 데
// 시간이 좀 걸려요(수백ms~몇 초). 페이지가 로드되자마자(사용자가 재생 버튼을 누르기
// 한참 전에) 미리 한번 불러 둬서, 실제로 필요할 때는 이미 준비돼 있도록 합니다.
if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
}

function getVoicesAsync() {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return; // 아직 안 채워졌으면 계속 기다려요.
      settled = true;
      clearInterval(poll);
      resolve(voices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    // 일부 브라우저/OS는 voiceschanged가 늦게 뜨거나 아예 안 뜰 수 있어서,
    // 짧은 간격으로 직접 확인도 같이 해요(처음 켰을 때 음성 서비스가 준비되는
    // 데 몇 초 걸릴 수 있으므로 타임아웃을 넉넉히 잡습니다).
    const poll = setInterval(finish, 150);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      resolve(window.speechSynthesis.getVoices());
    }, 4000);
  });
}

async function pickCalmVoice(langPrefix) {
  const prefix = (langPrefix || "en").toLowerCase();
  if (cachedVoices[prefix]) return cachedVoices[prefix];

  const voices = await getVoicesAsync();
  const matching = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
  const candidates = matching.filter(
    (v) => !NOVELTY_VOICE_NAMES.some((bad) => v.name.toLowerCase().includes(bad))
  );

  const preferredNames = PREFERRED_VOICE_NAMES_BY_LANG[prefix] || [];
  for (const preferred of preferredNames) {
    const match = candidates.find((v) => v.name.toLowerCase().includes(preferred));
    if (match) {
      cachedVoices[prefix] = match;
      return cachedVoices[prefix];
    }
  }

  // 선호 목록에 없으면, 노벨티만 아니면 되니 그 언어의 첫 번째 음성을 사용
  cachedVoices[prefix] = candidates[0] || matching[0] || null;
  return cachedVoices[prefix];
}

// 이 언어의 음성이 기기/브라우저에 하나도 설치돼 있지 않으면(그래서 재생 시 다른
// 언어 음성으로 대체될 수밖에 없으면) 발음 듣기 버튼을 아예 숨길 수 있도록, 호출부가
// 미리 확인할 수 있는 함수예요.
async function hasNativeVoice(langCode) {
  const prefix = (langCode || "en").toLowerCase();
  const voices = await getVoicesAsync();
  return voices.some((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
}

async function speakWord(text, lang) {
  if (!("speechSynthesis" in window) || !text) return;

  window.speechSynthesis.cancel();
  const bcp47 = lang || "en-US";
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.92; // 살짝 느리게 — 차분한 사전 톤
  utter.pitch = 1.0; // 과장 없는 자연스러운 높낮이
  utter.volume = 1.0;

  const voice = await pickCalmVoice(bcp47.split("-")[0]);
  if (voice) {
    utter.voice = voice;
    // voice와 lang의 지역 코드가 다르면(예: voice는 es-MX인데 lang은 es-ES) 일부
    // 브라우저/OS가 voice 지정을 무시하고 시스템 기본 음성(한국어 등)으로 읽어버려요.
    // 그래서 실제로 고른 voice의 lang을 그대로 맞춰줘요.
    utter.lang = voice.lang;
  } else {
    // 이 언어의 음성을 하나도 못 찾았을 때만 원래 요청한 언어 태그를 그대로 써요.
    utter.lang = bcp47;
  }

  window.speechSynthesis.speak(utter);
}
