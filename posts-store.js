const POSTS_KEY = "leaf:posts";
const SEED_OVERRIDES_KEY = "leaf:seedOverrides";

function getPosts() {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// 번역/사전 결과를 빨리 보여주려고 쌓아두는 캐시들 — 지워도 다음에 다시 만들어지니까,
// 저장 공간이 모자랄 때 가장 먼저 비워도 안전해요.
const REGENERABLE_CACHE_KEYS = ["leaf:postLangCacheV2", "leaf:translitCacheV2"];

// 저장에 성공하면 true, 공간 부족 등으로 실패하면 false를 돌려줘요.
// (예전엔 실패를 조용히 삼켜서, 등록이 안 됐는데도 성공한 것처럼 보였어요.)
function savePosts(posts) {
  const json = JSON.stringify(posts);
  try {
    localStorage.setItem(POSTS_KEY, json);
    return true;
  } catch (e) {
    // 공간이 모자라면 다시 만들 수 있는 캐시부터 비우고 한 번 더 시도해요.
    REGENERABLE_CACHE_KEYS.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (e2) {
        /* ignore */
      }
    });
    try {
      localStorage.setItem(POSTS_KEY, json);
      return true;
    } catch (e3) {
      return false;
    }
  }
}

function getCurrentUserName() {
  try {
    return localStorage.getItem("leaf:userName") || "dorina";
  } catch (e) {
    return "dorina";
  }
}

function displayName(username) {
  return username === "dorina" ? getCurrentUserName() : username;
}

// "dorina"는 항상 나(현재 사용자)를 가리키는 내부 식별자예요.
function isMyPost(post) {
  return post.username === "dorina";
}

const AVATAR_COLORS = { dorina: "#1f9d63", nana: "#3b6fd6" };

function avatarColor(username) {
  if (AVATAR_COLORS[username]) return AVATAR_COLORS[username];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

// 저장에 성공했는지(true/false)를 돌려줘요 — 호출하는 쪽에서 실패를 알려줄 수 있게요.
function addPost(post) {
  const posts = getPosts();
  posts.unshift(post);
  return savePosts(posts);
}

function deletePost(id) {
  const posts = getPosts();
  const idx = posts.findIndex((p) => p.id === id);
  if (idx !== -1) {
    posts.splice(idx, 1);
    savePosts(posts);
    return;
  }
  saveSeedOverride(id, { deleted: true });
}

function getSeedOverrides() {
  try {
    const raw = localStorage.getItem(SEED_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveSeedOverride(id, patch) {
  const overrides = getSeedOverrides();
  overrides[id] = { ...overrides[id], ...patch };
  try {
    localStorage.setItem(SEED_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    /* storage unavailable or full */
  }
}

function withSeedOverride(seedPost) {
  const override = getSeedOverrides()[seedPost.id];
  return override ? { ...seedPost, ...override } : { ...seedPost };
}

function getSeedPosts() {
  return SEED_POSTS.map(withSeedOverride).filter((p) => !p.deleted);
}

function getFeedPosts() {
  return [...getSeedPosts(), ...getPosts()].sort((a, b) => b.createdAt - a.createdAt);
}

function getPostById(id) {
  const userPost = getPosts().find((p) => p.id === id);
  if (userPost) return userPost;
  const seedPost = SEED_POSTS.find((p) => p.id === id);
  if (!seedPost) return null;
  const merged = withSeedOverride(seedPost);
  return merged.deleted ? null : merged;
}

// ---------- 좋아요/댓글 개수 표시 (피드 · 게시물 상세 공용) ----------

// 댓글 총 개수 — 인스타그램처럼 답글도 같이 세요.
function getCommentCount(post) {
  return (post.comments || []).reduce((sum, c) => sum + 1 + (c.replies || []).length, 0);
}

// ---------- 댓글 본문의 @멘션 (피드 · 게시물 상세 공용) ----------
// 답글 맨 앞의 "@아이디"는 색을 바꿔서, 어디까지가 계정 이름이고 어디부터가 내용인지
// 한눈에 보이게 해요 (CSS의 .comment-mention).
//  - comment.mention: 답글을 쓸 때 저장해둔 "멘션한 사람 이름". 글자만 보고 추측하면
//    한글 이름이나 공백이 있는 이름("김 도리나")은 어디서 끝나는지 알 수 없어서, 저장해둔
//    길이만큼만 정확히 색을 바꿔요.
//  - 그 밖에 직접 입력한 @아이디(영문·숫자·점·밑줄)도 같은 색으로 보여줘요.
function renderCommentText(el, comment) {
  el.textContent = "";
  let rest = comment.text || "";
  const addText = (s) => {
    if (s) el.appendChild(document.createTextNode(s));
  };
  const addMention = (s) => {
    const span = document.createElement("span");
    span.className = "comment-mention";
    span.textContent = s;
    el.appendChild(span);
  };

  if (comment.mention && rest.startsWith("@" + comment.mention)) {
    addMention("@" + comment.mention);
    rest = rest.slice(comment.mention.length + 1);
  }

  // 앞 글자가 아이디에 쓰이는 글자면(예: 이메일 a@b.com) 멘션이 아니에요.
  const re = /(^|[^A-Za-z0-9._@])(@[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(rest))) {
    addText(rest.slice(last, m.index + m[1].length));
    addMention(m[2]);
    last = m.index + m[0].length;
  }
  addText(rest.slice(last));
}

// 댓글을 "맨 앞 멘션"과 "나머지 내용"으로 나눠요 — 번역할 땐 내용만 번역해야 @아이디가
// 한글로 바뀌어 버리는 일이 없어요.
function splitLeadingMention(comment) {
  const text = comment.text || "";
  if (comment.mention && text.startsWith("@" + comment.mention)) {
    return { mention: "@" + comment.mention, body: text.slice(comment.mention.length + 1).trim() };
  }
  const m = text.match(/^(@[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*/);
  return m ? { mention: m[1], body: text.slice(m[0].length) } : { mention: "", body: text };
}

// 한글이 대부분인 텍스트는(예: 내가 한국어로 쓴 댓글) 번역해봐야 의미가 없어서
// "번역 보기"를 아예 숨겨요. (피드 · 게시물 상세 공용)
function isMostlyKorean(text) {
  const hangul = (text.match(/[가-힣]/g) || []).length;
  return text.length > 0 && hangul / text.length > 0.3;
}

// 아이콘 옆에 붙는 짧은 숫자 표기 (1,234 → 1.2천, 20,531 → 2.1만). 큰 숫자가
// 아이콘 옆에서 길게 늘어나지 않도록 축약해요.
const compactCountFormatter = (() => {
  try {
    return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
  } catch (e) {
    return null; // 오래된 브라우저는 축약 없이 쉼표 표기로 대체
  }
})();

function formatCompactCount(n) {
  return compactCountFormatter ? compactCountFormatter.format(n) : n.toLocaleString("ko-KR");
}

// 하트/말풍선 아이콘 옆 숫자 칸을 채워요. 0이면 인스타그램처럼 숫자를 숨겨요.
function setActionCount(el, n) {
  const show = n > 0;
  el.textContent = show ? formatCompactCount(n) : "";
  el.hidden = !show;
}

function updatePost(id, patch) {
  const posts = getPosts();
  const idx = posts.findIndex((p) => p.id === id);
  if (idx !== -1) {
    posts[idx] = { ...posts[idx], ...patch };
    savePosts(posts);
    return posts[idx];
  }
  const seedPost = SEED_POSTS.find((p) => p.id === id);
  if (seedPost) {
    saveSeedOverride(id, patch);
    return withSeedOverride(seedPost);
  }
  return null;
}

const SEED_COMMENTS = [
  { username: "minsu_k", text: "이 단어 발음 진짜 도움 많이 됐어요!", liked: false, timeLabel: "3시간" },
  { username: "yuki.eng", text: "사진이랑 같이 보니까 훨씬 잘 외워져요", liked: false, timeLabel: "1시간" },
  { username: "hana_study", text: "저도 오늘 이 단어 배웠어요 ㅎㅎ", liked: false, timeLabel: "10분" },
];

function createPost({
  photo,
  mediaType,
  koreanWord,
  englishWord,
  lang,
  phonetic,
  pos,
  idioms,
  etymology,
  definitions,
  synonyms,
  antonyms,
  examples,
  conversation,
}) {
  return {
    id: Date.now().toString(36),
    username: "dorina",
    photo,
    mediaType: mediaType || "image",
    koreanWord,
    englishWord,
    lang: lang || "en",
    phonetic: phonetic || "",
    pos: pos || "",
    idioms: idioms || [],
    etymology: etymology || "",
    definitions: definitions || [],
    synonyms: synonyms || [],
    antonyms: antonyms || [],
    examples: examples || [],
    conversation: conversation || [],
    createdAt: Date.now(),
    likeCount: Math.floor(Math.random() * 150000) + 800000,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: SEED_COMMENTS.map((c) => ({ ...c })),
  };
}

// Demo feed content, seeded once so the feed isn't empty on a fresh install.
const SEED_POSTS = [
  {
    id: "seed-apple",
    username: "dorina",
    photo: "assets/feed/apple.png",
    koreanWord: "사과",
    englishWord: "apple",
    phonetic: "/ˈæp.əl/",
    pos: "명사",
    idioms: [
      {
        phrase: "apples and oranges",
        gloss: "서로 전혀 다른 두 사람[가지], 천양지차",
        example: "They really are apples and oranges.",
        exampleGloss: "그들은 정말 천양지차로 다르다.",
      },
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 1,
    likeCount: 905235,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "thekamraan", text: "Beautiful shot of the apple!", liked: false, timeLabel: "3일" },
      { username: "travelbug99", text: "The crispness of apples makes them perfect for autumn snacks.", liked: false, timeLabel: "45분" },
      { username: "greenleaf123", text: "I love making homemade apple pie with fresh cinnamon.", liked: false, timeLabel: "30분" },
    ],
  },
  {
    id: "seed-bookstore",
    username: "nana",
    photo: "assets/feed/bookstore.png",
    koreanWord: "서점",
    englishWord: "bookstore",
    phonetic: "/ˈbʊk.stɔːr/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    likeCount: 905235,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "thekamraan", text: "This bookstore looks so cozy.", liked: false, timeLabel: "2일" },
      { username: "readerholic", text: "I could spend all day in a place like this.", liked: false, timeLabel: "5시간" },
    ],
  },
  {
    id: "seed-sightseeing",
    username: "dorina",
    photo: "assets/feed/sightseeing.png",
    koreanWord: "관광",
    englishWord: "sightseeing",
    phonetic: "/ˈsaɪt.siː.ɪŋ/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    likeCount: 905235,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "thekamraan", text: "What a view! Where is this?", liked: false, timeLabel: "1일" },
      { username: "wanderluster", text: "Adding this spot to my travel list.", liked: false, timeLabel: "6시간" },
    ],
  },
  {
    id: "seed-elephant",
    username: "nana",
    photo: "assets/feed/elephant.png",
    koreanWord: "코끼리",
    englishWord: "elephant",
    phonetic: "/ˈel.ɪ.fənt/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 4,
    likeCount: 905235,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "thekamraan", text: "The sunset light on this is stunning.", liked: false, timeLabel: "5시간" },
      { username: "safarifan", text: "Elephants are so majestic at golden hour.", liked: false, timeLabel: "2시간" },
    ],
  },
  {
    id: "seed-camera",
    username: "dorina",
    photo: "assets/profile/mypage-camera.png",
    koreanWord: "카메라",
    englishWord: "camera",
    phonetic: "/ˈkæm.rə/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    likeCount: 12045,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "filmcollector", text: "A Rolleiflex! Beautiful piece of gear.", liked: false, timeLabel: "4일" },
    ],
  },
  {
    id: "seed-cloud",
    username: "nana",
    photo: "assets/profile/mypage-cloud.png",
    koreanWord: "구름",
    englishWord: "cloud",
    phonetic: "/klaʊd/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
    likeCount: 15302,
    likedByMe: false,
    bookmarkedByMe: true,
    comments: [
      { username: "skywatcher", text: "That blue is unreal today.", liked: false, timeLabel: "6일" },
    ],
  },
  {
    id: "seed-bedroom",
    username: "nana",
    photo: "assets/profile/mypage-bedroom.png",
    koreanWord: "침실",
    englishWord: "bedroom",
    phonetic: "/ˈbed.ruːm/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    likeCount: 9820,
    likedByMe: false,
    bookmarkedByMe: true,
    comments: [
      { username: "homedecorfan", text: "So cozy and minimal, I love it.", liked: false, timeLabel: "1주" },
    ],
  },
  {
    id: "seed-sign",
    username: "nana",
    photo: "assets/profile/mypage-sign.png",
    koreanWord: "표지판",
    englishWord: "sign",
    phonetic: "/saɪn/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
    likeCount: 4110,
    likedByMe: false,
    bookmarkedByMe: true,
    comments: [
      { username: "citywalker", text: "Good reminder to look at signs carefully!", liked: false, timeLabel: "1주" },
    ],
  },
  {
    id: "seed-coffee",
    username: "nana",
    photo: "assets/profile/mypage-coffee.png",
    koreanWord: "커피",
    englishWord: "coffee",
    phonetic: "/ˈkɒf.i/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
    likeCount: 20531,
    likedByMe: false,
    bookmarkedByMe: true,
    comments: [
      { username: "morningperson", text: "Need this first thing every morning.", liked: false, timeLabel: "1주" },
    ],
  },
  {
    id: "home-friend",
    username: "nana",
    photo: "assets/photos/tile-07.png",
    koreanWord: "친구",
    englishWord: "friend",
    phonetic: "/frend/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 11,
    likeCount: 18420,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "goodvibes_kr", text: "This is such a warm moment.", liked: false, timeLabel: "1주" },
    ],
  },
  {
    id: "home-latte1",
    username: "nana",
    photo: "assets/photos/tile-08.png",
    koreanWord: "라떼아트",
    englishWord: "latte art",
    phonetic: "/ˈlɑː.teɪ ɑːrt/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
    likeCount: 9310,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "cafehopper", text: "That leaf pattern is perfect.", liked: false, timeLabel: "2주" },
    ],
  },
  {
    id: "home-handbag",
    username: "nana",
    photo: "assets/photos/tile-09.png",
    koreanWord: "핸드백",
    englishWord: "handbag",
    phonetic: "/ˈhænd.bæɡ/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 13,
    likeCount: 5032,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "minimaliststyle", text: "Simple and elegant.", liked: false, timeLabel: "2주" },
    ],
  },
  {
    id: "home-book",
    username: "nana",
    photo: "assets/photos/tile-10.png",
    koreanWord: "책",
    englishWord: "book",
    phonetic: "/bʊk/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    likeCount: 11210,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "poetry_lover", text: "This collection changed how I read poetry.", liked: false, timeLabel: "2주" },
    ],
  },
  {
    id: "home-roadsign",
    username: "nana",
    photo: "assets/photos/tile-11.png",
    koreanWord: "도로표지판",
    englishWord: "road sign",
    phonetic: "/roʊd saɪn/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
    likeCount: 3140,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "roadtripper", text: "Careful on that curve ahead!", liked: false, timeLabel: "2주" },
    ],
  },
  {
    id: "home-totebag",
    username: "nana",
    photo: "assets/photos/tile-15.png",
    koreanWord: "에코백",
    englishWord: "tote bag",
    phonetic: "/toʊt bæɡ/",
    pos: "명사",
    idioms: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 18,
    likeCount: 4590,
    likedByMe: false,
    bookmarkedByMe: false,
    comments: [
      { username: "totewalker", text: "Great for everyday errands.", liked: false, timeLabel: "3주" },
    ],
  },
];
