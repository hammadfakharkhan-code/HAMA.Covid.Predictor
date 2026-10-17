const form = document.getElementById("uploadForm");
const input = document.getElementById("imageInput");
const dropzone = document.getElementById("dropzone");
const previewWrap = document.getElementById("previewWrap");
const previewImage = document.getElementById("previewImage");
const fileName = document.getElementById("fileName");
const removeImage = document.getElementById("removeImage");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultEmpty = document.getElementById("resultEmpty");
const resultContent = document.getElementById("resultContent");
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorText = document.getElementById("errorText");
const predictionText = document.getElementById("predictionText");
const confidenceRow = document.getElementById("confidenceRow");
const confidenceText = document.getElementById("confidenceText");
const confidenceTrack = document.getElementById("confidenceTrack");
const confidenceBar = document.getElementById("confidenceBar");

let selectedFile = null;
let previewUrl = null;

function resetResult() {
  resultEmpty.hidden = false;
  resultContent.hidden = true;
  loadingState.hidden = true;
  errorState.hidden = true;
  confidenceBar.style.width = "0%";
}

function showError(message) {
  resultEmpty.hidden = true;
  resultContent.hidden = true;
  loadingState.hidden = true;
  errorState.hidden = false;
  errorText.textContent = message || "Something went wrong. Please try again.";
}

function setFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("Please select an image file.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError("Image is too large. Maximum upload size is 10 MB.");
    return;
  }
  selectedFile = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  fileName.textContent = file.name;
  previewWrap.classList.add("visible");
  resetResult();
}

input.addEventListener("change", () => setFile(input.files[0]));
["dragenter", "dragover"].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});
dropzone.addEventListener("drop", event => {
  const file = event.dataTransfer.files[0];
  if (file) setFile(file);
});
removeImage.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  selectedFile = null;
  input.value = "";
  previewWrap.classList.remove("visible");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  resetResult();
});
document.getElementById("newScanBtn").addEventListener("click", () => {
  selectedFile = null;
  input.value = "";
  previewWrap.classList.remove("visible");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  resetResult();
  document.getElementById("workspace").scrollIntoView({behavior: "smooth", block: "start"});
});
document.getElementById("retryBtn").addEventListener("click", resetResult);

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedFile) {
    showError("Choose a chest X-ray image before starting the analysis.");
    return;
  }

  const body = new FormData();
  body.append("image", selectedFile);
  resultEmpty.hidden = true;
  resultContent.hidden = true;
  errorState.hidden = true;
  loadingState.hidden = false;
  analyzeBtn.disabled = true;

  try {
    const response = await fetch("/predict", {method: "POST", body});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Prediction failed.");

    predictionText.textContent = data.prediction;
    if (data.confidence !== null && data.confidence !== undefined) {
      confidenceRow.hidden = false;
      confidenceTrack.hidden = false;
      confidenceText.textContent = `${data.confidence}%`;
      confidenceBar.style.width = `${Math.max(0, Math.min(100, data.confidence))}%`;
    } else {
      confidenceRow.hidden = true;
      confidenceTrack.hidden = true;
    }
    loadingState.hidden = true;
    resultContent.hidden = false;
  } catch (error) {
    showError(error.message || "Could not connect to the prediction service.");
  } finally {
    analyzeBtn.disabled = false;
  }
});
