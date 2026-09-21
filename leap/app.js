const TILES = [
  { src: "assets/photos/tile-01.png", word: "커피", translit: "coffee", id: "seed-coffee" },
  { src: "assets/photos/tile-03.png", word: "카메라", translit: "camera", id: "seed-camera" },
  { src: "assets/photos/tile-05.png", word: "표지판", translit: "sign", id: "seed-sign" },
  { src: "assets/photos/tile-06.png", word: "구름", translit: "cloud", id: "seed-cloud" },
  { src: "assets/photos/tile-07.png", word: "친구", translit: "friend", id: "home-friend" },
  { src: "assets/photos/tile-08.png", word: "라떼아트", translit: "latte art", id: "home-latte1" },
  { src: "assets/photos/tile-09.png", word: "핸드백", translit: "handbag", id: "home-handbag" },
  { src: "assets/photos/tile-10.png", word: "책", translit: "book", id: "home-book" },
  { src: "assets/photos/tile-11.png", word: "도로표지판", translit: "road sign", id: "home-roadsign" },
  { src: "assets/photos/tile-13.png", word: "사과", translit: "apple", id: "seed-apple" },
  { src: "assets/photos/tile-15.png", word: "에코백", translit: "tote bag", id: "home-totebag" },
];

// 온보딩에서 고른 학습 언어. 저장된 값이 없으면 영어로 기본 동작해요.
const targetLang = localStorage.getItem("leaf:userLang") || "en";

// sourceLang: translit이 실제로 쓰여있는 언어예요. 데모 타일은 항상 "en", 내가 만든
// 게시물은 만들 때 학습하던 언어(post.lang)예요. 지금 학습 언어와 다르면 그 자리에서
// 번역해서 보여줘요 — 그래서 언어를 바꾸면 예전에 만든 게시물도 새 언어로 보여요.
function createTile(data, sourceLang) {
  const el = document.createElement("div");
  el.className = "tile";
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");

  if (data.mediaType === "video") {
    const video = document.createElement("video");
    video.className = "tile-photo";
    video.src = data.src;
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
    img.src = data.src;
    img.alt = data.word;
    img.loading = "lazy";
    el.appendChild(img);
  }

  if (data.word) {
    const badge = document.createElement("div");
    badge.className = "tile-word";
    const word = document.createElement("span");
    word.textContent = data.word;
    const translit = document.createElement("span");
    translit.className = "translit";
    translit.textContent = data.translit || "";
    badge.appendChild(word);
    badge.appendChild(translit);
    el.appendChild(badge);
    el.setAttribute("aria-label", `${data.word} (${data.translit || ""})`);
    if (sourceLang) translateLabelInto(data.translit, sourceLang, targetLang, translit);
  }

  const linkId = data.postId || data.id;
  if (linkId) {
    el.addEventListener("click", () => {
      window.location.href = `post.html?id=${linkId}`;
    });
  }

  return el;
}

function loadUserTiles() {
  return getPosts().map((post) => ({
    src: post.photo,
    mediaType: post.mediaType,
    word: post.koreanWord,
    translit: post.englishWord,
    postId: post.id,
    lang: post.lang || "en",
  }));
}

function renderGrid() {
  const grid = document.querySelector(".photo-grid");
  const frag = document.createDocumentFragment();
  loadUserTiles().forEach((t) => frag.appendChild(createTile(t, t.lang)));
  // 삭제된 게시물과 연결된 홈 타일은 걸러내요 (getPostById는 삭제된 게시물엔 null을 돌려줘요).
  TILES.filter((t) => !t.id || getPostById(t.id)).forEach((t) => frag.appendChild(createTile(t, "en")));
  grid.appendChild(frag);
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

function setupNav() {
  const items = document.querySelectorAll(".gnb-item");
  items.forEach((item) => {
    item.addEventListener("click", () => {
      const tab = item.dataset.tab;
      if (tab === "home") return;
      if (tab === "feed") {
        window.location.href = "feed.html";
        return;
      }
      window.location.href = "mypage.html";
    });
  });
}

function setupFab() {
  document.querySelector(".fab").addEventListener("click", () => {
    window.location.href = "camera.html";
  });
}

renderGrid();
setupNav();
setupFab();
