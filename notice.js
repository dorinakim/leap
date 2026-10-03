// notice.js — 앱을 쓰는 동안 일정 시간마다 화면 위에서 내려오는 알림 배너 (데모용)
//
// - NOTICE_INTERVAL_MS 마다 아래 MESSAGES 중 하나를 무작위로 보여줘요 (직전과 같은 문구는 피해요).
// - 이 앱은 화면을 옮길 때마다 페이지가 새로 로드돼서 페이지 안 타이머만 쓰면 이동할 때마다
//   시간이 리셋돼요. 그래서 "다음 알림 시각"을 localStorage에 저장해서 화면을 오가도 이어져요.
// - 홈·피드·마이페이지·게시물 화면에서만 켜요 (사진 찍기/단어 고르기 도중엔 방해돼서 제외).
// - 위에서 아래로 내려오고, 내려온 뒤 VISIBLE_MS(3초) 동안 머물다가 다시 위로 올라가며 사라져요.
//   배너를 누르면 바로 올라가요.
// - 내려올 때 벨소리가 나고(웹 오디오), 진동을 지원하는 기기에선 진동도 울려요.
//   * 브라우저는 "사용자가 화면을 한 번이라도 탭한 뒤"에만 소리/진동을 허용해요(자동재생 정책).
//   * 웹에서는 폰의 무음/진동 모드를 읽을 수 없어요. 아이폰은 무음 스위치를 켜면 웹 오디오가
//     자동으로 꺼지지만, 아이폰은 웹에서 진동을 낼 수 없어요(안드로이드 크롬은 가능).
// - 폰에서 바로 확인하고 싶으면 주소 뒤에 ?notice=3 을 붙여 열어보세요 (3초 뒤에 알림이 떠요).
(function () {
  const NOTICE_INTERVAL_MS = 2 * 60 * 1000; // 알림 간격 (테스트로 빨리 보고 싶으면 줄이세요)
  const SLIDE_MS = 400; // 위에서 내려오는 데 걸리는 시간
  const VISIBLE_MS = 3000; // 다 내려온 뒤 머무는 시간 → 이후 다시 위로 올라가요
  const LEAVE_MS = 450; // 올라가는 애니메이션이 끝나 DOM에서 지우기까지의 시간
  const VIBRATE_PATTERN = [200, 100, 200]; // 진동: 웅-쉬-웅
  const NEXT_AT_KEY = "leaf:noticeNextAt";
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

  // ---------- 다음 알림 시각 (localStorage에 저장해서 화면을 옮겨도 이어져요) ----------
  let memoryNextAt = 0; // 저장소를 못 쓰는 환경을 위한 대비

  function readNextAt() {
    try {
      return Number(localStorage.getItem(NEXT_AT_KEY)) || 0;
    } catch (e) {
      return memoryNextAt;
    }
  }

  function writeNextAt(t) {
    memoryNextAt = t;
    try {
      localStorage.setItem(NEXT_AT_KEY, String(t));
    } catch (e) {
      /* 저장소를 못 써도 이 페이지 안에서는 메모리 값으로 동작해요 */
    }
  }

  function scheduleNext() {
    writeNextAt(Date.now() + NOTICE_INTERVAL_MS);
  }

  // 페이지가 열릴 때: 저장된 시각이 "앞으로 NOTICE_INTERVAL_MS 이내"면 이어서 쓰고, 없거나
  // 이미 지났으면(앱을 한참 닫아뒀다 다시 연 경우 등) 열자마자 알림이 튀어나오지 않도록
  // 지금부터 새로 센다.
  function initSchedule() {
    // 테스트용: 주소 뒤에 ?notice=3 을 붙여 열면 3초 뒤에 알림이 떠요 (폰에서 벨·진동 확인용).
    const m = /[?&]notice=(\d+)/.exec(location.search);
    if (m) {
      writeNextAt(Date.now() + Math.min(Number(m[1]), NOTICE_INTERVAL_MS / 1000) * 1000);
      return;
    }
    const t = readNextAt();
    const now = Date.now();
    if (!(t > now && t <= now + NOTICE_INTERVAL_MS + 1000)) scheduleNext();
  }

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

    // 다 내려온 뒤 VISIBLE_MS(3초) 동안 보여주고 → 다시 위로 올라가며 사라져요.
    current = { el, timer: setTimeout(dismiss, SLIDE_MS + VISIBLE_MS) };
  }

  // ---------- 1초마다 "알림 시간이 됐나?" 확인 ----------
  function tick() {
    if (document.hidden) return; // 안 보이는 탭에선 띄우지 않고, 다시 보일 때 띄워요
    if (Date.now() >= readNextAt()) {
      scheduleNext(); // 먼저 다음 시각을 잡아서, 다른 탭이 같은 알림을 또 띄우지 않게 해요
      showNotice();
    }
  }

  initSchedule();
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });

  // 데모/테스트에서 바로 확인하고 싶을 때 쓸 수 있게 열어둬요: leafNotice.showNow()
  window.leafNotice = {
    showNow: showNotice,
    dismiss,
    MESSAGES,
    // 아래는 테스트/확인용
    audioState: () => (audioCtx ? audioCtx.state : "locked(첫 탭 전)"),
    ringBell,
    vibrate,
  };
})();
