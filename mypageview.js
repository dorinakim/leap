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

const CURRENT_USER = "dorina";
let activeTab = "posts";

document.querySelector(".mypage-title").textContent = displayName(CURRENT_USER);
document.getElementById("mypageFlag").textContent = getLangMeta(localStorage.getItem("leaf:userLang") || "en").flag;

function myPosts() {
  return getFeedPosts()
    .filter((p) => p.username === CURRENT_USER)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function myBookmarks() {
  return getFeedPosts()
    .filter((p) => p.bookmarkedByMe)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function renderGrid() {
  const grid = document.getElementById("mypageGrid");
  grid.innerHTML = "";
  const list = activeTab === "posts" ? myPosts() : myBookmarks();

  document.getElementById("statPosts").textContent = myPosts().length;

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "mypage-empty";
    empty.textContent =
      activeTab === "posts" ? "아직 등록한 포스트가 없어요" : "북마크한 포스트가 없어요";
    grid.appendChild(empty);
    return;
  }

  list.forEach((post) => grid.appendChild(createSearchTile(post)));
}

function setupTabs() {
  document.querySelectorAll(".mypage-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.tab === activeTab) return;
      activeTab = tab.dataset.tab;
      document.querySelectorAll(".mypage-tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      renderGrid();
    });
  });
}

function setupNav() {
  document.querySelectorAll(".gnb-item").forEach((item) => {
    item.addEventListener("click", () => {
      const tab = item.dataset.tab;
      if (tab === "my") return;
      window.location.href = tab === "home" ? "index.html" : "feed.html";
    });
  });
}

document.getElementById("btnFab").addEventListener("click", () => {
  window.location.href = "camera.html";
});

document.getElementById("btnEditProfile").addEventListener("click", () => {
  showToast("프로필 편집은 준비 중이에요");
});

document.getElementById("btnShareProfile").addEventListener("click", () => {
  showToast("프로필 공유는 준비 중이에요");
});

document.getElementById("btnAddFriend").addEventListener("click", () => {
  showToast("친구 추가는 준비 중이에요");
});

renderGrid();
setupTabs();
setupNav();
