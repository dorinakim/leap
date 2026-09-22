const POS_EN = {
  "명사": "noun",
  "동사": "verb",
  "형용사": "adjective",
  "부사": "adverb",
};

// 온보딩에서 고른 학습 언어. 저장된 값이 없으면 영어로 기본 동작해요.
const feedTargetLang = localStorage.getItem("leaf:userLang") || "en";

function formatCount(n) {
  return n.toLocaleString("ko-KR");
}

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

function createFeedCard(post) {
  const article = document.createElement("article");
  article.className = "feed-post";

  const header = document.createElement("header");
  header.className = "feed-post-header";
  header.innerHTML = `
    <span class="feed-avatar" style="background:${avatarColor(post.username)}">${displayName(post.username)[0].toUpperCase()}</span>
    <span class="feed-username">${displayName(post.username)}</span>
    <button class="feed-more" aria-label="더보기">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>
    </button>`;
  header.querySelector(".feed-more").addEventListener("click", () => openMoreSheet(post.id));
  article.appendChild(header);

  const photoWrap = document.createElement("div");
  photoWrap.className = "feed-photo-wrap";
  photoWrap.innerHTML =
    post.mediaType === "video"
      ? `<video class="feed-photo" src="${post.photo}" muted playsinline preload="metadata"></video><span class="media-play-badge">▶</span>`
      : `<img class="feed-photo" src="${post.photo}" alt="${post.koreanWord}" />`;
  photoWrap.addEventListener("click", () => goToPost(post.id));
  article.appendChild(photoWrap);

  const actions = document.createElement("div");
  actions.className = "feed-actions";
  actions.innerHTML = `
    <button class="feed-action-btn feed-like-btn" aria-label="좋아요">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 2.6 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.4.5 5.1 3.8 3.6 7.2-2.1 4.7-9.6 9.3-9.6 9.3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
    </button>
    <button class="feed-action-btn feed-comment-btn" aria-label="댓글">
      <svg viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20l1.1-5.2A8.5 8.5 0 1 1 21 11.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
    </button>
    <span class="feed-actions-spacer"></span>
    <button class="feed-action-btn feed-bookmark-btn" aria-label="북마크">
      <svg viewBox="0 0 24 24" fill="none"><path d="M6 4h12v16l-6-4-6 4V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
    </button>`;

  const likeBtn = actions.querySelector(".feed-like-btn");
  likeBtn.classList.toggle("is-liked", post.likedByMe);
  likeBtn.addEventListener("click", () => {
    post.likedByMe = !post.likedByMe;
    post.likeCount += post.likedByMe ? 1 : -1;
    updatePost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    likeBtn.classList.toggle("is-liked", post.likedByMe);
    likesEl.innerHTML = likesHtml();
  });

  actions.querySelector(".feed-comment-btn").addEventListener("click", () => openCommentSheet(post.id));
  const bookmarkBtn = actions.querySelector(".feed-bookmark-btn");
  bookmarkBtn.classList.toggle("is-bookmarked", post.bookmarkedByMe);
  bookmarkBtn.addEventListener("click", () => {
    post.bookmarkedByMe = !post.bookmarkedByMe;
    updatePost(post.id, { bookmarkedByMe: post.bookmarkedByMe });
    bookmarkBtn.classList.toggle("is-bookmarked", post.bookmarkedByMe);
    showToast(post.bookmarkedByMe ? "북마크에 저장했어요" : "북마크에서 삭제했어요");
  });
  article.appendChild(actions);

  function likesHtml() {
    const first = post.comments[0] ? displayName(post.comments[0].username) : "user";
    return `Liked by <b>${first}</b> and ${formatCount(post.likeCount)} others`;
  }

  const likesEl = document.createElement("p");
  likesEl.className = "feed-likes";
  likesEl.innerHTML = likesHtml();
  article.appendChild(likesEl);

  const wordRow = document.createElement("div");
  wordRow.className = "feed-word-row";
  const posEn = POS_EN[post.pos] || "noun";
  wordRow.innerHTML = `
    <span class="feed-pos-tag">${posEn}</span>
    <span class="feed-word">${post.englishWord}</span>
    <button class="feed-viewmore">View more...</button>`;
  wordRow.querySelector(".feed-viewmore").addEventListener("click", () => goToPost(post.id));
  article.appendChild(wordRow);

  // 게시물이 만들어질 때(또는 마지막으로 보여준) 언어와 지금 학습 언어가 다르면
  // 그 자리에서 번역해서 보여줘요 — 데모 게시물이든 내가 만든 게시물이든 동일해요.
  translateLabelInto(post.englishWord, post.lang || "en", feedTargetLang, wordRow.querySelector(".feed-word"));

  return article;
}

function goToPost(id) {
  window.location.href = `post.html?id=${id}`;
}

function renderFeed() {
  const list = document.getElementById("feedList");
  const frag = document.createDocumentFragment();
  getFeedPosts().forEach((post) => frag.appendChild(createFeedCard(post)));
  list.innerHTML = "";
  list.appendChild(frag);
}

/* ---------- Comment sheet ---------- */
const overlay = document.getElementById("commentOverlay");
const commentList = document.getElementById("commentList");
const commentInput = document.getElementById("commentInput");
const btnCommentSend = document.getElementById("btnCommentSend");

let activePostId = null;

function openCommentSheet(postId) {
  activePostId = postId;
  renderComments();
  overlay.hidden = false;
}

function closeCommentSheet() {
  overlay.hidden = true;
  activePostId = null;
}

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeCommentSheet();
});

function personAvatarSvg() {
  return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
}

function heartSvg() {
  return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 2.6 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.4.5 5.1 3.8 3.6 7.2-2.1 4.7-9.6 9.3-9.6 9.3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
}

async function translateComment(comment, textEl, linkBtn) {
  if (comment.translation) {
    const showing = textEl.dataset.showingTranslation === "1";
    if (showing) {
      textEl.hidden = true;
      textEl.dataset.showingTranslation = "0";
      linkBtn.textContent = "번역 보기";
    } else {
      textEl.hidden = false;
      textEl.dataset.showingTranslation = "1";
      linkBtn.textContent = "번역 숨기기";
    }
    return;
  }
  linkBtn.textContent = "번역 중...";
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(comment.text)}&langpair=en|ko`
    );
    const data = await res.json();
    comment.translation = data.responseData.translatedText;
  } catch (e) {
    comment.translation = "번역을 불러오지 못했어요";
  }
  textEl.textContent = comment.translation;
  textEl.hidden = false;
  textEl.dataset.showingTranslation = "1";
  linkBtn.textContent = "번역 숨기기";
}

function renderComments() {
  const post = getPostById(activePostId);
  commentList.innerHTML = "";
  post.comments.forEach((comment, index) => {
    const item = document.createElement("div");
    item.className = "comment-item";

    const avatar = document.createElement("span");
    avatar.className = "comment-avatar";
    avatar.innerHTML = personAvatarSvg();
    item.appendChild(avatar);

    const body = document.createElement("div");
    body.className = "comment-body";

    const meta = document.createElement("div");
    meta.className = "comment-meta";
    meta.innerHTML = `<b>${displayName(comment.username)}</b>${comment.timeLabel || ""}`;
    body.appendChild(meta);

    const text = document.createElement("div");
    text.className = "comment-text";
    text.textContent = comment.text;
    body.appendChild(text);

    const translation = document.createElement("div");
    translation.className = "comment-translation";
    translation.hidden = true;
    body.appendChild(translation);

    const links = document.createElement("div");
    links.className = "comment-links";
    const replyBtn = document.createElement("button");
    replyBtn.className = "comment-link-btn";
    replyBtn.textContent = "답글 달기";
    replyBtn.addEventListener("click", () => {
      commentInput.value = `@${comment.username} `;
      commentInput.focus();
    });
    const translateBtn = document.createElement("button");
    translateBtn.className = "comment-link-btn";
    translateBtn.textContent = "번역 보기";
    translateBtn.addEventListener("click", () => translateComment(comment, translation, translateBtn));
    links.appendChild(replyBtn);
    links.appendChild(translateBtn);
    body.appendChild(links);

    item.appendChild(body);

    const likeBtn = document.createElement("button");
    likeBtn.className = "comment-like-btn";
    if (comment.liked) likeBtn.classList.add("is-liked");
    likeBtn.innerHTML = heartSvg();
    likeBtn.addEventListener("click", () => {
      comment.liked = !comment.liked;
      likeBtn.classList.toggle("is-liked", comment.liked);
      updatePost(post.id, { comments: post.comments });
    });
    item.appendChild(likeBtn);

    commentList.appendChild(item);
  });
}

function submitComment() {
  const text = commentInput.value.trim();
  if (!text || !activePostId) return;
  const post = getPostById(activePostId);
  post.comments.unshift({ username: "dorina", text, liked: false, timeLabel: "방금" });
  updatePost(post.id, { comments: post.comments });
  commentInput.value = "";
  renderComments();
  renderFeed();
}

btnCommentSend.addEventListener("click", submitComment);
commentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitComment();
});

/* ---------- More menu (bookmark / delete) ---------- */
const moreOverlay = document.getElementById("moreOverlay");
const btnBookmarkAction = document.getElementById("btnBookmarkAction");
const bookmarkActionLabel = document.getElementById("bookmarkActionLabel");
const btnDeleteAction = document.getElementById("btnDeleteAction");
const confirmOverlay = document.getElementById("confirmOverlay");
const btnConfirmDelete = document.getElementById("btnConfirmDelete");
const btnCancelDelete = document.getElementById("btnCancelDelete");

let moreTargetId = null;

function openMoreSheet(postId) {
  moreTargetId = postId;
  const post = getPostById(postId);
  bookmarkActionLabel.textContent = post.bookmarkedByMe ? "저장 취소" : "저장";
  moreOverlay.hidden = false;
}

function closeMoreSheet() {
  moreOverlay.hidden = true;
}

moreOverlay.addEventListener("click", (e) => {
  if (e.target === moreOverlay) closeMoreSheet();
});

btnBookmarkAction.addEventListener("click", () => {
  const post = getPostById(moreTargetId);
  const bookmarkedByMe = !post.bookmarkedByMe;
  updatePost(post.id, { bookmarkedByMe });
  closeMoreSheet();
  showToast(bookmarkedByMe ? "북마크에 저장했어요" : "북마크에서 삭제했어요");
  renderFeed();
});

btnDeleteAction.addEventListener("click", () => {
  closeMoreSheet();
  confirmOverlay.hidden = false;
});

confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) confirmOverlay.hidden = true;
});

btnCancelDelete.addEventListener("click", () => {
  confirmOverlay.hidden = true;
});

btnConfirmDelete.addEventListener("click", () => {
  deletePost(moreTargetId);
  confirmOverlay.hidden = true;
  renderFeed();
  showToast("게시물을 삭제했어요");
});

function setupNav() {
  document.querySelectorAll(".gnb-item").forEach((item) => {
    item.addEventListener("click", () => {
      const tab = item.dataset.tab;
      if (tab === "feed") return;
      if (tab === "home") {
        window.location.href = "index.html";
        return;
      }
      window.location.href = "mypage.html";
    });
  });
}

renderFeed();
setupNav();
