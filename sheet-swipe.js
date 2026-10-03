// 아래에서 올라오는 시트(댓글창 등)를 아래로 스와이프하면 손가락을 따라 내려가다가
// 일정 이상 내리면 아래로 쑥 내려가며 닫혀요. 조금만 내리고 놓으면 제자리로 돌아와요.
//
// - 터치: 시트 어디서든 시작할 수 있어요. 단, 목록(scrollEl) 안에서 시작하면 목록이
//   맨 위까지 스크롤된 상태일 때만 시트를 끌어요(그 전엔 평소처럼 목록이 스크롤돼요).
// - 마우스(데스크톱): 텍스트 선택과 겹치지 않도록 손잡이·제목 영역에서만 끌 수 있어요.
// - 입력창에서 시작한 제스처는 커서 이동/텍스트 선택이라 무시해요.
function enableSheetSwipeClose({ overlay, sheet, scrollEl, onClose }) {
  const START_SLOP = 8; // px — 이 정도 움직여야 "끌기"로 인정해요
  const CLOSE_DISTANCE = 100; // px — 이만큼 이상 내리면 닫아요
  const CLOSE_VELOCITY = 0.5; // px/ms — 빠르게 휙 내리면 거리가 짧아도 닫아요
  const CLOSE_MIN_DISTANCE_FOR_FLICK = 30; // px — 휙 내릴 때도 최소한 이만큼은 내려야 해요
  const ANIM_MS = 220;

  let tracking = false; // 제스처 후보(끌기가 될 수도 있는 상태)
  let dragging = false; // 실제로 시트를 끌고 있는 상태
  let fromScroll = false;
  let startY = 0;
  let startT = 0;
  let originY = 0; // 끌기가 시작된 지점(여기서부터 거리를 재요)
  let mouseActive = false;
  let swallowClick = false;

  function resetStyles() {
    sheet.style.transition = "";
    sheet.style.transform = "";
    overlay.style.transition = "";
    overlay.style.background = "";
  }

  function onStart(y, target, allowFromScroll) {
    tracking = false;
    dragging = false;
    if (target.closest("input, textarea")) return;
    fromScroll = !!(scrollEl && scrollEl.contains(target));
    if (fromScroll) {
      if (!allowFromScroll || scrollEl.scrollTop > 0) return;
    }
    tracking = true;
    startY = y;
    startT = performance.now();
  }

  function onMove(y, e) {
    if (!tracking) return;
    if (!dragging) {
      const dy = y - startY;
      if (dy < -START_SLOP) {
        tracking = false; // 위로 올리는 건 목록 스크롤이니 포기
        return;
      }
      if (dy < START_SLOP) return;
      if (fromScroll && scrollEl.scrollTop > 0) {
        tracking = false;
        return;
      }
      dragging = true;
      originY = y;
      sheet.style.transition = "none";
      overlay.style.transition = "none";
    }
    if (e.cancelable) e.preventDefault();
    const offset = Math.max(0, y - originY);
    sheet.style.transform = `translateY(${offset}px)`;
    const height = sheet.offsetHeight || 1;
    overlay.style.background = `rgba(0, 0, 0, ${0.5 * Math.max(0, 1 - offset / height)})`;
  }

  function onEnd(y) {
    if (!dragging) {
      tracking = false;
      return;
    }
    const dy = y - originY;
    const velocity = (y - startY) / Math.max(1, performance.now() - startT);
    tracking = false;
    dragging = false;
    swallowClick = true; // 끌고 나서 손을 뗄 때 버튼이 눌리는 걸 막아요
    setTimeout(() => (swallowClick = false), 0);

    const shouldClose =
      dy > CLOSE_DISTANCE || (velocity > CLOSE_VELOCITY && dy > CLOSE_MIN_DISTANCE_FOR_FLICK);
    sheet.style.transition = `transform ${ANIM_MS}ms ease`;
    overlay.style.transition = `background ${ANIM_MS}ms ease`;
    if (shouldClose) {
      sheet.style.transform = "translateY(100%)";
      overlay.style.background = "rgba(0, 0, 0, 0)";
      setTimeout(() => {
        resetStyles(); // 다음에 열 때 깨끗한 상태로 시작하도록
        onClose();
      }, ANIM_MS);
    } else {
      sheet.style.transform = "translateY(0)";
      overlay.style.background = ""; // CSS 기본 배경으로 복귀
      setTimeout(resetStyles, ANIM_MS);
    }
  }

  function onCancel() {
    if (dragging) {
      sheet.style.transition = `transform ${ANIM_MS}ms ease`;
      sheet.style.transform = "translateY(0)";
      setTimeout(resetStyles, ANIM_MS);
    }
    tracking = false;
    dragging = false;
  }

  // 터치
  sheet.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return onCancel();
      onStart(e.touches[0].clientY, e.target, true);
    },
    { passive: true }
  );
  sheet.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length !== 1) return;
      onMove(e.touches[0].clientY, e);
    },
    { passive: false }
  );
  sheet.addEventListener("touchend", (e) => onEnd(e.changedTouches[0].clientY));
  sheet.addEventListener("touchcancel", onCancel);

  // 마우스 (데스크톱) — 손잡이·제목 영역에서만
  sheet.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseActive = true;
    onStart(e.clientY, e.target, false);
  });
  window.addEventListener("mousemove", (e) => {
    if (mouseActive) onMove(e.clientY, e);
  });
  window.addEventListener("mouseup", (e) => {
    if (!mouseActive) return;
    mouseActive = false;
    onEnd(e.clientY);
  });

  // 끌기가 끝난 직후 발생하는 클릭은 무시 (예: 하트 버튼 위에서 끌기 시작한 경우)
  sheet.addEventListener(
    "click",
    (e) => {
      if (!swallowClick) return;
      e.stopPropagation();
      e.preventDefault();
    },
    true
  );
}
