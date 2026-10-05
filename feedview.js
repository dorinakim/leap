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
      <span class="action-count" hidden></span>
    </button>
    <button class="feed-action-btn feed-comment-btn" aria-label="댓글">
      <svg viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20l1.1-5.2A8.5 8.5 0 1 1 21 11.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      <span class="action-count" hidden></span>
    </button>
    <span class="feed-actions-spacer"></span>
    <button class="feed-action-btn feed-bookmark-btn" aria-label="북마크">
      <svg viewBox="0 0 24 24" fill="none"><path d="M6 4h12v16l-6-4-6 4V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
    </button>`;

  const likeBtn = actions.querySelector(".feed-like-btn");
  const likeCountEl = likeBtn.querySelector(".action-count");
  const commentCountEl = actions.querySelector(".feed-comment-btn .action-count");
  setActionCount(likeCountEl, post.likeCount);
  setActionCount(commentCountEl, getCommentCount(post));

  likeBtn.classList.toggle("is-liked", post.likedByMe);
  likeBtn.addEventListener("click", () => {
    post.likedByMe = !post.likedByMe;
    post.likeCount += post.likedByMe ? 1 : -1;
    updatePost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    likeBtn.classList.toggle("is-liked", post.likedByMe);
    setActionCount(likeCountEl, post.likeCount);
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
const commentReplyBanner = document.getElementById("commentReplyBanner");
const commentReplyBannerText = document.getElementById("commentReplyBannerText");
const btnCancelReply = document.getElementById("btnCancelReply");

let activePostId = null;
// 댓글창이 열려 있는 동안 쓰는 게시물 "한 벌". getPostById는 부를 때마다 새 복사본을 주기 때문에,
// 화면에 그려진 댓글(답글 대상)과 저장할 댓글이 서로 다른 복사본이면 답글이 저장에서 빠져요.
let activePost = null;

function openCommentSheet(postId) {
  activePostId = postId;
  activePost = getPostById(postId);
  cancelReply();
  commentInput.value = "";
  renderComments();
  overlay.hidden = false;
}

function closeCommentSheet() {
  overlay.hidden = true;
  activePostId = null;
  activePost = null;
}

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeCommentSheet();
});

// 댓글창을 아래로 스와이프하면 따라 내려가며 닫혀요.
enableSheetSwipeClose({
  overlay,
  sheet: document.getElementById("commentSheet"),
  scrollEl: commentList,
  onClose: closeCommentSheet,
});

function personAvatarSvg() {
  return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
}

function heartSvg() {
  return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 2.6 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.4.5 5.1 3.8 3.6 7.2-2.1 4.7-9.6 9.3-9.6 9.3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
}

// 댓글 한 줄(최상위 댓글이든 답글이든 같은 모양, 답글은 들여쓰기만 달라요).
// threadComment는 "답글 달기"를 눌렀을 때 답글이 실제로 쌓이는 최상위 댓글이에요 —
// 답글에 또 답글을 달아도 인스타그램처럼 한 단계(2depth)로 합쳐서 같은 스레드에 쌓여요.
function buildCommentItem(post, comment, threadComment, isReply) {
  const item = document.createElement("div");
  item.className = isReply ? "comment-item comment-item--reply" : "comment-item";

  const avatar = document.createElement("span");
  avatar.className = "comment-avatar";
  avatar.innerHTML = personAvatarSvg();
  item.appendChild(avatar);

  const body = document.createElement("div");
  body.className = "comment-body";

  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const nameEl = document.createElement("b");
  nameEl.textContent = displayName(comment.username);
  meta.appendChild(nameEl);
  meta.appendChild(document.createTextNode(comment.timeLabel || ""));
  body.appendChild(meta);

  const text = document.createElement("div");
  text.className = "comment-text";
  renderCommentText(text, comment);
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
  replyBtn.addEventListener("click", () => startReply(threadComment, comment.username));
  links.appendChild(replyBtn);
  // 번역은 맨 앞 @멘션을 뺀 "내용"만 대상으로 해요 — 멘션까지 번역기에 넣으면 @아이디가
  // 한글로 바뀌어요. 한글 댓글(내가 쓴 것 등)은 번역할 필요가 없어서 버튼을 아예 숨겨요.
  const { mention: leadMention, body: translatableText } = splitLeadingMention(comment);
  if (translatableText && !isMostlyKorean(translatableText)) {
    let translated = null;
    const showTranslation = () => {
      translation.textContent = "";
      if (leadMention) {
        const mentionSpan = document.createElement("span");
        mentionSpan.className = "comment-mention";
        mentionSpan.textContent = leadMention;
        translation.appendChild(mentionSpan);
        translation.appendChild(document.createTextNode(" "));
      }
      translation.appendChild(document.createTextNode(translated));
      translation.hidden = false;
    };
    const translateBtn = document.createElement("button");
    translateBtn.className = "comment-link-btn";
    translateBtn.textContent = "번역 보기";
    translateBtn.addEventListener("click", async () => {
      if (!translation.hidden) {
        translation.hidden = true;
        translateBtn.textContent = "번역 보기";
        return;
      }
      if (translated) {
        showTranslation();
        translateBtn.textContent = "번역 숨기기";
        return;
      }
      translateBtn.disabled = true;
      translateBtn.textContent = "번역 중...";
      const result = await translateText(translatableText, "en", "ko");
      translateBtn.disabled = false;
      if (!isUsableTranslation(translatableText, result)) {
        // 실패하면 빈 칸을 보여주지 않고 알려줘요 (다시 누르면 재시도)
        translateBtn.textContent = "번역 보기";
        showToast("번역에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      translated = result;
      showTranslation();
      translateBtn.textContent = "번역 숨기기";
    });
    links.appendChild(translateBtn);
  }
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

  return item;
}

function renderComments() {
  const post = activePost;
  commentList.innerHTML = "";
  post.comments.forEach((comment) => {
    // 댓글 + 그 아래 답글들을 한 묶음으로 만들어요 (답글이 항상 부모 댓글 바로 아래에 와요)
    const thread = document.createElement("div");
    thread.className = "comment-thread";
    thread.appendChild(buildCommentItem(post, comment, comment, false));
    (comment.replies || []).forEach((reply) => {
      thread.appendChild(buildCommentItem(post, reply, comment, true));
    });
    commentList.appendChild(thread);
  });
}

// ---------- 답글 달기 ----------
// 지금 답글을 다는 대상(최상위 댓글). null이면 새 최상위 댓글을 쓰는 중이에요.
let replyingTo = null;
// 답글 맨 앞에 붙는 @멘션 이름 — 실제로 "답글 달기"를 누른 그 댓글의 작성자예요.
let replyMention = "";

function startReply(threadComment, mentionUsername) {
  replyingTo = threadComment;
  replyMention = displayName(mentionUsername || threadComment.username);
  commentReplyBannerText.textContent = `${replyMention}님에게 답글 남기는 중`;
  commentReplyBanner.hidden = false;
  commentInput.value = `@${replyMention} `;
  commentInput.focus();
  const len = commentInput.value.length;
  commentInput.setSelectionRange(len, len);
}

function cancelReply() {
  replyingTo = null;
  replyMention = "";
  commentReplyBanner.hidden = true;
}

btnCancelReply.addEventListener("click", () => {
  cancelReply();
  commentInput.value = "";
});

function submitComment() {
  const text = commentInput.value.trim();
  if (!text || !activePost) return;
  const post = activePost;
  const newComment = { username: "dorina", text, liked: false, timeLabel: "방금", replies: [] };
  if (replyingTo) {
    // 멘션한 이름을 같이 저장해두면 한글 이름이나 공백이 있는 이름도 색을 정확히 칠할 수 있어요.
    if (replyMention && text.startsWith("@" + replyMention)) newComment.mention = replyMention;
    if (!replyingTo.replies) replyingTo.replies = [];
    replyingTo.replies.push(newComment); // 부모 댓글 아래에 쌓여요
  } else {
    post.comments.unshift(newComment);
  }
  updatePost(post.id, { comments: post.comments });
  cancelReply();
  commentInput.value = "";
  renderComments();
  renderFeed();
  // 새 댓글은 맨 위에, 답글은 부모 댓글 아래에 생기니까 위로 올려서 방금 쓴 게 보이게 해요.
  if (!newComment.mention) commentList.scrollTop = 0;
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
