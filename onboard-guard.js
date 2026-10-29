// onboard-guard.js — 처음 접속한 사람은 온보딩(이름 · 배울 언어)부터 하도록 보내요.
//
// QR코드로 들어온 사람은 홈(index.html)으로 바로 열리기 때문에, 이 파일이 없으면 온보딩을
// 한 번도 거치지 않아요. 홈·피드·마이페이지·게시물 화면의 <head>에서 불러와요
// (본문이 그려지기 전에 이동해서 홈 화면이 잠깐 번쩍이지 않아요).
//
// - 이름(leaf:userName)과 언어(leaf:userLang)가 모두 저장돼 있어야 "온보딩을 마친 사람"이에요.
//   온보딩 마지막 단계에서 둘 다 저장돼요.
// - 브라우저가 저장을 막아둔 경우(시크릿 모드 등)엔 이동하지 않아요. 온보딩을 마쳐도 저장이
//   안 되니까, 이동하면 온보딩이 끝없이 반복돼요.
// - 다시 처음부터 보고 싶으면(내 폰에서 확인할 때) 주소 뒤에 ?reset 을 붙여 여세요.
//   예) https://dorinakim.github.io/leap/?reset — 이름·언어만 지우고 온보딩으로 가요
//   (올린 사진·댓글은 그대로예요).
(function () {
  try {
    if (/[?&]reset(&|=|$)/.test(location.search)) {
      localStorage.removeItem("leaf:userName");
      localStorage.removeItem("leaf:userLang");
    }
  } catch (e) {
    return;
  }
  try {
    const key = "leaf:onboardGuardProbe";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    if (localStorage.getItem("leaf:userName") && localStorage.getItem("leaf:userLang")) return;
  } catch (e) {
    return;
  }
  location.replace("onboarding.html");
})();
