const ALBUM_PHOTOS = [
  "assets/album/album-01.png",
  "assets/album/album-02.png",
  "assets/album/album-03.png",
  "assets/album/album-04.png",
  "assets/album/album-05.png",
  "assets/album/album-06.png",
  "assets/album/album-07.png",
  "assets/album/album-08.png",
  "assets/album/album-09.png",
];

const video = document.getElementById("cameraVideo");
const fallback = document.getElementById("cameraFallback");
const flashOverlay = document.getElementById("camFlashOverlay");
const toolbar = document.getElementById("cameraToolbar");
const modeToggle = document.getElementById("camModeToggle");
const albumView = document.getElementById("albumView");
const albumGrid = document.getElementById("albumGrid");
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
const btnDeviceFile = document.getElementById("btnDeviceFile");

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
  albumView.hidden = true;
  previewView.hidden = true;
  toolbar.style.display = "flex";
  modeToggle.style.display = "flex";
  btnFlash.style.visibility = "visible";
}

function showAlbum() {
  previewView.hidden = true;
  toolbar.style.display = "none";
  modeToggle.style.display = "none";
  btnFlash.style.visibility = "hidden";
  albumView.hidden = false;
}

function showPreview(src, mediaType) {
  capturedMediaType = mediaType || "image";
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
  albumView.hidden = true;
  toolbar.style.display = "none";
  modeToggle.style.display = "none";
  previewView.hidden = false;
}

function renderAlbumGrid() {
  const frag = document.createDocumentFragment();
  ALBUM_PHOTOS.forEach((src) => {
    const btn = document.createElement("button");
    btn.className = "album-cell";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    btn.appendChild(img);
    btn.addEventListener("click", () => showPreview(src, "image"));
    frag.appendChild(btn);
  });
  albumGrid.appendChild(frag);
}

function capturePhoto() {
  if (!currentStream) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);

  flashOverlay.classList.add("is-flashing");
  setTimeout(() => flashOverlay.classList.remove("is-flashing"), 250);

  showPreview(canvas.toDataURL("image/jpeg", 0.92), "image");
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
  if (!albumView.hidden) {
    showStage();
    return;
  }
  stopCamera();
  window.location.href = "index.html";
});

btnAlbum.addEventListener("click", showAlbum);

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

btnDeviceFile.addEventListener("click", () => {
  deviceFileInput.click();
});

deviceFileInput.addEventListener("change", async () => {
  const file = deviceFileInput.files[0];
  if (!file) return;
  const mediaType = file.type.startsWith("video/") ? "video" : "image";
  const dataUrl = await blobToDataUrl(file);
  showPreview(dataUrl, mediaType);
  deviceFileInput.value = "";
});

renderAlbumGrid();
startCamera();

window.addEventListener("pagehide", stopCamera);
