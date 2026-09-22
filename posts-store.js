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

function savePosts(posts) {
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  } catch (e) {
    /* storage unavailable or full */
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

function addPost(post) {
  const posts = getPosts();
  posts.unshift(post);
  savePosts(posts);
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
