// 온보딩에서 고른 학습 언어. 저장된 값이 없으면 영어로 기본 동작해요.
const searchTargetLang = localStorage.getItem("leaf:userLang") || "en";

function createSearchTile(post) {
  const el = document.createElement("div");
  el.className = "tile";
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", `${post.koreanWord} (${post.englishWord})`);

  if (post.mediaType === "video") {
    const video = document.createElement("video");
    video.className = "tile-photo";
    video.src = post.photo;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    el.appendChild(video);
    const badge = document.createElement("span");
    badge.className = "media-play-badge";
    badge.textContent = "▶";
    el.appendChild(badge);
  } else {
    const img = document.createElement("img");
    img.className = "tile-photo";
    img.src = post.photo;
    img.alt = post.koreanWord;
    img.loading = "lazy";
    el.appendChild(img);
  }

  const badge = document.createElement("div");
  badge.className = "tile-word";
  const word = document.createElement("span");
  word.textContent = post.koreanWord;
  const translit = document.createElement("span");
  translit.className = "translit";
  translit.textContent = post.englishWord || "";
  badge.appendChild(word);
  badge.appendChild(translit);
  el.appendChild(badge);
  // 게시물이 만들어질 때(또는 마지막으로 보여준) 언어와 지금 학습 언어가 다르면
  // 그 자리에서 번역해서 보여줘요 — 데모 게시물이든 내가 만든 게시물이든 동일해요.
  translateLabelInto(post.englishWord, post.lang || "en", searchTargetLang, translit);

  el.addEventListener("click", () => {
    window.location.href = `post.html?id=${post.id}`;
  });

  return el;
}

function setupSearch(inputEl, primaryEl, resultsEl) {
  if (!inputEl || !primaryEl || !resultsEl) return;

  function render(query) {
    const q = query.trim().toLowerCase();

    if (!q) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      primaryEl.hidden = false;
      return;
    }

    const matches = getFeedPosts().filter((post) => {
      const ko = (post.koreanWord || "").toLowerCase();
      const en = (post.englishWord || "").toLowerCase();
      return ko.includes(q) || en.includes(q);
    });

    primaryEl.hidden = true;
    resultsEl.hidden = false;
    resultsEl.innerHTML = "";

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = `'${query}'에 대한 검색 결과가 없어요`;
      resultsEl.appendChild(empty);
      return;
    }

    matches.forEach((post) => resultsEl.appendChild(createSearchTile(post)));
  }

  inputEl.addEventListener("input", () => render(inputEl.value));
}

setupSearch(
  document.getElementById("searchInput"),
  document.getElementById("photoGrid") || document.getElementById("feedList"),
  document.getElementById("searchGrid")
);
