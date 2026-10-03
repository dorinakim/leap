const video = document.getElementById("cameraVideo");
const fallback = document.getElementById("cameraFallback");
const flashOverlay = document.getElementById("camFlashOverlay");
const toolbar = document.getElementById("cameraToolbar");
const modeToggle = document.getElementById("camModeToggle");
const previewView = document.getElementById("previewView");
const previewImage = document.getElementById("previewImage");
const previewVideo = document.getElementById("previewVideo");
const canvas = document.getElementById("captureCanvas");
const deviceFileInput = document.getElementById("deviceFileInput");

const btnSettings = document.getElementById("btnSettings");
const btnFlash = document.getElementById("btnFlash");
const btnClose = document.getElementById("btnClose");
const btnAlbum = document.getElementById("btnAlbum");
const btnShutter = document.getElementById("btnShutter");
const btnFlip = document.getElementById("btnFlip");
const btnRetake = document.getElementById("btnRetake");
const btnUsePhoto = document.getElementById("btnUsePhoto");
const albumThumbImg = document.getElementById("albumThumbImg");
const albumThumbIcon = document.getElementById("albumThumbIcon");

let currentStream = null;
let facingMode = "environment";
let flashOn = false;
let captureMode = "photo"; // 'photo' | 'video'
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let capturedMediaType = "image";

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

/* ---------- 앨범 버튼 썸네일 ----------
   브라우저는 기기 사진 라이브러리를 미리 읽을 수 없어서(사용자가 직접 골라야만
   접근 가능), "가장 최근 사진"을 진짜로 알아낼 방법이 없어요. 대신 이 앱에서
   마지막으로 촬영했거나 앨범에서 골랐던 사진을 기기에 기억해뒀다가 보여줘요. */
const LAST_PHOTO_THUMB_KEY = "leaf:lastPhotoThumb";
const THUMB_SIZE = 88; // 44px 버튼 크기의 2배(레티나 대응)

function showAlbumThumb(dataUrl) {
  albumThumbImg.src = dataUrl;
  albumThumbImg.hidden = false;
  albumThumbIcon.hidden = true;
}

function saveAlbumThumb(dataUrl) {
  showAlbumThumb(dataUrl);
  try {
    localStorage.setItem(LAST_PHOTO_THUMB_KEY, dataUrl);
  } catch (e) {
    /* 저장 공간이 꽉 찼거나 접근 불가면 이번 화면에서만 보이고 다음엔 안 남아요 */
  }
}

// 사진(이미지)을 정사각형으로 가운데 크롭해서 작은 썸네일로 만들어요.
function makeSquareThumbnail(imgEl) {
  const side = Math.min(imgEl.naturalWidth, imgEl.naturalHeight);
  const sx = (imgEl.naturalWidth - side) / 2;
  const sy = (imgEl.naturalHeight - side) / 2;
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = THUMB_SIZE;
  thumbCanvas.height = THUMB_SIZE;
  thumbCanvas.getContext("2d").drawImage(imgEl, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return thumbCanvas.toDataURL("image/jpeg", 0.85);
}

// 방금 촬영/선택한 사진(src)으로 앨범 썸네일을 갱신해요. 동영상은 프레임을
// 뽑아내는 게 번거로워서(스코프상) 건너뛰고, 사진일 때만 갱신합니다.
function updateAlbumThumbFrom(src, mediaType) {
  if (mediaType === "video") return;
  const img = new Image();
  img.onload = () => {
    try {
      saveAlbumThumb(makeSquareThumbnail(img));
    } catch (e) {
      /* 썸네일 생성에 실패해도 촬영/선택 자체엔 영향 없어요 */
    }
  };
  img.src = src;
}

function initAlbumThumb() {
  try {
    const saved = localStorage.getItem(LAST_PHOTO_THUMB_KEY);
    if (saved) showAlbumThumb(saved);
  } catch (e) {
    /* 저장된 게 없거나 접근 불가면 기본 아이콘 그대로 둬요 */
  }
}

/* ---------- 사진 크기 줄이기 ----------
   이 앱은 사진을 data URL 문자열로 브라우저 저장소(localStorage)에 넣는데, 저장소엔
   한도가 있어요(아이폰 사파리는 전체 약 5MB 이하). 앨범에서 고른 원본 사진은 보통 수 MB라
   저장에 실패해서 "공유했는데 홈에 안 보이는" 문제가 생겼어요. 그래서 저장 전에 긴 변을
   MAX_PHOTO_SIDE로 줄이고 JPEG로 다시 압축해요 (피드에 보이는 크기엔 충분해요). */
const MAX_PHOTO_SIDE = 1080;
const PHOTO_JPEG_QUALITY = 0.8;

// source(이미지/비디오 요소)를 줄여서 JPEG data URL로 돌려줘요.
function encodePhoto(source, srcW, srcH) {
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // 투명 PNG도 JPEG로 바꾸면 투명 부분이 까맣게 나오니까 흰 배경을 먼저 깔아요.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
}

// 앨범에서 고른 사진 파일을 줄여서 data URL로 돌려줘요. (파일을 통째로 base64로
// 바꾸지 않고 object URL로 바로 디코딩해서, 큰 사진도 메모리를 덜 써요.)
function prepareAlbumPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(encodePhoto(img, img.naturalWidth, img.naturalHeight));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

async function startCamera() {
  stopCamera();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: captureMode === "video",
    });
    currentStream = stream;
    video.srcObject = stream;
    fallback.hidden = true;
    video.hidden = false;
  } catch (err) {
    video.hidden = true;
    fallback.hidden = false;
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
}

function showStage() {
  previewView.hidden = true;
  toolbar.style.display = "flex";
  modeToggle.style.display = "flex";
  btnFlash.style.visibility = "visible";
}

function showPreview(src, mediaType) {
  capturedMediaType = mediaType || "image";
  updateAlbumThumbFrom(src, capturedMediaType);
  if (capturedMediaType === "video") {
    previewVideo.src = src;
    previewVideo.hidden = false;
    previewImage.hidden = true;
    btnUsePhoto.textContent = "이 영상 사용하기";
  } else {
    previewImage.src = src;
    previewImage.hidden = false;
    previewVideo.hidden = true;
    btnUsePhoto.textContent = "이 사진 사용하기";
  }
  toolbar.style.display = "none";
  modeToggle.style.display = "none";
  previewView.hidden = false;
}

function capturePhoto() {
  if (!currentStream) return;
  const dataUrl = encodePhoto(video, video.videoWidth, video.videoHeight);

  flashOverlay.classList.add("is-flashing");
  setTimeout(() => flashOverlay.classList.remove("is-flashing"), 250);

  showPreview(dataUrl, "image");
}

function startRecording() {
  if (!currentStream) return;
  recordedChunks = [];
  let recorder;
  try {
    recorder = new MediaRecorder(currentStream);
  } catch (e) {
    showToast("이 브라우저는 동영상 녹화를 지원하지 않아요");
    return;
  }
  mediaRecorder = recorder;
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
    const dataUrl = await blobToDataUrl(blob);
    showPreview(dataUrl, "video");
  };
  mediaRecorder.start();
  isRecording = true;
  btnShutter.classList.add("is-recording");
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    btnShutter.classList.remove("is-recording");
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

btnSettings.addEventListener("click", () => {
  showToast("설정 화면은 준비 중이에요");
});

btnFlash.addEventListener("click", async () => {
  flashOn = !flashOn;
  btnFlash.classList.toggle("is-on", flashOn);
  const track = currentStream && currentStream.getVideoTracks()[0];
  const caps = track && track.getCapabilities ? track.getCapabilities() : null;
  if (track && caps && caps.torch) {
    try {
      await track.applyConstraints({ advanced: [{ torch: flashOn }] });
    } catch (e) {
      /* torch not supported on this device */
    }
  }
});

btnClose.addEventListener("click", () => {
  if (!previewView.hidden) {
    showStage();
    return;
  }
  stopCamera();
  window.location.href = "index.html";
});

// 디자인 목업용 앨범 그리드 대신, 바로 실제 기기의 사진/동영상 선택 창을 열어요.
btnAlbum.addEventListener("click", () => {
  deviceFileInput.click();
});

btnShutter.addEventListener("click", () => {
  if (captureMode === "photo") {
    capturePhoto();
  } else if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

btnFlip.addEventListener("click", () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  startCamera();
});

modeToggle.querySelectorAll(".cam-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (isRecording) return;
    captureMode = btn.dataset.mode;
    modeToggle.querySelectorAll(".cam-mode-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    btnShutter.classList.toggle("is-video-mode", captureMode === "video");
    startCamera();
  });
});

btnRetake.addEventListener("click", () => {
  showStage();
});

btnUsePhoto.addEventListener("click", () => {
  const src = capturedMediaType === "video" ? previewVideo.src : previewImage.src;
  try {
    sessionStorage.setItem("leaf:capturedPhoto", src);
    sessionStorage.setItem("leaf:capturedMediaType", capturedMediaType);
  } catch (e) {
    /* storage unavailable, keyword.html falls back to its demo photo */
  }
  stopCamera();
  window.location.href = "keyword.html";
});

deviceFileInput.addEventListener("change", async () => {
  const file = deviceFileInput.files[0];
  if (!file) return;
  deviceFileInput.value = "";
  try {
    // 원본 그대로 저장하면 용량 때문에 등록이 실패할 수 있어서, 줄여서 사용해요.
    showPreview(await prepareAlbumPhoto(file), "image");
  } catch (e) {
    console.warn("album photo load failed:", e);
    showToast("이 사진을 불러올 수 없어요. 다른 사진을 골라 주세요.");
  }
});

initAlbumThumb();
startCamera();

window.addEventListener("pagehide", stopCamera);
