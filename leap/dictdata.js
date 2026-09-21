// 사전 정보(어원/뜻/동의어·반의어/예문/숙어/회화)를 실제 API들로부터 모아오는 공용
// 모듈이에요. dictionary.html(새 단어 검색)과 post.html(게시물 상세) 양쪽에서
// 똑같은 로직을 재사용합니다. 영어뿐 아니라 온보딩에서 고를 수 있는 다른 학습
// 언어(일본어/스페인어/프랑스어/중국어)도 같은 파이프라인으로 지원해요.

// 언어별 메타 정보 — 국기 이모지, 발음(Web Speech API) 언어 태그, 영어 위키낱말사전에서
// 그 언어 섹션을 찾을 때 쓰는 언어 이름(영어).
const LANG_META = {
  en: { name: "English", flag: "🇺🇸", speech: "en-US" },
  ja: { name: "Japanese", flag: "🇯🇵", speech: "ja-JP" },
  es: { name: "Spanish", flag: "🇪🇸", speech: "es-ES" },
  fr: { name: "French", flag: "🇫🇷", speech: "fr-FR" },
  zh: { name: "Chinese", flag: "🇨🇳", speech: "zh-CN" },
};

function getLangMeta(code) {
  return LANG_META[code] || LANG_META.en;
}

// 자동번역(MyMemory)이 가끔 부자연스러운 단어를 주거나(예: "apple"→アップル(외래어/
// 브랜드명) 대신 자연스러운 りんご), 무료 API 일일 한도에 걸려 아예 응답을 못 줄 때가
// 있어요. 그래서 홈 화면 데모 단어 세트(고정된 11개)는 언어별로 전부 손으로
// 채워뒀어요 — API 상태와 무관하게 항상 정확하고 자연스럽게 나와요. 그 외
// 단어(실제 촬영한 사진 등)는 이 목록에 없으면 자동 번역을 씁니다.
const CURATED_WORD_TRANSLATIONS = {
  ja: {
    apple: "りんご",
    coffee: "コーヒー",
    camera: "カメラ",
    sign: "標識",
    cloud: "雲",
    friend: "友たち",
    "latte art": "ラテアート",
    handbag: "ハンドバッグ",
    book: "本",
    "road sign": "道路標識",
    "tote bag": "トートバッグ",
  },
  es: {
    apple: "manzana",
    coffee: "café",
    camera: "cámara",
    sign: "letrero", // 자동번역은 "firma"(서명)로 잘못 나와서 교정
    cloud: "nube",
    friend: "amigo",
    "latte art": "arte latte",
    handbag: "bolso", // "bolso de mano"는 위키낱말사전에 항목이 없어서 더 짧은 표기로 교정
    book: "libro",
    "road sign": "señal de tráfico",
    "tote bag": "bolsa tote",
  },
};

// 위키낱말사전 REST API는 발음(IPA) 정보를 아예 주지 않아서(영어가 아닌 언어는 늘
// phonetic이 빈 문자열로 옴), 홈 화면 데모 단어 세트는 정확한 강세를 보여주기 위해
// 발음도 직접 채워뒀어요. (스페인어는 중남미식 발음(세세오) 기준 — 발음 재생에 쓰는
// 음성(Paulina, es-MX)과도 맞춰뒀습니다.)
const CURATED_PHONETICS = {
  es: {
    "café": "/kaˈfe/",
    "cámara": "/ˈkamaɾa/",
    "letrero": "/leˈtɾeɾo/",
    "nube": "/ˈnube/",
    "amigo": "/aˈmiɡo/",
    "arte latte": "/ˈaɾte ˈlate/",
    "bolso": "/ˈbolso/",
    "libro": "/ˈliβɾo/",
    "señal de tráfico": "/seˈɲal de ˈtɾafiko/",
    "manzana": "/manˈsana/",
    "bolsa tote": "/ˈbolsa ˈtote/",
  },
};

async function translateConceptWord(englishWord, targetLang) {
  const override = CURATED_WORD_TRANSLATIONS[targetLang] && CURATED_WORD_TRANSLATIONS[targetLang][englishWord.toLowerCase()];
  if (override) return override;
  return (await translateText(englishWord, "en", targetLang)) || englishWord;
}

// 일부 단어는 화면에 흔히 쓰이는 표기(예: 히라가나 "りんご")와 위키낱말사전에 실제
// 등재된 표기(예: 한자 "林檎")가 달라서, 흔한 표기로는 사전 조회가 실패해요. 그럴 때
// 조회에만 쓸 별칭을 연결해두고, 화면엔 원래 입력한 표기를 그대로 보여줍니다.
const LOOKUP_ALIASES = {
  ja: {
    "りんご": "林檎",
    "友たち": "友達",
  },
};

function resolveLookupWord(word, langCode) {
  return (LOOKUP_ALIASES[langCode] && LOOKUP_ALIASES[langCode][word]) || word;
}

// ---------- Shared "데모 콘텐츠의 영어 라벨을 학습 언어로" 캐시 ----------
// 홈 화면 타일, 검색/마이페이지 타일, 피드 카드가 전부 이 캐시를 같이 써요 — 한 곳에서
// 번역한 단어는 다른 화면에서 또 번역할 필요가 없어요.
// v2 — 손보정 사전(CURATED_WORD_TRANSLATIONS)을 추가하기 전에 저장된 낡은 번역이
// 남아있을 수 있어서, 키 이름을 한 번 바꿔서 예전 캐시를 자연스럽게 무시하게 했어요.
function getTranslitCache() {
  try {
    return JSON.parse(localStorage.getItem("leaf:translitCacheV2") || "{}");
  } catch (e) {
    return {};
  }
}

function saveTranslitCache(cache) {
  try {
    localStorage.setItem("leaf:translitCacheV2", JSON.stringify(cache));
  } catch (e) {
    /* storage unavailable */
  }
}

// 단어 하나를 한 언어에서 다른 언어로 옮겨요. 원래 언어가 영어면 손보정 사전
// (CURATED_WORD_TRANSLATIONS)을 먼저 확인하고, 그 외에는 바로 기계 번역을 씁니다 —
// 사용자가 만든 게시물은 만들 때 학습 언어가 영어가 아니었을 수도 있어서(예: 일본어로
// 배우던 중 등록한 단어), 항상 영어가 원문이라고 가정하면 안 돼요.
async function translateWordBetweenLangs(word, sourceLang, targetLang) {
  if (!word || sourceLang === targetLang) return word;
  if (sourceLang === "en") return translateConceptWord(word, targetLang);
  return (await translateText(word, sourceLang, targetLang)) || word;
}

// span 엘리먼트 하나를 받아서, 캐시에 있으면 즉시 채우고 없으면 번역해서 채운 뒤
// 캐시에 저장해요.
async function translateLabelInto(text, sourceLang, targetLang, span) {
  if (!text || sourceLang === targetLang) return;
  const key = `${sourceLang}>${targetLang}:${text.toLowerCase()}`;
  const cached = getTranslitCache()[key];
  if (cached) {
    span.textContent = cached;
    return;
  }
  const translated = await translateWordBetweenLangs(text, sourceLang, targetLang);
  if (translated && translated !== text) {
    span.textContent = translated;
    // 여러 타일이 동시에 번역을 마치면서 캐시를 덮어쓰지 않도록, 쓰기 직전에 캐시를
    // 다시 읽어와 병합해요.
    const freshCache = getTranslitCache();
    freshCache[key] = translated;
    saveTranslitCache(freshCache);
  }
}

const POS_KR = {
  noun: "명사",
  verb: "동사",
  adjective: "형용사",
  adverb: "부사",
  pronoun: "대명사",
  preposition: "전치사",
  conjunction: "접속사",
  interjection: "감탄사",
  exclamation: "감탄사",
  determiner: "한정사",
  article: "관사",
  numeral: "수사",
  "proper noun": "고유명사",
  particle: "조사",
  prefix: "접두사",
  suffix: "접미사",
  counter: "수량사",
  symbol: "기호",
  phrase: "구",
  contraction: "축약형",
};

// 큐레이션 데이터 — 라이브 API들은 어원/숙어/실생활 대화를 안정적으로 주지 못해서
// 데모 단어 몇 개는 손으로 채워두고, 그 외 모든 단어는 라이브 API 데이터를 씁니다.
const CURATED_ENTRIES = {
  apple: {
    etymology:
      "고대 영어 'æppel'에서 유래했고, 게르만조어 '*ap(a)laz'까지 거슬러 올라가요. 원래는 지금처럼 사과만이 아니라 둥근 열매 전반을 가리키는 말이었어요.",
    idioms: [
      {
        phrase: "apples and oranges",
        gloss: "서로 전혀 다른 두 사람[가지], 천양지차",
        example: "They really are apples and oranges.",
        exampleGloss: "그들은 정말 천양지차로 다르다.",
      },
      {
        phrase: "the apple doesn't fall/never falls far from the tree",
        gloss: "부전자전",
      },
      {
        phrase: "the apple of somebody's eye",
        gloss: "가장 사랑하는 사람[것], 눈에 넣어도 안 아픈 존재",
      },
    ],
    conversation: [
      { en: "Do you want an apple for a snack?", ko: "간식으로 사과 먹을래?" },
      { en: "This pie is made with fresh apples.", ko: "이 파이는 신선한 사과로 만들었어요." },
      { en: "An apple a day keeps the doctor away.", ko: "사과를 매일 먹으면 병원 갈 일이 없다." },
    ],
  },
};

// ---------- Small helpers reused across the enrichment fetches ----------

async function translateText(text, from, to) {
  if (!text) return "";
  // MyMemory는 요청 하나당 500자 제한이 있어요. 넘으면 에러 메시지를 번역문인 것처럼
  // responseData.translatedText에 그대로 돌려주기 때문에, 넘지 않게 먼저 잘라냅니다.
  const trimmedInput = text.length > 480 ? text.slice(0, 480) : text;
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmedInput)}&langpair=${from}|${to}`
    );
    if (!res.ok) return "";
    const data = await res.json();
    // responseStatus가 200이 아니면(글자수 초과 등) translatedText에 에러 메시지가 들어있어요.
    if (String(data.responseStatus) !== "200") return "";
    return (data.responseData && data.responseData.translatedText) || "";
  } catch (e) {
    console.warn("translate failed:", e);
    return "";
  }
}

// MyMemory는 가끔 번역할 수 없는 짧은/쉼표로 나열된 문구를 원문 그대로 돌려줘요(무음
// 실패). 번역 결과가 비었거나 원문과 (대소문자 무시하고) 똑같으면 실패로 간주해서,
// 영어가 화면에 남지 않도록 걸러냅니다.
function isUsableTranslation(original, translated) {
  if (!translated) return false;
  return translated.trim().toLowerCase() !== (original || "").trim().toLowerCase();
}

// 번역이 실패(원문 그대로 돌아옴)했으면 빈 문자열로 — 호출부는 빈 문자열이면 그
// 줄을 그냥 숨기면 돼요.
function sanitizeTranslation(original, translated) {
  return isUsableTranslation(original, translated) ? translated : "";
}

// Datamuse는 영어 단어 연상 전용 API라 동의어/반의어는 영어 단어일 때만 물어봐요.
async function fetchDatamuseWords(word, rel) {
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=6`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d) => d.word);
  } catch (e) {
    return [];
  }
}

// 실생활 대화체 예문 — MyMemory 번역 메모리(TM)에는 영화 자막 등 실제 코퍼스에서
// 가져온 원문-번역 문장쌍이 함께 오기 때문에, 그중 자연스러운 회화 문장만 골라냅니다.
// langCode를 그대로 원문 언어로 사용해서, 학습 언어가 무엇이든 그 언어의 실제 문장을
// 받아올 수 있어요.
async function fetchConversationalExamples(word, langCode) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${langCode}|ko`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const matches = (data.matches || []).slice().sort((a, b) => (b.match || 0) - (a.match || 0));
    const seen = new Set();
    const picked = [];
    for (const m of matches) {
      const original = (m.segment || "").trim();
      const ko = (m.translation || "").trim();
      if (!original || !ko) continue;
      if (original.trim() === word.trim()) continue; // 단어 그 자체만 매치된 건 문장이 아니라서 제외
      if (langCode === "en" && original.split(/\s+/).length < 3) continue; // 너무 짧은(단어만 있는) 매치는 제외
      if (langCode === "en" && !new RegExp(`\\b${word}\\b`, "i").test(original)) continue;
      if (langCode !== "en" && !original.includes(word)) continue;
      // 일본어/중국어는 띄어쓰기가 없어서 단어 수 대신 글자 수로 "문장다운지"를 확인해요.
      if (langCode !== "en" && original.length < word.length + 4) continue;
      const key = original.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push({ en: original, ko });
      if (picked.length >= 3) break;
    }
    return picked;
  } catch (e) {
    console.warn("conversational examples fetch failed:", e);
    return [];
  }
}

// 어원 — 영어 위키낱말사전(en.wiktionary.org)은 외국어 단어도 그 단어의 언어 섹션
// 아래에 영어로 설명을 담고 있어요. 그래서 학습 언어와 무관하게 항상 en.wiktionary.org
// 하나만 쓰고, "English" 대신 그 언어의 영어 이름(예: "Spanish") 섹션을 찾습니다.
const WIKTIONARY_HEADINGS = new Set([
  "English", "Japanese", "Spanish", "French", "Chinese", "Mandarin",
  "Etymology", "Pronunciation", "Noun", "Verb", "Adjective", "Adverb",
  "Pronoun", "Preposition", "Conjunction", "Interjection", "Determiner", "Article",
  "Numeral", "Synonyms", "Antonyms", "Derived terms", "Related terms", "Translations",
  "See also", "References", "Anagrams", "Further reading", "Usage notes",
  "Alternative forms", "Proper noun", "Symbol", "Contraction", "Idiom", "Phrase",
]);

async function fetchEtymology(word, langCode) {
  const sectionName = getLangMeta(langCode).name;
  try {
    const res = await fetch(
      `https://en.wiktionary.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(word)}&origin=*`
    );
    if (!res.ok) return "";
    const data = await res.json();
    const pages = data.query && data.query.pages;
    if (!pages) return "";
    const page = Object.values(pages)[0];
    if (!page || !page.extract) return "";

    const lines = page.extract.split("\n");
    let inSection = false;
    let capturing = false;
    const etymologyLines = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (line === sectionName) {
        inSection = true;
        continue;
      }
      if (!inSection) continue;
      if (/^Etymology(\s+\d+)?$/.test(line)) {
        capturing = true;
        continue;
      }
      if (capturing) {
        if (line === "") {
          if (etymologyLines.length > 0) break;
          continue;
        }
        if (WIKTIONARY_HEADINGS.has(line)) break;
        etymologyLines.push(line);
      }
    }
    return etymologyLines.join(" ").replace(/\[\d+\]/g, "").trim();
  } catch (e) {
    console.warn("etymology fetch failed:", e);
    return "";
  }
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("style, script").forEach((el) => el.remove());
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}

// Wiktionary의 "examples" 필드는 가끔 문장이 아니라 연관/합성어 목록을 담고 있어서,
// "예문"으로 보여주기 전에 문장처럼 생겼는지 걸러냅니다.
function looksLikeSentence(text) {
  if (!text || text.length < 8) return false;
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return false;
  const counts = {};
  words.forEach((w) => {
    const key = w.toLowerCase().replace(/[^a-z]/g, "");
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  const maxRepeat = Math.max(0, ...Object.values(counts));
  return maxRepeat < 3;
}

// ---------- Primary sources ----------

// 1차: Free Dictionary API — 발음(IPA)까지 포함된 가장 상세한 응답. 영어 단어에서만
// 안정적으로 동작해서 영어일 때만 시도해요.
async function lookupFromDictionaryApi(word, langCode) {
  if (langCode !== "en") throw new Error("dictionaryapi.dev: English only");
  // 이 API가 막혀있거나(CORS) 응답이 느릴 때 위키낱말사전 폴백으로 넘어가는 게
  // 오래 걸리지 않도록, 3초 넘게 걸리면 바로 포기해요.
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { signal: AbortSignal.timeout(3000) }
  );
  if (!res.ok) throw new Error("dictionaryapi.dev: not found");
  const data = await res.json();
  const entry = data[0];

  const phoneticText =
    entry.phonetic || (entry.phonetics.find((p) => p.text) || {}).text || "";

  const meanings = entry.meanings || [];
  const firstMeaning = meanings[0];
  const posKr = firstMeaning ? POS_KR[firstMeaning.partOfSpeech] || firstMeaning.partOfSpeech : "";

  const definitions = [];
  const examples = [];
  const synonyms = new Set();
  const antonyms = new Set();
  meanings.slice(0, 3).forEach((m) => {
    (m.synonyms || []).forEach((s) => synonyms.add(s));
    (m.antonyms || []).forEach((a) => antonyms.add(a));
    (m.definitions || [])
      .filter((d) => d.definition)
      .slice(0, 2)
      .forEach((d) => {
        definitions.push({
          pos: POS_KR[m.partOfSpeech] || m.partOfSpeech,
          text: d.definition,
        });
        (d.synonyms || []).forEach((s) => synonyms.add(s));
        (d.antonyms || []).forEach((a) => antonyms.add(a));
        if (d.example && looksLikeSentence(d.example)) examples.push({ en: d.example });
      });
  });

  return {
    word: entry.word,
    phonetic: phoneticText,
    pos: posKr,
    definitions,
    examples: examples.slice(0, 3),
    synonyms: [...synonyms].slice(0, 6),
    antonyms: [...antonyms].slice(0, 6),
  };
}

// 2차 폴백(그리고 영어 외 언어의 1차 소스): 영어 위키낱말사전. 찾는 단어가 어떤 언어든
// en.wiktionary.org 하나에 다 있고, 응답이 언어 코드별로 묶여 있어서 그 언어의
// 섹션만 골라 씁니다. 뜻풀이는 (원어가 무엇이든) 영어로 되어 있어서 한국어 번역은
// 항상 영어→한국어로 하면 돼요.
async function lookupFromWiktionary(word, langCode) {
  const res = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
  );
  if (!res.ok) throw new Error("wiktionary: not found");
  const data = await res.json();
  const entries = data[langCode];
  if (!entries || entries.length === 0) throw new Error("wiktionary: no entry for this language");

  const firstEntry = entries[0];
  const posKr = POS_KR[(firstEntry.partOfSpeech || "").toLowerCase()] || firstEntry.partOfSpeech || "";

  const definitions = [];
  const examples = [];
  entries.slice(0, 3).forEach((e) => {
    const pos = POS_KR[(e.partOfSpeech || "").toLowerCase()] || e.partOfSpeech || "";
    (e.definitions || [])
      .filter((d) => stripHtml(d.definition))
      .slice(0, 2)
      .forEach((d) => {
        definitions.push({ pos, text: stripHtml(d.definition) });
        if (d.examples && d.examples.length > 0) {
          const ex = stripHtml(d.examples[0]);
          if (looksLikeSentence(ex)) examples.push({ en: ex });
        }
      });
  });

  return {
    word,
    phonetic: "",
    pos: posKr,
    definitions,
    examples: examples.slice(0, 3),
    synonyms: [],
    antonyms: [],
  };
}

// ---------- Enrichment (etymology / synonyms fallback / examples / conversation) ----------

async function enrichEntry(base, langCode) {
  const curated = langCode === "en" ? CURATED_ENTRIES[base.word.toLowerCase()] : null;

  // Datamuse는 영어 전용이라 학습 언어가 영어일 때만 동의어/반의어를 보강해요.
  // 다른 언어는 사전 API가 자체적으로 준 값만 쓰고, 없으면 그냥 섹션을 숨깁니다.
  const needsSynAnto = langCode === "en" && (base.synonyms.length === 0 || base.antonyms.length === 0);
  const [etymologyRaw, datamuseSyn, datamuseAnt, conversation] = await Promise.all([
    curated && curated.etymology ? Promise.resolve(curated.etymology) : fetchEtymology(base.word, langCode),
    needsSynAnto && base.synonyms.length === 0 ? fetchDatamuseWords(base.word, "rel_syn") : Promise.resolve([]),
    needsSynAnto && base.antonyms.length === 0 ? fetchDatamuseWords(base.word, "rel_ant") : Promise.resolve([]),
    curated && curated.conversation ? Promise.resolve(curated.conversation) : fetchConversationalExamples(base.word, langCode),
  ]);

  const synonyms = base.synonyms.length > 0 ? base.synonyms : datamuseSyn;
  const antonyms = base.antonyms.length > 0 ? base.antonyms : datamuseAnt;

  // 뜻(정의)·예문·어원은 (원어가 무엇이든) en.wiktionary.org에서 영어로 옵니다.
  // 호출량을 아끼기 위해 개수를 제한해요.
  const defsToTranslate = base.definitions.slice(0, 4);
  const exsToTranslate = base.examples.slice(0, 3);

  let definitions, examples, etymology;
  if (langCode === "en" || (curated && curated.etymology)) {
    // 영어를 배우는 경우(또는 큐레이션된 한국어 어원이 있는 경우)는 원문을 그대로 보여주고
    // 한국어 번역만 덧붙입니다.
    const [defGlosses, exGlosses] = await Promise.all([
      Promise.all(defsToTranslate.map((d) => translateText(d.text, "en", "ko"))),
      Promise.all(exsToTranslate.map((e) => translateText(e.en, "en", "ko"))),
    ]);
    // 한국어 번역도 가끔(짧은 쉼표 나열 등) 실패해서 원문이 그대로 돌아올 수 있어요.
    // 그럴 땐 번역 줄만 비워서 그냥 숨겨요(영어가 "한국어 뜻"인 것처럼 보이지 않게).
    definitions = defsToTranslate.map((d, i) => ({ ...d, koreanGloss: sanitizeTranslation(d.text, defGlosses[i]) }));
    examples = exsToTranslate.map((e, i) => ({ ...e, ko: sanitizeTranslation(e.en, exGlosses[i]) }));
    etymology = etymologyRaw || "";
  } else {
    // 영어가 아닌 언어를 배우는 경우엔 영어 설명을 그대로 보여주면 화면에 영어가 섞여
    // 나와요. 그 학습 언어로 한 번 더 번역해서 보여주고, 한국어 번역도 함께 답니다.
    // (번역에 실패하면 영어를 남겨두는 대신 그냥 숨겨요.)
    const [defTarget, defKo, exTarget, exKo, etymologyTarget] = await Promise.all([
      Promise.all(defsToTranslate.map((d) => translateText(d.text, "en", langCode))),
      Promise.all(defsToTranslate.map((d) => translateText(d.text, "en", "ko"))),
      Promise.all(exsToTranslate.map((e) => translateText(e.en, "en", langCode))),
      Promise.all(exsToTranslate.map((e) => translateText(e.en, "en", "ko"))),
      etymologyRaw ? translateText(etymologyRaw, "en", langCode) : Promise.resolve(""),
    ]);
    // MyMemory가 가끔 번역에 실패하고 원문을 그대로 돌려줄 때가 있어요(특히 쉼표로
    // 나열된 짧은 뜻풀이). 학습 언어 번역이 실패하면 그 항목을 통째로 빼고, 한국어
    // 번역만 따로 실패했으면 그 줄만 비워둬요.
    definitions = defsToTranslate
      .map((d, i) => ({
        pos: d.pos,
        text: defTarget[i],
        koreanGloss: sanitizeTranslation(d.text, defKo[i]),
        _original: d.text,
      }))
      .filter((d) => isUsableTranslation(d._original, d.text))
      .map(({ _original, ...rest }) => rest);
    examples = exsToTranslate
      .map((e, i) => ({ en: exTarget[i], ko: sanitizeTranslation(e.en, exKo[i]), _original: e.en }))
      .filter((e) => isUsableTranslation(e._original, e.en))
      .map(({ _original, ...rest }) => rest);
    etymology = isUsableTranslation(etymologyRaw, etymologyTarget) ? etymologyTarget : "";
  }

  return {
    ...base,
    definitions,
    examples,
    synonyms,
    antonyms,
    idioms: (curated && curated.idioms) || [],
    etymology,
    conversation: conversation || [],
  };
}

async function fetchBaseEntry(word, langCode) {
  try {
    return await lookupFromDictionaryApi(word, langCode);
  } catch (e) {
    console.warn("dictionaryapi.dev skipped/failed, trying Wiktionary:", e);
  }
  try {
    return await lookupFromWiktionary(word, langCode);
  } catch (e) {
    console.warn("Wiktionary also failed:", e);
  }
  // "arte latte"(라떼아트), "bolsa tote"(에코백)처럼 합성 표현은 위키낱말사전에
  // 항목 자체가 없어서 여기까지 와요. 그래도 발음이 큐레이션돼 있으면 완전히
  // 실패(null) 처리하는 대신, 최소한 단어·발음·품사만이라도 채워서 보여줍니다.
  const curatedPhonetic = CURATED_PHONETICS[langCode] && CURATED_PHONETICS[langCode][word.toLowerCase()];
  if (curatedPhonetic) {
    return { word, phonetic: curatedPhonetic, pos: POS_KR.noun, definitions: [], examples: [], synonyms: [], antonyms: [] };
  }
  return null;
}

// ---------- Orchestrator ----------
// 단어 하나와 학습 언어 코드(en/ja/es/fr/zh)를 받아 사전 API → 위키낱말사전 폴백 →
// 보강(enrich)까지 전부 거친 완성된 정보를 돌려줍니다. 완전히 실패하면 null을 돌려줘요.
// 페이지를 막 이동한 직후 첫 요청이 일시적으로 실패하는 경우가 있어, 한 번은
// 짧게 대기했다가 재시도해봅니다.
async function fetchWordInfo(word, langCode) {
  const lang = langCode || "en";
  const lookupWord = resolveLookupWord(word, lang);
  let base = await fetchBaseEntry(lookupWord, lang);
  if (!base) {
    await new Promise((r) => setTimeout(r, 700));
    base = await fetchBaseEntry(lookupWord, lang);
  }
  if (!base) return null;

  // 큐레이션된 발음이 있으면(위키낱말사전이 채워주지 못하는 부분) 그걸 우선해요.
  const phoneticOverride =
    CURATED_PHONETICS[lang] && CURATED_PHONETICS[lang][word.toLowerCase()];

  try {
    const enriched = await enrichEntry(base, lang);
    // 화면엔 원래 요청한 표기를 그대로 보여줘요.
    return { ...enriched, word, phonetic: phoneticOverride || enriched.phonetic };
  } catch (e) {
    console.warn("enrichment failed, returning base entry:", e);
    return { ...base, word, phonetic: phoneticOverride || base.phonetic, idioms: [], etymology: "", conversation: [] };
  }
}
