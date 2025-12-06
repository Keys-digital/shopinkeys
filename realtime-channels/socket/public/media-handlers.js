// media-handler.js

export const mediaHandler = (() => {
  // --- Internal state ---
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];

  let videoRecorder = null;
  let videoStream = null;

  // --- AUDIO RECORDING ---
  function toggleVoiceRecording() {
    if (!isRecording) startVoiceRecording();
    else stopVoiceRecording();
  }

  function startVoiceRecording() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        const audioOverlay = document.getElementById("audio-recording-overlay");
        const cancelBtn = document.getElementById("cancel-audio-recording");

        audioOverlay.style.display = "flex";
        cancelBtn.onclick = stopVoiceRecording;

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
          sendVoiceMessage(audioBlob);
          stream.getTracks().forEach((t) => t.stop());
          audioOverlay.style.display = "none";
        };

        mediaRecorder.start();
        isRecording = true;
        console.log("Voice recording started");
      })
      .catch((err) => {
        console.error("Microphone error:", err);
        alert("Could not access microphone. Check permissions.");
      });
  }

  function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      console.log("Voice recording stopped");
      document.getElementById("audio-recording-overlay").style.display = "none";
    }
  }

  // --- VIDEO RECORDING ---
  async function showVideoRecording() {
    const videoOverlay = document.getElementById("video-recording-overlay");
    const videoPreview = document.getElementById("recording-preview");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      videoStream = stream;
      videoPreview.srcObject = stream;
      videoOverlay.style.display = "flex";
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Camera permission denied.");
    }
  }

  function handleVideoClick(e) {
    e.preventDefault();
    if (videoRecorder && videoRecorder.state === "recording") {
      stopVideoRecording();
      return;
    }
    startVideoRecording();
  }

  function startVideoRecording() {
    const videoOverlay = document.getElementById("video-recording-overlay");
    const videoPreview = document.getElementById("recording-preview");

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        videoStream = stream;
        videoPreview.srcObject = stream;
        videoRecorder = new MediaRecorder(stream);
        const videoChunks = [];

        videoRecorder.ondataavailable = (e) => videoChunks.push(e.data);
        videoRecorder.onstop = () => {
          const videoBlob = new Blob(videoChunks, { type: "video/mp4" });
          sendVideoMessage(videoBlob);
          stream.getTracks().forEach((t) => t.stop());
          videoPreview.srcObject = null;
          videoOverlay.style.display = "none";
        };

        videoRecorder.start();
        console.log("Video recording started");
      })
      .catch((err) => {
        console.error("Video recording error:", err);
      });
  }

  function stopVideoRecording() {
    if (videoRecorder && videoRecorder.state === "recording") {
      videoRecorder.stop();
    } else if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
      document.getElementById("recording-preview").srcObject = null;
      document.getElementById("video-recording-overlay").style.display = "none";
    }
  }

  function handleVideoFileSelect(e) {
    e.preventDefault();
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "video/*";
    fileInput.onchange = (ev) => {
      const file = ev.target.files[0];
      if (file && file.type.startsWith("video/")) {
        sendVideoFileMessage(file);
      } else {
        alert("Please select a valid video file.");
      }
    };
    fileInput.click();
  }

  // --- RENDERING HELPERS (optional) ---
  function renderAudioMessage(msg) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = URL.createObjectURL(msg.audioData);
    return audio;
  }

  function renderVideoMessage(msg) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = URL.createObjectURL(msg.videoData);
    return video;
  }

  // --- Public API ---
  return {
    toggleVoiceRecording,
    showVideoRecording,
    handleVideoClick,
    handleVideoFileSelect,
    renderAudioMessage,
    renderVideoMessage,
  };
})();
