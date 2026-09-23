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

const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get("id");
const post = postId ? getPostById(postId) : null;
// 수정을 마치고 돌아온 경우엔 뒤로가기를 누르면 수정 화면으로 되돌아가지 않고
// 바로 홈으로 이동해요.
const cameFromEdit = urlParams.get("from") === "edit";

const postContent = document.getElementById("postContent");
const postNotFound = document.getElementById("postNotFound");

document.getElementById("btnBack").addEventListener("click", () => {
  if (cameFromEdit) {
    window.location.href = "index.html";
  } else {
    window.history.back();
  }
});

// 온보딩에서 고른 학습 언어. 저장된 값이 없으면 영어로 기본 동작해요.
const targetLang = localStorage.getItem("leaf:userLang") || "en";

// v2 — 손보정 사전/번역 검증 로직을 추가하기 전에 저장된 낡은 결과가 남아있을 수
// 있어서, 키 이름을 한 번 바꿔서 예전 캐시를 자연스럽게 무시하게 했어요.
function getPostLangCache() {
  try {
    return JSON.parse(localStorage.getItem("leaf:postLangCacheV2") || "{}");
  } catch (e) {
    return {};
  }
}

function savePostLangCache(cache) {
  try {
    localStorage.setItem("leaf:postLangCacheV2", JSON.stringify(cache));
  } catch (e) {
    /* storage unavailable */
  }
}

// 게시물(데모든 내가 만든 것이든)은 "지금 배우고 있는 언어"로 그때그때 다시 보여줘요.
// 원본 데이터(만들어질 때의 언어)는 건드리지 않고, 번역 결과만 별도 캐시에 저장해서
// 재사용해요 — 그래서 언어를 바꿨다가 다시 원래 언어로 돌아오면 원본 그대로 보여요.
async function applyPostLangOverride(p) {
  const postLang = p.lang || "en";
  if (postLang === targetLang || !p.englishWord) return;

  const cacheKey = `${p.id}:${targetLang}`;
  const cache = getPostLangCache();
  let info = cache[cacheKey];

  if (!info) {
    const targetWord = await translateWordBetweenLangs(p.englishWord, postLang, targetLang);
    if (!targetWord) return;
    const fetched = await fetchWordInfo(targetWord, targetLang);
    if (!fetched) return;
    info = fetched;
    cache[cacheKey] = info;
    savePostLangCache(cache);
  }

  Object.assign(p, {
    englishWord: info.word,
    lang: targetLang,
    phonetic: info.phonetic,
    pos: info.pos,
    definitions: info.definitions,
    etymology: info.etymology,
    synonyms: info.synonyms,
    antonyms: info.antonyms,
    examples: info.examples,
    idioms: info.idioms,
    conversation: info.conversation,
  });
}

async function initPost(p) {
  await applyPostLangOverride(p);
  renderPost(p);
}

if (!post) {
  postContent.hidden = true;
  postNotFound.hidden = false;
} else {
  initPost(post);
}

function formatCount(n) {
  return n.toLocaleString("ko-KR");
}

function renderLikes() {
  const likeBtn = document.getElementById("btnLike");
  likeBtn.classList.toggle("is-liked", post.likedByMe);
  const firstCommenter = post.comments[0] ? displayName(post.comments[0].username) : "user";
  document.getElementById("postLikes").innerHTML =
    `Liked by <b>${firstCommenter}</b> and ${formatCount(post.likeCount)} others`;
}

function renderComments() {
  const wrap = document.getElementById("postComments");
  wrap.innerHTML = "";
  post.comments.forEach((comment, index) => {
    const row = document.createElement("div");
    row.className = "post-comment";

    const body = document.createElement("div");
    body.className = "post-comment-body";
    const b = document.createElement("b");
    b.textContent = displayName(comment.username);
    body.appendChild(b);
    body.appendChild(document.createTextNode(comment.text));
    row.appendChild(body);

    const likeBtn = document.createElement("button");
    likeBtn.className = "post-comment-like";
    if (comment.liked) likeBtn.classList.add("is-liked");
    likeBtn.setAttribute("aria-label", "댓글 좋아요");
    likeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 2.6 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.4.5 5.1 3.8 3.6 7.2-2.1 4.7-9.6 9.3-9.6 9.3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    likeBtn.addEventListener("click", () => {
      comment.liked = !comment.liked;
      likeBtn.classList.toggle("is-liked", comment.liked);
      updatePost(post.id, { comments: post.comments });
    });
    row.appendChild(likeBtn);

    wrap.appendChild(row);
  });
}

/* ---------- 댓글 창(아래에서 올라오는 시트) ---------- */
const commentOverlay = document.getElementById("commentOverlay");
const commentSheetList = document.getElementById("commentSheetList");
const commentInputAvatar = document.getElementById("commentInputAvatar");
const commentInput = document.getElementById("commentInput");
const btnCommentSend = document.getElementById("btnCommentSend");
const commentDeleteConfirm = document.getElementById("commentDeleteConfirm");
const btnConfirmCommentDelete = document.getElementById("btnConfirmCommentDelete");
const btnCancelCommentDelete = document.getElementById("btnCancelCommentDelete");

// 요소를 꾹 누르고 있으면(마우스든 터치든) onLongPress를 호출해요. 누르다가
// 손가락/마우스가 움직이거나 일찍 떼면 취소됩니다.
function attachLongPress(el, onLongPress) {
  const LONG_PRESS_MS = 500;
  let timer = null;

  const start = () => {
    el.classList.add("is-pressing");
    timer = setTimeout(() => {
      el.classList.remove("is-pressing");
      onLongPress();
    }, LONG_PRESS_MS);
  };
  const cancel = () => {
    clearTimeout(timer);
    el.classList.remove("is-pressing");
  };

  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchmove", cancel);
}

// 삭제 확인창에 띄울 "지금 삭제하려는 댓글"을 기억해둬요.
let pendingDeleteComment = null;

function openCommentDeleteConfirm(comment) {
  pendingDeleteComment = comment;
  commentDeleteConfirm.hidden = false;
}

function closeCommentDeleteConfirm() {
  pendingDeleteComment = null;
  commentDeleteConfirm.hidden = true;
}

btnConfirmCommentDelete.addEventListener("click", () => {
  if (!pendingDeleteComment) return;
  post.comments = post.comments.filter((c) => c !== pendingDeleteComment);
  updatePost(post.id, { comments: post.comments });
  closeCommentDeleteConfirm();
  renderComments();
  renderCommentSheetList();
});

btnCancelCommentDelete.addEventListener("click", closeCommentDeleteConfirm);
commentDeleteConfirm.addEventListener("click", (e) => {
  if (e.target === commentDeleteConfirm) closeCommentDeleteConfirm();
});

function renderCommentSheetList() {
  commentSheetList.innerHTML = "";

  if (post.comments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "comment-sheet-empty";
    empty.textContent = "아직 댓글이 없어요. 첫 댓글을 남겨보세요!";
    commentSheetList.appendChild(empty);
    return;
  }

  post.comments.forEach((comment) => {
    const row = document.createElement("div");
    row.className = "csheet-comment";

    const avatar = document.createElement("span");
    avatar.className = "csheet-comment-avatar";
    avatar.textContent = displayName(comment.username)[0].toUpperCase();
    avatar.style.background = avatarColor(comment.username);
    avatar.style.color = "#fff";
    row.appendChild(avatar);

    const body = document.createElement("div");
    body.className = "csheet-comment-body";

    const meta = document.createElement("div");
    meta.className = "csheet-comment-meta";
    const b = document.createElement("b");
    b.textContent = displayName(comment.username);
    meta.appendChild(b);
    if (comment.timeLabel) {
      const time = document.createElement("span");
      time.textContent = comment.timeLabel;
      meta.appendChild(time);
    }
    body.appendChild(meta);

    const text = document.createElement("div");
    text.className = "csheet-comment-text";
    text.textContent = comment.text;
    body.appendChild(text);

    // "답글 달기"·"번역 보기"는 아직 실제 기능이 연결되지 않은 디자인 요소예요
    // (댓글 답글 스레드·번역 기능은 이 앱에 아직 없어요).
    const actions = document.createElement("div");
    actions.className = "csheet-comment-actions";
    actions.innerHTML = "<span>답글 달기</span><span>번역 보기</span>";
    body.appendChild(actions);

    row.appendChild(body);

    const likeBtn = document.createElement("button");
    likeBtn.className = "csheet-comment-like";
    if (comment.liked) likeBtn.classList.add("is-liked");
    likeBtn.setAttribute("aria-label", "댓글 좋아요");
    likeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 2.6 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.4.5 5.1 3.8 3.6 7.2-2.1 4.7-9.6 9.3-9.6 9.3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    likeBtn.addEventListener("click", () => {
      comment.liked = !comment.liked;
      likeBtn.classList.toggle("is-liked", comment.liked);
      updatePost(post.id, { comments: post.comments });
    });
    row.appendChild(likeBtn);

    // 내가 쓴 댓글만 꾹 누르면 삭제할 수 있어요 — 다른 사람 댓글은 지울 수 없어요.
    if (comment.username === "dorina") {
      attachLongPress(row, () => openCommentDeleteConfirm(comment));
    }

    commentSheetList.appendChild(row);
  });
}

function openCommentSheet() {
  const myName = getCurrentUserName();
  commentInputAvatar.textContent = myName[0].toUpperCase();
  commentInputAvatar.style.background = avatarColor("dorina");
  renderCommentSheetList();
  commentOverlay.hidden = false;
  // 시트가 올라오는 애니메이션이 끝난 뒤 포커스를 줘야 자연스러워서 한 틱 미뤄요.
  setTimeout(() => commentInput.focus(), 50);
}

function closeCommentSheet() {
  commentOverlay.hidden = true;
}

function submitComment() {
  const text = commentInput.value.trim();
  if (!text) return;
  const newComment = { username: "dorina", text, liked: false, timeLabel: "방금" };
  post.comments.unshift(newComment);
  updatePost(post.id, { comments: post.comments });
  commentInput.value = "";
  renderComments();
  renderCommentSheetList();
  commentSheetList.scrollTop = 0;
}

commentOverlay.addEventListener("click", (e) => {
  if (e.target === commentOverlay) closeCommentSheet();
});

btnCommentSend.addEventListener("click", submitComment);
commentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitComment();
});

function renderChips(container, words) {
  container.innerHTML = "";
  (words || []).forEach((w) => {
    const chip = document.createElement("span");
    chip.className = "dict-chip";
    chip.textContent = w;
    container.appendChild(chip);
  });
}

function renderDefinitions(p) {
  const meaningsEl = document.getElementById("dictMeanings");
  meaningsEl.innerHTML = "";
  if (!p.definitions || p.definitions.length === 0) {
    const li = document.createElement("li");
    li.textContent = p.koreanWord;
    meaningsEl.appendChild(li);
    return;
  }
  p.definitions.forEach((d) => {
    const li = document.createElement("li");
    li.className = "dict-definition";
    if (d.pos) {
      const posSpan = document.createElement("span");
      posSpan.className = "dict-definition-pos";
      posSpan.textContent = d.pos;
      li.appendChild(posSpan);
    }
    const textSpan = document.createElement("span");
    textSpan.className = "dict-definition-text";
    textSpan.textContent = d.text;
    li.appendChild(textSpan);
    if (d.koreanGloss) {
      const gloss = document.createElement("div");
      gloss.className = "dict-definition-gloss";
      gloss.textContent = d.koreanGloss;
      li.appendChild(gloss);
    }
    meaningsEl.appendChild(li);
  });
}

function renderExamples(examples) {
  const block = document.getElementById("dictExampleBlock");
  const examplesEl = document.getElementById("dictExamples");
  examplesEl.innerHTML = "";
  if (!examples || examples.length === 0) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  examples.forEach((ex) => {
    const wrap = document.createElement("div");
    wrap.className = "dict-example-item";
    const en = document.createElement("div");
    en.className = "dict-example-en";
    en.textContent = ex.en;
    wrap.appendChild(en);
    if (ex.ko) {
      const ko = document.createElement("div");
      ko.className = "dict-example-ko";
      ko.textContent = ex.ko;
      wrap.appendChild(ko);
    }
    examplesEl.appendChild(wrap);
  });
}

function renderConversation(conversation) {
  const block = document.getElementById("dictConversationBlock");
  const conversationEl = document.getElementById("dictConversation");
  conversationEl.innerHTML = "";
  if (!conversation || conversation.length === 0) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  conversation.forEach((c) => {
    const wrap = document.createElement("div");
    wrap.className = "dict-conversation-item";
    const en = document.createElement("div");
    en.className = "dict-conversation-en";
    en.textContent = `“${c.en}”`;
    wrap.appendChild(en);
    if (c.ko) {
      const ko = document.createElement("div");
      ko.className = "dict-conversation-ko";
      ko.textContent = c.ko;
      wrap.appendChild(ko);
    }
    conversationEl.appendChild(wrap);
  });
}

function renderIdioms(idioms) {
  const block = document.getElementById("dictIdiomBlock");
  const idiomsEl = document.getElementById("dictIdioms");
  if (!idioms || idioms.length === 0) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  idiomsEl.innerHTML = "";
  idioms.forEach((idiom) => {
    const wrap = document.createElement("div");
    wrap.className = "dict-idiom";

    const phrase = document.createElement("div");
    phrase.className = "dict-idiom-phrase";
    phrase.textContent = idiom.phrase;
    wrap.appendChild(phrase);

    if (idiom.gloss) {
      const gloss = document.createElement("div");
      gloss.className = "dict-idiom-gloss";
      gloss.textContent = idiom.gloss;
      wrap.appendChild(gloss);
    }

    if (idiom.example) {
      const example = document.createElement("div");
      example.className = "dict-idiom-example";
      example.textContent = idiom.example;
      if (idiom.exampleGloss) {
        const exampleGloss = document.createElement("span");
        exampleGloss.className = "example-gloss";
        exampleGloss.textContent = idiom.exampleGloss;
        example.appendChild(exampleGloss);
      }
      wrap.appendChild(example);
    }

    idiomsEl.appendChild(wrap);
  });
}

function renderEtymology(p) {
  const block = document.getElementById("dictEtymologyBlock");
  if (p.etymology) {
    block.hidden = false;
    document.getElementById("dictEtymology").textContent = p.etymology;
  } else {
    block.hidden = true;
  }
}

function renderSynonyms(p) {
  const block = document.getElementById("dictSynonymBlock");
  if (p.synonyms && p.synonyms.length > 0) {
    block.hidden = false;
    renderChips(document.getElementById("dictSynonyms"), p.synonyms);
  } else {
    block.hidden = true;
  }
}

function renderAntonyms(p) {
  const block = document.getElementById("dictAntonymBlock");
  if (p.antonyms && p.antonyms.length > 0) {
    block.hidden = false;
    renderChips(document.getElementById("dictAntonyms"), p.antonyms);
  } else {
    block.hidden = true;
  }
}

// 예전에 만들어진 게시물(또는 최초 시드 데이터)은 어원/동의어·반의어/예문/회화 정보가
// 없을 수 있어요. 그럴 때는 사전 정보를 실시간으로 받아와 화면을 채우고, 다음에
// 다시 들어왔을 때는 재요청하지 않도록 게시물 데이터에 저장해둡니다. (dictionaryapi.dev
// 요청이 실패해서 위키낱말사전으로 넘어가는 동안 몇 초 걸릴 수 있어서, 그동안 화면이
// "정보가 없는 것"처럼 보이지 않도록 로딩 표시를 함께 보여줘요.)
async function enrichIfNeeded(p) {
  if ((p.definitions && p.definitions.length > 0) || !p.englishWord) return;
  const loadingEl = document.getElementById("dictEnrichLoading");
  if (loadingEl) loadingEl.hidden = false;
  try {
    const info = await fetchWordInfo(p.englishWord, p.lang || "en");
    if (!info) return;
    const patch = {
      phonetic: p.phonetic || info.phonetic,
      pos: p.pos || info.pos,
      definitions: info.definitions,
      etymology: info.etymology,
      synonyms: info.synonyms,
      antonyms: info.antonyms,
      examples: info.examples,
      conversation: info.conversation,
      idioms: info.idioms && info.idioms.length > 0 ? info.idioms : p.idioms,
    };
    Object.assign(p, patch);
    updatePost(p.id, patch);

    document.getElementById("dictPhonetic").textContent = p.phonetic || "";
    document.getElementById("dictPos").textContent = p.pos || "단어";
    renderDefinitions(p);
    renderEtymology(p);
    renderSynonyms(p);
    renderAntonyms(p);
    renderExamples(p.examples);
    renderIdioms(p.idioms);
    renderConversation(p.conversation);
  } catch (e) {
    console.warn("post enrichment failed:", e);
  } finally {
    if (loadingEl) loadingEl.hidden = true;
  }
}

function renderPost(p) {
  const avatarEl = document.querySelector(".post-avatar");
  avatarEl.textContent = displayName(p.username)[0].toUpperCase();
  avatarEl.style.background = avatarColor(p.username);
  document.querySelector(".post-username").textContent = displayName(p.username);

  const photoImg = document.getElementById("postPhoto");
  const photoVideo = document.getElementById("postVideo");
  if (p.mediaType === "video") {
    photoImg.hidden = true;
    photoVideo.hidden = false;
    photoVideo.src = p.photo;
  } else {
    photoVideo.hidden = true;
    photoImg.hidden = false;
    photoImg.src = p.photo;
    photoImg.alt = p.koreanWord;
  }

  document.getElementById("dictWord").textContent = p.englishWord;
  document.getElementById("dictFlag").textContent = getLangMeta(p.lang || "en").flag;
  // 이 언어의 음성이 기기에 없으면 엉뚱한 언어로 읽히는 대신 버튼 자체를 숨겨요.
  hasNativeVoice(p.lang || "en").then((has) => {
    document.getElementById("btnSpeak").hidden = !has;
  });
  document.getElementById("dictPhonetic").textContent = p.phonetic || "";
  document.getElementById("dictPos").textContent = p.pos || "단어";
  renderDefinitions(p);
  renderEtymology(p);
  renderSynonyms(p);
  renderAntonyms(p);
  renderExamples(p.examples);
  renderIdioms(p.idioms);
  renderConversation(p.conversation);
  renderLikes();
  renderComments();
  enrichIfNeeded(p);

  document.getElementById("btnSpeak").addEventListener("click", () => {
    speakWord(p.englishWord, getLangMeta(p.lang || "en").speech);
  });

  document.getElementById("btnLike").addEventListener("click", () => {
    post.likedByMe = !post.likedByMe;
    post.likeCount += post.likedByMe ? 1 : -1;
    updatePost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    renderLikes();
  });

  document.getElementById("btnComment").addEventListener("click", openCommentSheet);

  const bookmarkBtn = document.getElementById("btnBookmark");
  bookmarkBtn.classList.toggle("is-bookmarked", post.bookmarkedByMe);
  bookmarkBtn.addEventListener("click", () => {
    post.bookmarkedByMe = !post.bookmarkedByMe;
    updatePost(post.id, { bookmarkedByMe: post.bookmarkedByMe });
    bookmarkBtn.classList.toggle("is-bookmarked", post.bookmarkedByMe);
    showToast(post.bookmarkedByMe ? "북마크에 저장했어요" : "북마크에서 삭제했어요");
  });

  setupMoreMenu(p);
}

function setupMoreMenu(p) {
  const moreOverlay = document.getElementById("moreOverlay");
  const bookmarkActionLabel = document.getElementById("bookmarkActionLabel");
  const btnBookmarkAction = document.getElementById("btnBookmarkAction");
  const btnEditAction = document.getElementById("btnEditAction");
  const btnDeleteAction = document.getElementById("btnDeleteAction");
  const confirmOverlay = document.getElementById("confirmOverlay");
  const btnConfirmDelete = document.getElementById("btnConfirmDelete");
  const btnCancelDelete = document.getElementById("btnCancelDelete");

  document.getElementById("btnMore").addEventListener("click", () => {
    const mine = isMyPost(p);
    // 내 글: 수정 + 삭제만. 다른 사람 글: 저장만.
    btnBookmarkAction.hidden = mine;
    btnEditAction.hidden = !mine;
    btnDeleteAction.hidden = !mine;
    bookmarkActionLabel.textContent = p.bookmarkedByMe ? "저장 취소" : "저장";
    moreOverlay.hidden = false;
  });

  btnEditAction.addEventListener("click", () => {
    moreOverlay.hidden = true;
    window.location.href = `edit.html?id=${p.id}`;
  });

  moreOverlay.addEventListener("click", (e) => {
    if (e.target === moreOverlay) moreOverlay.hidden = true;
  });

  btnBookmarkAction.addEventListener("click", () => {
    p.bookmarkedByMe = !p.bookmarkedByMe;
    updatePost(p.id, { bookmarkedByMe: p.bookmarkedByMe });
    document.getElementById("btnBookmark").classList.toggle("is-bookmarked", p.bookmarkedByMe);
    moreOverlay.hidden = true;
    showToast(p.bookmarkedByMe ? "북마크에 저장했어요" : "북마크에서 삭제했어요");
  });

  btnDeleteAction.addEventListener("click", () => {
    moreOverlay.hidden = true;
    confirmOverlay.hidden = false;
  });

  confirmOverlay.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) confirmOverlay.hidden = true;
  });

  btnCancelDelete.addEventListener("click", () => {
    confirmOverlay.hidden = true;
  });

  btnConfirmDelete.addEventListener("click", () => {
    deletePost(p.id);
    window.location.href = "index.html";
  });
}
