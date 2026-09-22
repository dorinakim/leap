const KO_TO_EN = {
  "사과": "apple",
  "바구니": "basket",
  "과일": "fruit",
  "빨간색": "red",
  "원": "circle",
};

const photo = document.getElementById("dictPhoto");
const dictVideo = document.getElementById("dictVideo");
const loading = document.getElementById("dictLoading");
const result = document.getElementById("dictResult");
const empty = document.getElementById("dictEmpty");
const dictWord = document.getElementById("dictWord");
const dictFlag = document.getElementById("dictFlag");
const dictPhonetic = document.getElementById("dictPhonetic");
const dictPos = document.getElementById("dictPos");
const meaningsEl = document.getElementById("dictMeanings");
const etymologyEl = document.getElementById("dictEtymology");
const synonymsEl = document.getElementById("dictSynonyms");
const antonymsEl = document.getElementById("dictAntonyms");
const examplesEl = document.getElementById("dictExamples");
const idiomsEl = document.getElementById("dictIdioms");
const conversationEl = document.getElementById("dictConversation");
const editKoreanWord = document.getElementById("editKoreanWord");
const btnBack = document.getElementById("btnBack");
const btnSpeak = document.getElementById("btnSpeak");
const btnShare = document.getElementById("btnShare");

const koreanWord = sessionStorage.getItem("leaf:selectedWord") || "사과";
const photoSrc = sessionStorage.getItem("leaf:capturedPhoto") || "assets/demo-apple.png";
const capturedMediaType = sessionStorage.getItem("leaf:capturedMediaType") || "image";
// 온보딩에서 고른 학습 언어(en/ja/es/fr/zh). 저장된 값이 없으면 영어로 기본 동작해요.
const wordLang = sessionStorage.getItem("leaf:selectedWordLang") || "en";
// 키워드 화면(이미지 인식/번역)에서 이미 학습 언어 단어를 알아냈다면 그걸 그대로 쓰고,
// 없을 때만(영어일 때만) 기존 고정 매핑표로 대체합니다.
const targetWord =
  sessionStorage.getItem("leaf:selectedWordEn") || (wordLang === "en" ? KO_TO_EN[koreanWord] : null) || koreanWord;

dictFlag.textContent = getLangMeta(wordLang).flag;
// 이 언어의 음성이 기기에 없으면 엉뚱한 언어로 읽히는 대신 버튼 자체를 숨겨요.
hasNativeVoice(wordLang).then((has) => {
  btnSpeak.hidden = !has;
});

if (capturedMediaType === "video") {
  dictVideo.src = photoSrc;
  dictVideo.hidden = false;
  dictVideo.play().catch(() => {});
  photo.hidden = true;
} else {
  photo.src = photoSrc;
  photo.alt = koreanWord;
}

btnBack.addEventListener("click", () => {
  window.history.back();
});

btnSpeak.addEventListener("click", () => {
  speakWord(dictWord.value.trim() || targetWord, getLangMeta(wordLang).speech);
});

function fillFields(entry) {
  dictWord.value = entry.word || "";
  dictPhonetic.value = entry.phonetic || "";
  dictPos.value = entry.pos || "";
  editKoreanWord.value = entry.koreanWord || "";

  renderEditableDefinitions(meaningsEl, entry.definitions);
  etymologyEl.value = entry.etymology || "";
  renderEditableWordList(synonymsEl, entry.synonyms);
  renderEditableWordList(antonymsEl, entry.antonyms);
  renderEditableExamples(examplesEl, entry.examples);
  renderEditableIdioms(idiomsEl, entry.idioms);
  renderEditableConversation(conversationEl, entry.conversation);
}

async function lookup() {
  const info = await fetchWordInfo(targetWord, wordLang);
  loading.hidden = true;
  result.hidden = false;

  if (!info) {
    // 사전 정보를 못 찾아도 직접 입력해서 등록할 수 있도록 빈 칸으로 채워둡니다.
    empty.hidden = false;
    fillFields({ koreanWord, word: targetWord, phonetic: "", pos: "", definitions: [], synonyms: [], antonyms: [], examples: [], idioms: [], conversation: [] });
    return;
  }

  empty.hidden = true;
  fillFields({ koreanWord, ...info });
}

btnShare.addEventListener("click", () => {
  const newWord = editKoreanWord.value.trim();
  if (!newWord) {
    editKoreanWord.focus();
    return;
  }
  const post = createPost({
    photo: photoSrc,
    mediaType: capturedMediaType,
    koreanWord: newWord,
    englishWord: dictWord.value.trim() || targetWord,
    lang: wordLang,
    phonetic: dictPhonetic.value.trim(),
    pos: dictPos.value.trim(),
    idioms: collectIdioms(idiomsEl),
    etymology: etymologyEl.value.trim(),
    definitions: collectDefinitions(meaningsEl),
    synonyms: collectWordList(synonymsEl),
    antonyms: collectWordList(antonymsEl),
    examples: collectExamples(examplesEl),
    conversation: collectConversation(conversationEl),
  });
  addPost(post);
  sessionStorage.removeItem("leaf:capturedPhoto");
  sessionStorage.removeItem("leaf:selectedWord");
  sessionStorage.removeItem("leaf:selectedWordEn");
  sessionStorage.removeItem("leaf:selectedWordLang");
  sessionStorage.removeItem("leaf:capturedMediaType");
  window.location.href = "index.html";
});

lookup();
