// notice.js — 홈·피드·마이페이지를 구경하는 중에 위에서 내려오는 알림 배너 (데모용)
//
// 언제 울리나요? ("한 번 사용할 때" = 앱을 열고 닫기 전까지. 탭을 닫거나 30분 넘게 비우면 새로 시작)
// - 첫 알림: 앱에 들어와서 홈·피드·마이페이지를 본 시간이 합쳐서 30초가 되면 울려요.
// - 두 번째부터: 직전 알림이 울린 때부터 1~2분(알림마다 1분~2분 사이 무작위) 뒤에 울려요.
// - 한 번 사용할 때 최대 3번까지만 울려요.
// - 탭·스크롤을 해도 시간은 리셋되지 않아요(예전 "가만히 있는 시간" 방식은 구경하는 동안
//   계속 리셋돼서 거의 안 울렸어요). 화면을 옮겨도(홈→피드 등) 시간이 이어져요 — 진행 상황을
//   sessionStorage에 저장하기 때문이에요.
// - 홈·피드·마이페이지에서만 시간이 쌓여요. 사진을 올리는 화면(카메라·단어 선택·사전·수정),
//   게시물 상세, 온보딩에선 이 파일을 불러오지 않아서 그 시간은 세지 않아요.
// - 화면이 안 보이는 동안(다른 앱/탭)도 세지 않아요.
// - 위 세 화면 안에서도 댓글창·더보기 같은 팝업이 열려 있거나 글자를 입력하는 중이면 울리지
//   않아요 (isUserBusy). 시간이 됐어도 그 상태가 끝나면 바로 울려요.
//
// 어떻게 보이나요?
// - 위에서 아래로 내려오면서 벨이 울리고(진동을 지원하는 기기에선 진동도), 울린 지 3초 뒤에
//   다시 위로 올라가며 사라져요. 배너를 누르면 바로 올라가요. 문구는 3개 중 무작위예요.
//   * 브라우저는 "사용자가 화면을 한 번이라도 탭한 뒤"에만 소리/진동을 허용해요(자동재생 정책).
//   * 웹에서는 폰의 무음/진동 모드를 읽을 수 없어요. 아이폰은 무음 스위치를 켜면 웹 오디오가
//     자동으로 꺼지지만, 아이폰은 웹에서 진동을 낼 수 없어요(안드로이드 크롬은 가능).
//
// 폰에서 빨리 확인하려면: 주소 뒤에 ?notice=5 를 붙여 열면 "5초 구경할 때마다" 울려요(최대 3번은
//   그대로). 화면을 한 번 탭해야 소리가 나요. 되돌리려면 ?notice=off 로 한 번 여세요.
// 안 울리는 이유를 확인하려면: 주소 뒤에 ?notice=debug 를 붙여 열면 화면 왼쪽 아래에 상태가
//   실시간으로 보여요(울린 횟수, 쌓인 시간, 방해 상태, 소리). ?notice=off 로 끄세요.
(function () {
  const FIRST_MS = 30 * 1000; // 첫 알림: 구경한 지 30초
  const NEXT_MIN_MS = 1 * 60 * 1000; // 두 번째부터: 직전 알림 뒤 1분 ~
  const NEXT_MAX_MS = 2 * 60 * 1000; // ~ 2분 사이에서 무작위
  const MAX_ALERTS = 3; // 한 번 사용할 때 최대 횟수
  const SESSION_GAP_MS = 30 * 60 * 1000; // 이만큼 비어 있으면 "새로 사용"으로 봐요
  const VISIBLE_MS = 3000; // 울린(=내려오기 시작한) 뒤 이 시간이 지나면 위로 올라가요
  const LEAVE_MS = 450; // 올라가는 애니메이션이 끝나 DOM에서 지우기까지의 시간
  const VIBRATE_PATTERN = [200, 100, 200]; // 진동: 웅-쉬-웅
  const SESSION_KEY = "leaf:noticeSession"; // 이번 사용의 진행 상황 (탭 단위로 유지)
  const FAST_OVERRIDE_KEY = "leaf:noticeFastSec"; // 테스트용 (?notice=5)
  const LAST_MSG_KEY = "leaf:noticeLastIndex";

  const MESSAGES = [
    () => "오늘 하루의 단어를 채워보세요!",
    () => `지금 ${getCurrentUserName()}님의 주변은 어떤 모습인가요?`,
    () => "다른 사람의 피드에 댓글을 달아주세요",
  ];

  // ---------- 스타일 (이 파일 하나로 끝나도록 직접 넣어요) ----------
  function injectStyle() {
    if (document.getElementById("leaf-notice-style")) return;
    const style = document.createElement("style");
    style.id = "leaf-notice-style";
    style.textContent = `
      .leaf-notice {
        position: fixed;
        /* 목업 기준: 상태바 바로 아래에서 13px 떨어진 위치 (홈 화면 앱 모드에선 상태바 높이만큼 내려와요) */
        top: calc(env(safe-area-inset-top, 0px) + 13px);
        left: 50%;
        width: calc(100% - 16px);
        max-width: 504px;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: #eaf4f2;
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
        cursor: pointer;
        opacity: 0;
        transform: translate(-50%, -140%);
        /* 올라가며 사라질 때(기본 상태로 돌아갈 때): 처음엔 천천히, 갈수록 빨리 */
        transition: transform 0.35s cubic-bezier(0.4, 0, 1, 1), opacity 0.3s ease-in;
        -webkit-tap-highlight-color: transparent;
      }
      .leaf-notice.is-visible {
        opacity: 1;
        transform: translate(-50%, 0);
        /* 내려올 때: 빠르게 떨어지다 부드럽게 멈춰요 */
        transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease-out;
      }
      .leaf-notice-icon {
        flex-shrink: 0;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: #0b9c7a;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .leaf-notice-icon svg { width: 24px; height: 24px; }
      .leaf-notice-body { flex: 1; min-width: 0; }
      .leaf-notice-title {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.3;
        color: #848484;
      }
      .leaf-notice-text {
        margin-top: 2px;
        font-size: 17px;
        font-weight: 700;
        line-height: 1.35;
        color: #111;
        word-break: keep-all;
      }
      .leaf-notice-time {
        flex-shrink: 0;
        align-self: flex-start;
        font-size: 15px;
        line-height: 1.3;
        color: #848484;
      }
      @media (prefers-reduced-motion: reduce) {
        .leaf-notice { transition: opacity 0.2s ease; transform: translate(-50%, 0); }
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- "이번 사용"의 진행 상황 ----------
  // { count: 지금까지 울린 횟수, elapsedMs: 마지막 알림 뒤 구경한 시간, needMs: 다음 알림까지 필요한 시간,
  //   lastSeenAt: 마지막으로 확인한 시각 }
  // 화면을 옮기면 페이지가 새로 로드되니까 sessionStorage에 저장해서 이어가요.
  function fastOverrideMs() {
    try {
      const sec = Number(sessionStorage.getItem(FAST_OVERRIDE_KEY));
      return sec > 0 ? sec * 1000 : 0;
    } catch (e) {
      return 0;
    }
  }

  function pickNeedMs(count) {
    const fast = fastOverrideMs();
    if (fast) return fast;
    if (count === 0) return FIRST_MS;
    return NEXT_MIN_MS + Math.random() * (NEXT_MAX_MS - NEXT_MIN_MS);
  }

  function newSession() {
    return { count: 0, elapsedMs: 0, needMs: pickNeedMs(0), lastSeenAt: Date.now() };
  }

  function saveSession() {
    session.lastSeenAt = Date.now();
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      /* 저장을 못 해도 이 화면 안에서는 정상 동작해요 */
    }
  }

  function loadSession() {
    // 테스트용: ?notice=5 → 5초마다, ?notice=off → 평소대로. 바꾸면 처음부터 다시 세요.
    const m = /[?&]notice=(\d+|off)/.exec(location.search);
    let restart = false;
    try {
      if (m) {
        if (m[1] === "off") sessionStorage.removeItem(FAST_OVERRIDE_KEY);
        else sessionStorage.setItem(FAST_OVERRIDE_KEY, m[1]);
        restart = true;
      }
      if (!restart) {
        const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
        if (
          saved &&
          Number.isFinite(saved.count) &&
          Number.isFinite(saved.elapsedMs) &&
          Number.isFinite(saved.needMs) &&
          Date.now() - saved.lastSeenAt < SESSION_GAP_MS
        ) {
          return saved;
        }
      }
    } catch (e) {
      /* 못 읽으면 새로 시작해요 */
    }
    return newSession();
  }

  const session = loadSession();
  saveSession();

  // ---------- 문구 고르기 ----------
  function pickMessageIndex() {
    let last = -1;
    try {
      last = Number(localStorage.getItem(LAST_MSG_KEY));
      if (Number.isNaN(last)) last = -1;
    } catch (e) {
      /* ignore */
    }
    // 같은 문구가 연달아 나오면 고장난 것처럼 보여서, 직전 문구를 뺀 나머지에서 골라요.
    const candidates = MESSAGES.map((_, i) => i).filter((i) => i !== last);
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    try {
      localStorage.setItem(LAST_MSG_KEY, String(idx));
    } catch (e) {
      /* ignore */
    }
    return idx;
  }

  // ---------- 벨소리 (파일 없이 코드로 합성) ----------
  // 종소리: 기본음에 배음을 겹치고, 높은 배음일수록 빨리 사라지게 해서 "딩-동"으로 울려요.
  // AudioContext / OfflineAudioContext 둘 다에서 쓸 수 있게 ctx를 받아요.
  function ringBell(ctx, destination, startAt) {
    const strike = (when, freq, peak) => {
      // [기본음의 몇 배, 상대 세기, 지속 시간(초)]
      const partials = [
        [1, 1.0, 1.4],
        [2.0, 0.45, 0.9],
        [2.76, 0.25, 0.6],
        [5.4, 0.12, 0.35],
      ];
      partials.forEach(([mult, amp, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * mult, when);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(peak * amp, when + 0.008); // 딱 치는 순간
        gain.gain.exponentialRampToValueAtTime(0.0001, when + dur); // 울림이 사라짐
        osc.connect(gain);
        gain.connect(destination);
        osc.start(when);
        osc.stop(when + dur + 0.05);
      });
    };
    strike(startAt, 1318.5, 0.22); // 미(E6)
    strike(startAt + 0.16, 1760, 0.18); // 라(A6) — 올라가는 두 음
  }

  // 브라우저는 사용자가 화면을 탭하기 전에는 소리를 못 내게 막아요. 그래서 첫 탭 때 오디오를
  // 미리 깨워둬요(그 전에 만들면 콘솔 경고가 떠서, 첫 탭 안에서 만들어요).
  let audioCtx = null;

  function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!audioCtx) {
        audioCtx = new AC();
        // 아이폰: 'ambient'면 무음 스위치를 따라가요(무음이면 벨이 안 울리고, 다른 앱 음악도 안 끊겨요).
        if (navigator.audioSession) navigator.audioSession.type = "ambient";
      }
      if (audioCtx.state !== "running") audioCtx.resume();
      // 아이폰은 무음 한 조각을 실제로 재생해야 잠금이 완전히 풀려요.
      const src = audioCtx.createBufferSource();
      src.buffer = audioCtx.createBuffer(1, 1, 22050);
      src.connect(audioCtx.destination);
      src.start(0);
    } catch (e) {
      /* 오디오를 못 써도 배너 자체는 정상 동작해요 */
    }
  }

  // 한 번 깨우는 데 성공하면(state가 running) 더는 들을 필요 없어요.
  const UNLOCK_EVENTS = ["touchend", "click", "keydown"];
  function onFirstGesture() {
    unlockAudio();
    if (audioCtx && audioCtx.state === "running") {
      UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, onFirstGesture, true));
    }
  }
  UNLOCK_EVENTS.forEach((ev) => document.addEventListener(ev, onFirstGesture, { capture: true, passive: true }));

  // 이 앱은 화면을 옮길 때마다 페이지가 새로 로드되는데, 크롬은 같은 사이트 안에서 이동해도
  // 앞 화면에서 한 탭을 "이미 상호작용함"으로 인정해줘요. 그래서 열릴 때 이미 인정된 상태면
  // 탭을 기다리지 않고 바로 오디오를 깨워요. (안 그러면 화면을 옮긴 뒤엔 영영 소리가 안 나요.)
  if (navigator.userActivation && navigator.userActivation.hasBeenActive) onFirstGesture();

  // 소리를 냈으면 true. 아직 화면을 탭하지 않아서 잠겨 있으면 조용히 넘어가요.
  function playBell() {
    if (!audioCtx || audioCtx.state !== "running") return false;
    try {
      ringBell(audioCtx, audioCtx.destination, audioCtx.currentTime + 0.02);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- 진동 ----------
  // 진동을 냈으면 true. 지원하지 않는 기기(아이폰 등)에선 조용히 넘어가요.
  function vibrate() {
    if (!navigator.vibrate) return false;
    // 크롬은 사용자가 화면을 한 번이라도 탭한 뒤에만 진동을 허용해요(그 전엔 콘솔 경고가 떠요).
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    try {
      return navigator.vibrate(VIBRATE_PATTERN);
    } catch (e) {
      return false;
    }
  }

  // ---------- 배너 ----------
  let current = null; // 지금 떠 있는 배너 { el, timer }

  function dismiss() {
    if (!current) return;
    const { el, timer } = current;
    current = null;
    clearTimeout(timer);
    el.classList.remove("is-visible"); // 위로 올라가며 사라져요
    setTimeout(() => el.remove(), LEAVE_MS);
  }

  function showNotice() {
    injectStyle();
    dismiss(); // 이미 떠 있으면 먼저 치워요

    const el = document.createElement("div");
    el.className = "leaf-notice";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `
      <span class="leaf-notice-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 6.5C10.5 5.4 8.4 5 6 5H3.5v12H6c2.4 0 4.5.4 6 1.5 1.5-1.1 3.6-1.5 6-1.5h2.5V5H18c-2.4 0-4.5.4-6 1.5Zm0 0V18.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>
      </span>
      <div class="leaf-notice-body">
        <div class="leaf-notice-title">알림</div>
        <div class="leaf-notice-text"></div>
      </div>
      <span class="leaf-notice-time">지금</span>`;
    // 이름 등이 들어가는 문구라서 textContent로 넣어요 (HTML로 해석되지 않게)
    el.querySelector(".leaf-notice-text").textContent = MESSAGES[pickMessageIndex()]();
    el.addEventListener("click", dismiss);
    document.body.appendChild(el);

    // 한 프레임 뒤에 클래스를 붙여야 위에서 내려오는 애니메이션이 재생돼요
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-visible")));

    // 내려오는 순간 벨이 울리고, 진동을 지원하는 기기에선 진동도 울려요.
    playBell();
    vibrate();

    // 울린(=내려오기 시작한) 지 VISIBLE_MS(3초)가 지나면 다시 위로 올라가며 사라져요.
    current = { el, timer: setTimeout(dismiss, VISIBLE_MS) };
  }

  // ---------- "지금 뭔가 하는 중이라 방해하면 안 되는 상태"인가? ----------
  // 팝업(댓글창·더보기·삭제 확인)이 열려 있거나 글자를 입력하는 중이면 "하는 중"이에요.
  // 사진을 올리는 화면(카메라·단어 선택·사전·수정)은 아예 이 파일을 불러오지 않아요.
  const BUSY_OVERLAY_SELECTOR =
    ".sheet-overlay:not([hidden]), .action-overlay:not([hidden]), .confirm-overlay:not([hidden])";

  function isUserBusy() {
    if (document.querySelector(BUSY_OVERLAY_SELECTOR)) return true; // 팝업(댓글창 등)이 열려 있음
    const a = document.activeElement;
    // 글자를 입력하는 중 (댓글, 검색어 등)
    return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
  }

  // ---------- 1초마다 "구경한 시간"을 쌓고, 알림 시간이 됐는지 확인 ----------
  let lastTickAt = Date.now();
  let timerId = null;

  function tick() {
    const now = Date.now();
    const delta = now - lastTickAt;
    lastTickAt = now;

    if (document.hidden) return; // 안 보이는 동안(다른 앱/탭)은 세지 않아요
    // 폰이 잠들었다 깨는 등으로 틱이 오래 밀렸으면, 그 시간은 구경한 걸로 치지 않아요.
    session.elapsedMs += Math.min(delta, 2000);

    if (session.count >= MAX_ALERTS) {
      saveSession();
      return finish();
    }
    if (session.elapsedMs < session.needMs) {
      saveSession();
      return;
    }
    // 시간이 됐어도 댓글창이 열려 있거나 입력 중이면 기다려요. 끝나는 순간 바로 울려요.
    if (isUserBusy()) {
      saveSession();
      return;
    }

    showNotice();
    session.count += 1;
    session.elapsedMs = 0; // 울린 시점부터 다시 1~2분을 세요
    session.needMs = pickNeedMs(session.count);
    saveSession();
    if (session.count >= MAX_ALERTS) finish();
  }

  // 다 울렸으면 더 확인할 필요가 없어요.
  function finish() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  // 화면이 다시 보이면 안 보이던 동안의 시간이 한꺼번에 더해지지 않게 기준 시각만 새로 잡아요.
  document.addEventListener("visibilitychange", () => {
    lastTickAt = Date.now();
  });

  if (session.count < MAX_ALERTS) timerId = setInterval(tick, 1000);

  // ---------- 상태 표시 (?notice=debug) ----------
  // 폰에서 "왜 안 울리지?"를 눈으로 확인하려는 용도예요. 평소엔 꺼져 있어요.
  //  - 몇 번 울렸는지, 구경한 시간이 기준까지 차오르는지, 팝업/입력 중이라 막힌 건 아닌지,
  //    소리가 잠겨 있진 않은지 보여줘요.
  const DEBUG_KEY = "leaf:noticeDebug";
  (function setupDebugBadge() {
    const m = /[?&]notice=(debug|off)/.exec(location.search);
    try {
      if (m && m[1] === "debug") sessionStorage.setItem(DEBUG_KEY, "1");
      if (m && m[1] === "off") sessionStorage.removeItem(DEBUG_KEY);
      if (sessionStorage.getItem(DEBUG_KEY) !== "1") return;
    } catch (e) {
      return;
    }
    const badge = document.createElement("div");
    badge.style.cssText =
      "position:fixed;left:8px;bottom:84px;z-index:2000;padding:8px 10px;border-radius:10px;" +
      "background:rgba(0,0,0,.78);color:#fff;font:11px/1.45 ui-monospace,Menlo,monospace;" +
      "pointer-events:none;white-space:pre;";
    document.body.appendChild(badge);
    const render = () => {
      const fast = fastOverrideMs();
      const kind = fast
        ? "  ⚠ 테스트 설정(?notice=" + fast / 1000 + ")"
        : session.count === 0
        ? "  (첫 알림 30초)"
        : "  (이후 1~2분)";
      badge.textContent =
        "알림 상태\n" +
        "울린 횟수: " + session.count + " / " + MAX_ALERTS + "\n" +
        "구경한 시간: " + Math.round(session.elapsedMs / 1000) + "초 / 기준 " + Math.round(session.needMs / 1000) + "초" + kind + "\n" +
        "방해 상태(팝업/입력): " + (isUserBusy() ? "예" : "아니오") + "\n" +
        "화면 보임: " + (document.hidden ? "아니오" : "예") + "\n" +
        "소리: " + (audioCtx ? audioCtx.state : "잠김(탭 필요)");
    };
    render();
    setInterval(render, 500);
  })();

  try {
    // 예전 방식들이 남긴 값 정리
    localStorage.removeItem("leaf:noticeNextAt");
    sessionStorage.removeItem("leaf:noticeIdleSec");
  } catch (e) {
    /* ignore */
  }

  // 데모/테스트에서 바로 확인하고 싶을 때 쓸 수 있게 열어둬요: leafNotice.showNow()
  window.leafNotice = {
    showNow: showNotice,
    dismiss,
    MESSAGES,
    // 아래는 테스트/확인용
    audioState: () => (audioCtx ? audioCtx.state : "locked(첫 탭 전)"),
    ringBell,
    vibrate,
    sessionState: () => ({
      count: session.count,
      elapsedSec: Math.round(session.elapsedMs / 1000),
      needSec: Math.round(session.needMs / 1000),
    }),
  };
})();
