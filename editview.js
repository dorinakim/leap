const postId = new URLSearchParams(window.location.search).get("id");
const post = postId ? getPostById(postId) : null;

const dictResult = document.getElementById("dictResult");
const postNotFound = document.getElementById("postNotFound");
const photo = document.getElementById("dictPhoto");
const dictVideo = document.getElementById("dictVideo");
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
const btnSaveEdit = document.getElementById("btnSaveEdit");

btnBack.addEventListener("click", () => {
  window.history.back();
});

if (!post) {
  dictResult.hidden = true;
  postNotFound.hidden = false;
} else {
  renderEdit(post);
}

function renderEdit(p) {
  if (p.mediaType === "video") {
    dictVideo.src = p.photo;
    dictVideo.hidden = false;
    dictVideo.play().catch(() => {});
    photo.hidden = true;
  } else {
    photo.src = p.photo;
    photo.alt = p.koreanWord;
  }

  dictWord.value = p.englishWord || "";
  dictFlag.textContent = getLangMeta(p.lang || "en").flag;
  // 이 언어의 음성이 기기에 없으면 엉뚱한 언어로 읽히는 대신 버튼 자체를 숨겨요.
  hasNativeVoice(p.lang || "en").then((has) => {
    btnSpeak.hidden = !has;
  });
  dictPhonetic.value = p.phonetic || "";
  dictPos.value = p.pos || "";
  editKoreanWord.value = p.koreanWord || "";

  renderEditableDefinitions(meaningsEl, p.definitions);
  etymologyEl.value = p.etymology || "";
  renderEditableWordList(synonymsEl, p.synonyms);
  renderEditableWordList(antonymsEl, p.antonyms);
  renderEditableExamples(examplesEl, p.examples);
  renderEditableIdioms(idiomsEl, p.idioms);
  renderEditableConversation(conversationEl, p.conversation);

  btnSpeak.addEventListener("click", () => {
    speakWord(dictWord.value.trim() || p.englishWord, getLangMeta(p.lang || "en").speech);
  });

  btnSaveEdit.addEventListener("click", () => {
    const newWord = editKoreanWord.value.trim();
    if (!newWord) {
      editKoreanWord.focus();
      return;
    }
    const patch = {
      koreanWord: newWord,
      englishWord: dictWord.value.trim() || p.englishWord,
      phonetic: dictPhonetic.value.trim(),
      pos: dictPos.value.trim(),
      definitions: collectDefinitions(meaningsEl),
      etymology: etymologyEl.value.trim(),
      synonyms: collectWordList(synonymsEl),
      antonyms: collectWordList(antonymsEl),
      examples: collectExamples(examplesEl),
      idioms: collectIdioms(idiomsEl),
      conversation: collectConversation(conversationEl),
    };
    updatePost(p.id, patch);
    // replace()로 이동해서 수정 화면이 히스토리에 남지 않도록 해요 — 상세페이지에서
    // 뒤로가기를 눌렀을 때 다시 수정 화면으로 돌아가지 않고 홈으로 가게 됩니다.
    window.location.replace(`post.html?id=${p.id}&from=edit`);
  });
}
