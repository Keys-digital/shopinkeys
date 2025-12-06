console.log("WKForce Chat Simulation - client.js loaded");

// AUDIO & VIDEO RECORDING OVERLAY CONTROL

// Safe audio overlay setup
const audioOverlay = document.getElementById("audio-recording-overlay");
const audioCancelBtn = document.getElementById("cancel-audio-recording");

if (audioOverlay && audioCancelBtn) {
  const showAudioRecording = () => (audioOverlay.style.display = "flex");
  const hideAudioRecording = () => (audioOverlay.style.display = "none");
  audioCancelBtn.addEventListener("click", hideAudioRecording);
  document
    .getElementById("audio-btn")
    ?.addEventListener("click", showAudioRecording);
}

// Safe video overlay setup
const videoOverlay = document.getElementById("video-recording-overlay");
const videoPreview = document.getElementById("recording-preview");
const videoCancelBtn = document.getElementById("cancel-video-recording");

if (videoOverlay && videoPreview && videoCancelBtn) {
  const showVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      videoPreview.srcObject = stream;
      videoOverlay.style.display = "flex";
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const hideVideoRecording = () => {
    if (videoPreview.srcObject) {
      videoPreview.srcObject.getTracks().forEach((t) => t.stop());
      videoPreview.srcObject = null;
    }
    videoOverlay.style.display = "none";
  };

  videoCancelBtn.addEventListener("click", hideVideoRecording);
  document
    .getElementById("video-btn")
    ?.addEventListener("click", showVideoRecording);
}

let socket = null;
let username = "";
let currentChannelId = null;
let currentChannelType = null;
let isTyping = false;
let typingTimeout = null;

// Voice recording variables
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;

// Video recording variables
let videoRecorder = null;
let videoStream = null;

const tempMessages = new Map();
const receivedMessageIds = new Set();
const handledStatusUpdates = new Set();

// Elements
const socketStatus = document.getElementById("socketio-status");
const messagesContainer = document.getElementById("messages");
const typingIndicator = document.getElementById("typing-indicator");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-btn");
const connectedUserLabel = document.getElementById("connected-user");

// New input area elements
const emojiBtn = document.getElementById("emoji-btn");
const attachBtn = document.getElementById("attach-btn");
const videoBtn = document.getElementById("video-btn");

// Use the channels from the server's /channels endpoint
const CHANNELS = {
  ALEX: "87e2c874-9570-4042-a9f5-6dcccad8b53f",
  ALICE: "d9b2868b-638c-4f31-b103-4ac14b99009a",
  BOB: "783f39e2-31a6-418a-a146-8082e7c924ce",
  HANNAH: "a7bcacb2-68f6-4c78-a6e8-9514722b2322",
  DIANA: "0337eeab-b827-455e-81be-aa196bac0477",
  LIGHT: "b860536c-ac4a-40d8-8381-384f67d2200e",
  ETHAN: "d47a1860-7d2d-4d7f-941f-a77a6c889620",
  CHARLIE: "3d20a7ff-9064-4981-8440-f999661d4609",
  DEV_TEAM: "0b158e7f-7547-4082-bc94-e0378f9ed5cd",
  CASUAL_CHAT: "ce8cf87d-1677-4a43-857b-5f128f95b6dc",
};

const DIRECT_CHANNELS = {
  // channelId : receiverId
  "87e2c874-9570-4042-a9f5-6dcccad8b53f":
    "ba65e4e8-0617-470b-a3c1-702b25f4d010", // Alex
  "87e2c874-9570-4042-a9f5-6dcccad8b53f:reverse":
    "11545575-0f0a-43e3-b45e-40d2bea3f5b1", // Light back to Alex
  "d9b2868b-638c-4f31-b103-4ac14b99009a":
    "ede1a8a6-eead-4fee-b1ba-2edc22c800f0", // Alice
  "783f39e2-31a6-418a-a146-8082e7c924ce":
    "39aea136-0ea6-40fd-941d-3d80f47eb542", // Bob
  "a7bcacb2-68f6-4c78-a6e8-9514722b2322":
    "a506c9a5-477e-4220-ac22-02263833766f", // Hannah
  "0337eeab-b827-455e-81be-aa196bac0477":
    "61325c15-5405-4415-9683-e8087191175f", // Diana
  "b860536c-ac4a-40d8-8381-384f67d2200e":
    "11545575-0f0a-43e3-b45e-40d2bea3f5b1", // Light
  "d47a1860-7d2d-4d7f-941f-a77a6c889620":
    "8238bbbc-0800-4315-bf86-a860b4387ff4", // Ethan
  "3d20a7ff-9064-4981-8440-f999661d4609":
    "661dbd59-7845-4ef9-99b6-c6ead792f259", // Charlie
};

// USER MAPPING (friendly test names)
const USER_MAP = {
  alex: "ba65e4e8-0617-470b-a3c1-702b25f4d010",
  light: "11545575-0f0a-43e3-b45e-40d2bea3f5b1",
  alice: "ede1a8a6-eead-4fee-b1ba-2edc22c800f0",
  bob: "39aea136-0ea6-40fd-941d-3d80f47eb542",
  hannah: "a506c9a5-477e-4220-ac22-02263833766f",
  diana: "61325c15-5405-4415-9683-e8087191175f",
  fiona: "b74581a6-025a-4ee0-b555-4d2408c7826c",
  george: "21d504cb-f233-42c1-af00-8f98cbfdd5b6",
  ethan: "8238bbbc-0800-4315-bf86-a860b4387ff4",
  charlie: "661dbd59-7845-4ef9-99b6-c6ead792f259",
};

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, initializing chat...");

  // === SINGLE CONNECT LOGIC ===
  document.getElementById("connectBtn").onclick = handleConnect;

  // Existing message functionality
  sendButton.addEventListener("click", handleSendButtonClick);
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendTextMessage();
  });
  messageInput.addEventListener("input", handleTyping);

  function handleVideoFileSelect(e) {
    e.preventDefault(); // prevent context menu if right-click
    const fileInput = document.getElementById("video-file-input");
    fileInput.click(); // trigger file picker

    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (file) {
        sendVideoFile(file); // send file to server / chat
      }
      fileInput.value = ""; // reset input so same file can be selected again
    };
  }

  // New input area functionality
  setupInputAreaFunctionality();

  setupChannelButtons();

  // Expose functions to global scope for HTML onclick handlers
  window.joinChannel = joinChannel;
  window.connectSocketSimple = initSocketConnection;
});

// === NEW INPUT AREA FUNCTIONALITY ===
function setupInputAreaFunctionality() {
  // Update send button state based on input
  messageInput.addEventListener("input", updateSendButtonState);

  // Emoji button functionality
  emojiBtn.addEventListener("click", toggleEmojiPicker);

  // Attach button functionality
  attachBtn.addEventListener("click", handleAttachClick);

  // Video button functionality - BOTH recording AND file selection
  videoBtn.addEventListener("click", handleVideoClick);
  videoBtn.addEventListener("contextmenu", handleVideoFileSelect); // Right-click for file select

  // Initialize send button state
  updateSendButtonState();
}

function updateSendButtonState() {
  const hasText = messageInput.value.trim() !== "";

  if (hasText) {
    // Text mode - show send icon
    sendButton.classList.remove("voice-mode");
    sendButton.title = "Send message";
  } else {
    // Voice mode - show microphone icon
    sendButton.classList.add("voice-mode");
    sendButton.title = "Record voice message";
  }
}

function handleSendButtonClick() {
  if (sendButton.classList.contains("voice-mode")) {
    // Voice recording mode
    toggleVoiceRecording();
  } else {
    // Send text message mode
    sendTextMessage();
  }
}

function toggleVoiceRecording() {
  if (!isRecording) {
    startVoiceRecording();
  } else {
    stopVoiceRecording();
  }
}

function startVoiceRecording() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        const audioOverlay = document.getElementById("audio-recording-overlay");
        audioOverlay.style.display = "flex"; // show overlay

        // Stop recording if user clicks Stop in overlay
        const cancelBtn = document.getElementById("cancel-audio-recording");
        cancelBtn.onclick = stopVoiceRecording;

        mediaRecorder.ondataavailable = function (event) {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = function () {
          const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
          sendVoiceMessage(audioBlob);

          // Stop all tracks
          stream.getTracks().forEach((track) => track.stop());

          // Hide overlay
          audioOverlay.style.display = "none";
        };

        mediaRecorder.start();
        isRecording = true;
        sendButton.classList.add("recording");

        // Auto-stop after 60 seconds
        setTimeout(function () {
          if (isRecording) {
            stopVoiceRecording();
          }
        }, 60000);

        console.log("Voice recording started");
      })
      .catch(function (err) {
        console.error("Error accessing microphone:", err);
        alert("Could not access microphone. Please check permissions.");
      });
  } else {
    alert("Your browser does not support audio recording.");
  }
}

function showVideoOverlayForFile(file) {
  const videoOverlay = document.getElementById("video-recording-overlay");
  const videoPreview = document.getElementById("recording-preview");
  videoOverlay.style.display = "flex";

  const videoUrl = URL.createObjectURL(file);
  videoPreview.srcObject = null;
  videoPreview.src = videoUrl;
  videoPreview.controls = true;

  const cancelBtn = document.getElementById("cancel-video-recording");
  cancelBtn.onclick = () => {
    videoOverlay.style.display = "none";
    videoPreview.src = "";
    videoPreview.srcObject = null;
  };
}

function stopVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    sendButton.classList.remove("recording");
    console.log("Voice recording stopped");

    const audioOverlay = document.getElementById("audio-recording-overlay");
    audioOverlay.style.display = "none";
  }
}

function sendVoiceMessage(audioBlob) {
  if (!socket?.connected) {
    alert("Not connected to server.");
    return;
  }

  if (!currentChannelId) {
    alert("Please select a channel first or connect to a user.");
    return;
  }

  // Convert blob to base64 for sending
  const reader = new FileReader();
  reader.onload = function () {
    const audioBase64 = reader.result.split(",")[1]; // Remove data URL prefix

    // Generate a tempId to track optimistic messages
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`;

    // Build temporary optimistic message
    const tempMessage = {
      tempId,
      content: "[Voice message]",
      senderName: username,
      senderId: socket.auth?.userId,
      createdAt: new Date().toISOString(),
      channelId: currentChannelId,
      persisted: false,
      messageType: "audio",
      audioData: audioBase64,
      audioBlob: audioBlob, // Store the blob for playback
    };

    tempMessages.set(tempId, tempMessage);

    // Render immediately with audio player
    if (messagesContainer) {
      const div = document.createElement("div");
      div.classList.add("message", "outgoing");
      div.dataset.tempId = tempId;

      // Create audio URL for playback
      const audioUrl = URL.createObjectURL(audioBlob);

      div.innerHTML = `
        <div class="username">${escapeHtml(username)}</div>
        <div class="content">
          <audio class="audio-player" controls>
            <source src="${audioUrl}" type="audio/wav">
            Your browser does not support the audio element.
          </audio>
        </div>
        <div class="timestamp">${formatTimestamp(tempMessage.createdAt)}</div>
        <span class="message-status" style="color:#bbb;">…</span>
      `;

      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // === Direct Chat ===
    if (currentChannelType === "direct") {
      const senderId = socket.auth?.userId;
      const receiverId = window.currentReceiverId;

      const channelId = findDirectChannelId(senderId, receiverId);
      if (!channelId) {
        alert("No valid direct channel found for this user pair.");
        return;
      }

      const messageData = {
        senderId,
        receiverId,
        channelId,
        content: "[Voice message]",
        tempId,
        messageType: "audio",
        audioData: audioBase64,
        metadata: {
          type: "direct",
          timestamp: new Date().toISOString(),
          participants: [senderId, receiverId],
        },
      };

      console.log(
        `[CLIENT] Sending voice message via channel ${channelId}`,
        messageData
      );
      socket.emit("message:send", messageData);
    }

    // === Group Chat ===
    else if (currentChannelType === "group") {
      const messageData = {
        groupId: currentChannelId,
        content: "[Voice message]",
        tempId,
        messageType: "audio",
        audioData: audioBase64,
        metadata: {
          type: "group",
          timestamp: new Date().toISOString(),
          groupId: currentChannelId,
        },
      };

      console.log(
        `[CLIENT] Sending group voice message → ${currentChannelId}`,
        messageData
      );
      socket.emit("group:message:send", messageData);
    }
  };

  reader.readAsDataURL(audioBlob);
}

function toggleEmojiPicker() {
  // Remove existing picker if open
  let existingPicker = document.getElementById("emoji-picker");
  if (existingPicker) {
    existingPicker.remove();
    return;
  }

  // Create picker container
  const picker = document.createElement("div");
  picker.id = "emoji-picker";
  picker.style.position = "fixed";
  picker.style.zIndex = "1000";
  picker.style.background = "#222";
  picker.style.border = "1px solid #444";
  picker.style.borderRadius = "10px";
  picker.style.padding = "8px";
  picker.style.width = "240px";
  picker.style.color = "#fff";
  picker.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

  // Position relative to emoji button
  const rect = emojiBtn.getBoundingClientRect();
  picker.style.left = rect.left + "px";
  picker.style.bottom = window.innerHeight - rect.top + 10 + "px";

  // --- Tab buttons ---
  const tabs = document.createElement("div");
  tabs.style.display = "flex";
  tabs.style.justifyContent = "space-around";
  tabs.style.marginBottom = "6px";

  const emojiTab = document.createElement("button");
  emojiTab.textContent = "😀";
  emojiTab.className = "tab-btn active";

  const stickerTab = document.createElement("button");
  stickerTab.textContent = "🖼️";
  stickerTab.className = "tab-btn";

  const gifTab = document.createElement("button");
  gifTab.textContent = "🎞️";
  gifTab.className = "tab-btn";

  [emojiTab, stickerTab, gifTab].forEach((btn) => {
    btn.style.flex = "1";
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "1.3em";
    btn.style.padding = "6px";
    btn.style.color = "#fff";
  });

  tabs.appendChild(emojiTab);
  tabs.appendChild(stickerTab);
  tabs.appendChild(gifTab);
  picker.appendChild(tabs);

  // --- Content area ---
  const content = document.createElement("div");
  content.id = "picker-content";
  picker.appendChild(content);

  // --- Emoji data ---
  const emojis = [
    "😀",
    "😊",
    "😂",
    "❤️",
    "👍",
    "🎉",
    "🔥",
    "⭐",
    "🙏",
    "👏",
    "😎",
    "😢",
    "🤔",
    "😡",
    "🥳",
    "💯",
    "🎶",
    "🍕",
    "🍀",
    "⚡",
    "👋",
    "💃",
    "🕺",
  ];

  // --- Stickers (use sample placeholders or your URLs) ---
  const stickers = [
    "https://media.tenor.com/FGY-nz6R4uIAAAAC/thumbs-up.gif",
    "https://media.tenor.com/bD0f8YRVyH8AAAAC/party-cat.gif",
    "https://media.tenor.com/VDYcJtff5Q0AAAAC/hug.gif",
  ];

  // --- GIFs (sample) ---
  const gifs = [
    "https://media.giphy.com/media/Ju7l5y9osyymQ/giphy.gif",
    "https://media.giphy.com/media/l0MYB8Ory7Hqefo9a/giphy.gif",
    "https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif",
  ];

  // --- Load Emoji Content ---
  function loadEmojis() {
    content.innerHTML = "";
    emojis.forEach((emoji) => {
      const span = document.createElement("span");
      span.textContent = emoji;
      span.style.cursor = "pointer";
      span.style.fontSize = "1.3em";
      span.style.padding = "4px";
      span.addEventListener("click", () => {
        messageInput.value += emoji;
        messageInput.focus();
        updateSendButtonState();
        picker.remove();
      });
      content.appendChild(span);
    });
  }

  // --- Load Sticker Content ---
  function loadStickers() {
    content.innerHTML = "";
    stickers.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.style.width = "60px";
      img.style.margin = "4px";
      img.style.cursor = "pointer";
      img.addEventListener("click", () => {
        messageInput.value += `[Sticker:${url}]`;
        messageInput.focus();
        updateSendButtonState();
        picker.remove();
      });
      content.appendChild(img);
    });
  }

  // --- Load GIF Content ---
  function loadGIFs() {
    content.innerHTML = "";
    gifs.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.style.width = "70px";
      img.style.margin = "4px";
      img.style.cursor = "pointer";
      img.addEventListener("click", () => {
        messageInput.value += `[GIF:${url}]`;
        messageInput.focus();
        updateSendButtonState();
        picker.remove();
      });
      content.appendChild(img);
    });
  }

  // Default: Emoji tab active
  loadEmojis();

  // Tab event listeners
  emojiTab.addEventListener("click", () => {
    emojiTab.classList.add("active");
    stickerTab.classList.remove("active");
    gifTab.classList.remove("active");
    loadEmojis();
  });

  stickerTab.addEventListener("click", () => {
    stickerTab.classList.add("active");
    emojiTab.classList.remove("active");
    gifTab.classList.remove("active");
    loadStickers();
  });

  gifTab.addEventListener("click", () => {
    gifTab.classList.add("active");
    emojiTab.classList.remove("active");
    stickerTab.classList.remove("active");
    loadGIFs();
  });

  document.body.appendChild(picker);

  // Close picker when clicking outside
  setTimeout(() => {
    const closePicker = (e) => {
      if (!picker.contains(e.target) && e.target !== emojiBtn) {
        picker.remove();
        document.removeEventListener("click", closePicker);
      }
    };
    document.addEventListener("click", closePicker);
  }, 100);
}

function handleAttachClick() {
  // Create file input for attachments
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "*/*"; // Accept all file types
  fileInput.style.display = "none";

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      sendFileMessage(file);
    }
  };

  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

function handleVideoClick(e) {
  e.preventDefault();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Your browser does not support video recording.");
    return;
  }

  // Already recording? Stop recording
  if (videoRecorder && videoRecorder.state === "recording") {
    stopVideoRecording();
    return;
  }

  if (!videoOverlay || !videoPreview) {
    console.error("Video overlay or preview not found!");
    return;
  }

  // Show overlay
  videoOverlay.style.display = "flex";

  // Start video recording
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      videoStream = stream;
      videoPreview.srcObject = stream;
      videoPreview.play();

      videoRecorder = new MediaRecorder(stream);
      const videoChunks = [];

      videoRecorder.ondataavailable = (e) => videoChunks.push(e.data);

      videoRecorder.onstop = () => {
        const videoBlob = new Blob(videoChunks, { type: "video/mp4" });
        sendVideoMessage(videoBlob);

        // Stop all tracks and hide overlay
        stream.getTracks().forEach((t) => t.stop());
        videoPreview.srcObject = null;
        videoOverlay.style.display = "none";

        videoStream = null;
        videoRecorder = null;
        videoBtn.style.color = "#666"; // reset
        videoBtn.title = "Record video";

        console.log("Video recording stopped and sent");
      };

      videoRecorder.start();
      videoBtn.style.color = "#f56565"; // recording
      videoBtn.title = "Stop recording video";

      console.log("Video recording started");
    })
    .catch((err) => {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
      videoOverlay.style.display = "none";
    });
}

// Stop recording manually
function stopVideoRecording() {
  if (videoRecorder && videoRecorder.state === "recording") {
    videoRecorder.stop();
  } else if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoPreview.srcObject = null;
    videoOverlay.style.display = "none";
    videoBtn.style.color = "#666";
  }
}

// Cancel button in overlay
videoCancelBtn?.addEventListener("click", () => {
  stopVideoRecording();
});

function handleVideoFileSelect(e) {
  e.preventDefault();
  // Right click - select video file
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "video/*";
  fileInput.style.display = "none";

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        sendVideoFileMessage(file);
      } else {
        alert("Please select a video file.");
      }
    }
  };

  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

function stopVideoRecording() {
  if (videoRecorder && videoRecorder.state === "recording") {
    videoRecorder.stop();
    videoBtn.style.color = "#666"; // Reset color
    videoBtn.title = "Record video";
    console.log("Video recording stopped");
  }
}

function sendFileMessage(file) {
  if (!socket?.connected) {
    alert("Not connected to server.");
    return;
  }

  if (!currentChannelId) {
    alert("Please select a channel first or connect to a user.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    const fileBase64 = reader.result.split(",")[1];
    const fileType = file.type || "application/octet-stream";

    // Generate a tempId to track optimistic messages
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`;

    // Build temporary optimistic message
    const tempMessage = {
      tempId,
      content: `📎 ${file.name}`,
      senderName: username,
      senderId: socket.auth?.userId,
      createdAt: new Date().toISOString(),
      channelId: currentChannelId,
      persisted: false,
      messageType: "file",
      fileData: fileBase64,
      fileName: file.name,
      fileType: fileType,
      fileSize: file.size,
      fileBlob: file,
    };

    tempMessages.set(tempId, tempMessage);

    // Render immediately with download link
    if (messagesContainer) {
      const div = document.createElement("div");
      div.classList.add("message", "outgoing");
      div.dataset.tempId = tempId;

      const fileUrl = URL.createObjectURL(file);

      div.innerHTML = `
        <div class="username">${escapeHtml(username)}</div>
        <div class="content">
          <a href="${fileUrl}" download="${escapeHtml(
        file.name
      )}" class="file-download">
            📎 ${escapeHtml(file.name)} (${formatFileSize(file.size)})
          </a>
        </div>
        <div class="timestamp">${formatTimestamp(tempMessage.createdAt)}</div>
        <span class="message-status" style="color:#bbb;">…</span>
      `;

      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // === Direct Chat ===
    if (currentChannelType === "direct") {
      const senderId = socket.auth?.userId;
      const receiverId = window.currentReceiverId;

      const channelId = findDirectChannelId(senderId, receiverId);
      if (!channelId) {
        alert("No valid direct channel found for this user pair.");
        return;
      }

      const messageData = {
        senderId,
        receiverId,
        channelId,
        content: `📎 ${file.name}`,
        tempId,
        messageType: "file",
        fileData: fileBase64,
        fileName: file.name,
        fileType: fileType,
        fileSize: file.size,
        metadata: {
          type: "direct",
          timestamp: new Date().toISOString(),
          participants: [senderId, receiverId],
        },
      };

      console.log(
        `[CLIENT] Sending file via channel ${channelId}`,
        messageData
      );
      socket.emit("message:send", messageData);
    }

    // === Group Chat ===
    else if (currentChannelType === "group") {
      const messageData = {
        groupId: currentChannelId,
        content: `📎 ${file.name}`,
        tempId,
        messageType: "file",
        fileData: fileBase64,
        fileName: file.name,
        fileType: fileType,
        fileSize: file.size,
        metadata: {
          type: "group",
          timestamp: new Date().toISOString(),
          groupId: currentChannelId,
        },
      };

      console.log(
        `[CLIENT] Sending group file → ${currentChannelId}`,
        messageData
      );
      socket.emit("group:message:send", messageData);
    }
  };

  reader.readAsDataURL(file);
}

// Replace the sendVideoMessage function
function sendVideoMessage(videoBlob) {
  if (!socket?.connected) {
    alert("Not connected to server.");
    return;
  }

  if (!currentChannelId) {
    alert("Please select a channel first or connect to a user.");
    return;
  }

  // Generate a tempId to track optimistic messages
  const tempId = `temp-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 5)}`;
  const fileName = `video-${Date.now()}.mp4`;

  // Build temporary optimistic message
  const tempMessage = {
    tempId,
    content: "[Video message]",
    senderName: username,
    senderId: socket.auth?.userId,
    createdAt: new Date().toISOString(),
    channelId: currentChannelId,
    persisted: false,
    messageType: "video",
    fileName: fileName,
    fileSize: videoBlob.size,
    videoBlob: videoBlob,
  };

  tempMessages.set(tempId, tempMessage);

  // Render immediately with video player
  if (messagesContainer) {
    const div = document.createElement("div");
    div.classList.add("message", "outgoing");
    div.dataset.tempId = tempId;

    const videoUrl = URL.createObjectURL(videoBlob);
    div.innerHTML = `
      <div class="username">${escapeHtml(username)}</div>
      <div class="content">
        <video class="video-player" controls width="250">
          <source src="${videoUrl}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
        <div>
          <a href="${videoUrl}" download="${fileName}" class="file-download">
            📥 Download Video (${formatFileSize(videoBlob.size)})
          </a>
        </div>
      </div>
      <div class="timestamp">${formatTimestamp(tempMessage.createdAt)}</div>
      <span class="message-status" style="color:#bbb;">…</span>
    `;

    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Convert to base64 for small videos, but warn for large ones
  if (videoBlob.size > 10 * 1024 * 1024) {
    // 10MB limit
    if (
      !confirm("Video is large (>10MB). This may cause issues. Send anyway?")
    ) {
      return;
    }
  }

  const reader = new FileReader();
  reader.onload = function () {
    const videoBase64 = reader.result.split(",")[1];

    // === Direct Chat ===
    if (currentChannelType === "direct") {
      const senderId = socket.auth?.userId;
      const receiverId = window.currentReceiverId;

      const channelId = findDirectChannelId(senderId, receiverId);
      if (!channelId) {
        alert("No valid direct channel found for this user pair.");
        return;
      }

      const messageData = {
        senderId,
        receiverId,
        channelId,
        content: "[Video message]",
        tempId,
        messageType: "video",
        videoData: videoBase64,
        fileName: fileName,
        fileSize: videoBlob.size,
        metadata: {
          type: "direct",
          timestamp: new Date().toISOString(),
          participants: [senderId, receiverId],
        },
      };

      console.log(
        `[CLIENT] Sending video via channel ${channelId}`,
        messageData
      );
      socket.emit("message:send", messageData);
    }
    // === Group Chat ===
    else if (currentChannelType === "group") {
      const messageData = {
        groupId: currentChannelId,
        content: "[Video message]",
        tempId,
        messageType: "video",
        videoData: videoBase64,
        fileName: fileName,
        fileSize: videoBlob.size,
        metadata: {
          type: "group",
          timestamp: new Date().toISOString(),
          groupId: currentChannelId,
        },
      };

      console.log(
        `[CLIENT] Sending group video → ${currentChannelId}`,
        messageData
      );
      socket.emit("group:message:send", messageData);
    }
  };

  reader.onerror = function () {
    console.error("Failed to read video file");
    alert("Failed to process video. Please try a smaller file.");
  };

  reader.readAsDataURL(videoBlob);
}

function sendVideoFileMessage(file) {
  if (!socket?.connected) {
    alert("Not connected to server.");
    return;
  }

  if (!currentChannelId) {
    alert("Please select a channel first or connect to a user.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    const videoBase64 = reader.result.split(",")[1];

    // Generate a tempId to track optimistic messages
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`;

    // Build temporary optimistic message
    const tempMessage = {
      tempId,
      content: `🎥 ${file.name}`,
      senderName: username,
      senderId: socket.auth?.userId,
      createdAt: new Date().toISOString(),
      channelId: currentChannelId,
      persisted: false,
      messageType: "video",
      videoData: videoBase64,
      fileName: file.name,
      fileSize: file.size,
      fileBlob: file,
    };

    tempMessages.set(tempId, tempMessage);

    // Render immediately with video player
    if (messagesContainer) {
      const div = document.createElement("div");
      div.classList.add("message", "outgoing");
      div.dataset.tempId = tempId;

      const videoUrl = URL.createObjectURL(file);

      div.innerHTML = `
        <div class="username">${escapeHtml(username)}</div>
        <div class="content">
          <video class="video-player" controls width="250">
            <source src="${videoUrl}" type="${file.type}">
            Your browser does not support the video tag.
          </video>
          <div>
            <a href="${videoUrl}" download="${escapeHtml(
        file.name
      )}" class="file-download">
              📥 Download Video (${formatFileSize(file.size)})
            </a>
          </div>
        </div>
        <div class="timestamp">${formatTimestamp(tempMessage.createdAt)}</div>
        <span class="message-status" style="color:#bbb;">…</span>
      `;

      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // === Direct Chat ===
    if (currentChannelType === "direct") {
      const senderId = socket.auth?.userId;
      const receiverId = window.currentReceiverId;

      const channelId = findDirectChannelId(senderId, receiverId);
      if (!channelId) {
        alert("No valid direct channel found for this user pair.");
        return;
      }

      const messageData = {
        senderId,
        receiverId,
        channelId,
        content: `🎥 ${file.name}`,
        tempId,
        messageType: "video",
        videoData: videoBase64,
        fileName: file.name,
        fileSize: file.size,
        metadata: {
          type: "direct",
          timestamp: new Date().toISOString(),
          participants: [senderId, receiverId],
        },
      };

      console.log(
        `[CLIENT] Sending video file via channel ${channelId}`,
        messageData
      );
      socket.emit("message:send", messageData);
    }

    // === Group Chat ===
    else if (currentChannelType === "group") {
      const messageData = {
        groupId: currentChannelId,
        content: `🎥 ${file.name}`,
        tempId,
        messageType: "video",
        videoData: videoBase64,
        fileName: file.name,
        fileSize: file.size,
        metadata: {
          type: "group",
          timestamp: new Date().toISOString(),
          groupId: currentChannelId,
        },
      };

      console.log(
        `[CLIENT] Sending group video file → ${currentChannelId}`,
        messageData
      );
      socket.emit("group:message:send", messageData);
    }
  };

  reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// MESSAGE DISPLAY
// Helper: safely render message content with GIFs and Stickers
function renderMessageContent(rawText) {
  if (!rawText) return "";

  // Escape HTML first for safety
  let safeText = escapeHtml(rawText);

  // Replace [GIF:...] and [Sticker:...] placeholders with <img> tags
  safeText = safeText
    .replace(
      /\[gif:\s*(https?:\/\/[^\]]+)\]/gi,
      '<img src="$1" alt="GIF" class="chat-gif">'
    )
    .replace(
      /\[sticker:\s*(https?:\/\/[^\]]+)\]/gi,
      '<img src="$1" alt="Sticker" class="chat-sticker">'
    );

  return safeText;
}

function addMessage(msg) {
  if (!msg) return;

  // Skip re-render if we already showed the optimistic message
  if (msg.tempId && tempMessages.has(msg.tempId)) {
    updateMessageStatus(msg.tempId, {
      text: "✓✓",
      color: "#5c2d91",
      bold: true,
    });
    tempMessages.delete(msg.tempId);
    return;
  }

  // Avoid duplicates
  const messageId = msg.id || msg.tempId;
  if (receivedMessageIds.has(messageId)) {
    console.log("Duplicate message detected, skipping:", messageId);
    return;
  }
  receivedMessageIds.add(messageId);

  // Clean up old IDs
  if (receivedMessageIds.size > 1000) {
    const iterator = receivedMessageIds.values();
    for (let i = 0; i < 500; i++) {
      receivedMessageIds.delete(iterator.next().value);
    }
  }

  const channelId = msg.channelId || msg.groupId || msg.receiverId;
  if (!channelId || channelId !== currentChannelId) {
    console.log("Message for different channel, ignoring");
    return;
  }

  // Render normally if not optimistic
  const div = document.createElement("div");
  div.classList.add("message");

  const isOwnMessage =
    msg.senderId === socket?.id || msg.senderName === username;
  div.classList.add(isOwnMessage ? "outgoing" : "incoming");

  const senderName = msg.senderName || msg.senderId || "Unknown";
  const timestamp = msg.createdAt || msg.timestamp || new Date().toISOString();

  let contentHtml = "";
  let statusHtml = "";

  // Handle different message types with proper media players
  if (msg.messageType === "audio" && msg.audioData) {
    const audioUrl = `data:audio/wav;base64,${msg.audioData}`;
    contentHtml = `<audio class="audio-player" controls>
      <source src="${audioUrl}" type="audio/wav">
      Your browser does not support the audio element.
    </audio>`;
  } else if (msg.messageType === "file") {
    const fileUrl = `data:${msg.fileType};base64,${msg.fileData}`;
    contentHtml = `<a href="${fileUrl}" download="${escapeHtml(
      msg.fileName || "file"
    )}" class="file-download">
      📎 ${escapeHtml(msg.fileName || "File")} (${formatFileSize(
      msg.fileSize || 0
    )})
    </a>`;
  } else if (msg.messageType === "video" && msg.videoData) {
    const videoUrl = `data:video/mp4;base64,${msg.videoData}`;
    contentHtml = `<video class="video-player" controls width="250">
      <source src="${videoUrl}" type="video/mp4">
      Your browser does not support the video tag.
    </video>`;
    if (msg.fileName) {
      contentHtml += `<div>
        <a href="${videoUrl}" download="${escapeHtml(
        msg.fileName
      )}" class="file-download">
          📥 Download Video (${formatFileSize(msg.fileSize || 0)})
        </a>
      </div>`;
    }
  } else if (msg.messageType === "gif" && msg.content) {
    contentHtml = `<img src="${escapeHtml(
      msg.content
    )}" alt="GIF" class="chat-gif">`;
  } else if (msg.messageType === "sticker" && msg.content) {
    contentHtml = `<img src="${escapeHtml(
      msg.content
    )}" alt="Sticker" class="chat-sticker">`;
  } else {
    // Default to text message (with GIF/Sticker rendering)
    const content = msg.content || msg.message || "";
    contentHtml = renderMessageContent(content);
  }

  if (isOwnMessage) {
    let statusText = "✓✓";
    let statusColor = "#4e4f50ff";
    let isBold = false;

    if (msg.persisted) {
      statusColor = "#5c2d91";
      isBold = true;
    }

    statusHtml = `<span class="message-status" style="color: ${statusColor}; ${
      isBold ? "font-weight: bold;" : ""
    }">${statusText}</span>`;
  }

  div.innerHTML = `
    <div class="username">${escapeHtml(senderName)}</div>
    <div class="content">${contentHtml}</div>
    <div class="timestamp">${formatTimestamp(timestamp)}</div>
    ${statusHtml}
  `;

  if (msg.tempId) div.dataset.tempId = msg.tempId;

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// === CLEAN CONNECT HANDLER ===
function handleConnect() {
  const userName = document
    .getElementById("userName")
    .value.trim()
    .toLowerCase();
  const receiverName = document
    .getElementById("receiverName")
    .value.trim()
    .toLowerCase();

  const userId = USER_MAP[userName];
  const receiverId = USER_MAP[receiverName];

  if (!userId) {
    alert(
      "Unknown or missing user name. Please use: " +
        Object.keys(USER_MAP).join(", ")
    );
    return;
  }

  // Clear previous state
  receivedMessageIds.clear();
  tempMessages.clear();
  clearMessages();

  let channelId, channelType;

  if (receiverId) {
    // DIRECT CHAT MODE: Find existing direct channel for these users
    channelId = findDirectChannelId(userId, receiverId);

    if (!channelId) {
      alert(
        `No existing direct channel found between ${userName} and ${receiverName}. Please use predefined user pairs.`
      );
      return;
    }

    channelType = "direct";

    console.log(
      `🔹 Direct chat: ${userName} → ${receiverName} (using channel: ${channelId})`
    );

    // Update UI immediately
    document.getElementById(
      "chat-title"
    ).textContent = `Chat: ${userName} ↔ ${receiverName}`;
    document.getElementById(
      "connected-user"
    ).textContent = `Connected as: ${userName}`;

    // keep your function
    let unreadCount = 0;

    function showUnreadCount(count) {
      const indicator = document.getElementById("unread-indicator");
      if (!indicator) return;

      if (count > 0) {
        indicator.style.display = "block";
        indicator.textContent = `${count} unread message${
          count > 1 ? "s" : ""
        }`;
      } else {
        indicator.style.display = "none";
        indicator.textContent = "";
      }
    }

    // Reset unread count when user focuses the page
    window.addEventListener("focus", () => {
      unreadCount = 0;
      showUnreadCount(0);
    });

    // Initialize connection and join private channel
    if (!socket || !socket.connected) {
      initSocketConnection(userId, userName, () => {
        joinChannel(channelId, channelType, receiverId, receiverName);
      });
    } else {
      joinChannel(channelId, channelType, receiverId, receiverName);
    }
  } else {
    // GROUP CHAT MODE: Just connect, user will click channels
    console.log(`🔹 Group chat mode: ${userName}`);

    // Update UI
    document.getElementById("chat-title").textContent =
      "Select a channel to start chatting";
    document.getElementById(
      "connected-user"
    ).textContent = `Connected as: ${userName}`;

    if (!socket || !socket.connected) {
      initSocketConnection(userId, userName);
    }

    // Enable input for group channels (will be used when channel is selected)
    updateInputState(true);
  }
}

// Helper function to find existing direct channel for two users
function findDirectChannelId(userId, receiverId) {
  for (const [channelId, mappedReceiverId] of Object.entries(DIRECT_CHANNELS)) {
    if (mappedReceiverId === receiverId) {
      return channelId.split(":")[0]; // ensures we only return valid predefined IDs
    }
  }
  return null;
}

function setupChannelButtons() {
  const channelButtons = document.querySelectorAll(
    ".channels button[data-channel]"
  );

  channelButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Only allow channel switching in GROUP mode (no active receiver)
      if (window.currentReceiverId) {
        alert(
          "Switch to group mode first by connecting without a receiver name."
        );
        return;
      }

      const channelId = this.getAttribute("data-channel");
      const channelType = this.getAttribute("data-type");

      // Update active state
      channelButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      // Update chat title
      const channelName = this.querySelector(".channel-name").textContent;
      document.getElementById("chat-title").textContent = channelName;

      joinChannel(channelId, channelType);
    });
  });
}

// CONNECTION
function initSocketConnection(userId, name, onConnected = null) {
  // Clean up previous socket if any
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  username = name;
  socket = io("http://localhost:4000", {
    path: "/socket/v1",
    auth: { userId, name },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log(`[Socket] Connected as ${name} (${socket.id})`);
    updateStatus("connected", `Connected as ${name}`);

    document.getElementById(
      "connected-user"
    ).textContent = `Connected as ${name}`;
    if (connectedUserLabel) {
      connectedUserLabel.textContent = `Connected as: ${name}`;
    }

    registerSocketHandlers();
    registerMessageStatusHandlers();

    // Clear any previous state
    receivedMessageIds.clear();
    handledStatusUpdates.clear();

    // Notify backend that this user has connected
    socket.emit("user:connected", socket.auth.userId);

    // Call onConnected callback if provided
    if (onConnected) {
      onConnected();
    }
  });

  socket.on("disconnect", (reason) => {
    console.warn("[Socket] Disconnected:", reason);
    updateStatus("disconnected", "Disconnected");
    updateInputState(false);
  });

  socket.on("connect_error", (error) => {
    console.error("[Socket] Connection error:", error);
    updateStatus("error", "Connection failed");
    updateInputState(false);
  });
}

// CHANNEL JOINING
function joinChannel(channelId, type, receiverId = null, receiverName = null) {
  if (!socket?.connected) {
    alert("Please connect first.");
    return;
  }

  // Clear previous channel state
  receivedMessageIds.clear();
  tempMessages.clear();

  currentChannelId = channelId;
  currentChannelType = type;

  // Store receiver info for direct chat
  if (receiverId) {
    window.currentReceiverId = receiverId;
    window.currentReceiverName = receiverName;
  }

  clearMessages();

  console.log(`Joining ${type} channel: ${channelId}`);

  if (type === "group") {
    socket.emit("group:join", { groupId: channelId });
    socket.emit("group:history", { groupId: channelId });
  } else {
    const targetReceiverId =
      receiverId || DIRECT_CHANNELS[channelId] || channelId;
    socket.emit("direct:history", { receiverId: targetReceiverId });
  }

  // Enable input immediately
  updateInputState(true);

  addSystemMessage(`You joined ${getChannelName(channelId)}.`);
}

function getChannelName(channelId) {
  for (const [name, id] of Object.entries(CHANNELS)) {
    if (id === channelId) {
      return name.replace("_", " ").toLowerCase();
    }
  }
  return "Unknown Channel";
}

// MESSAGING - Updated to handle both text and voice
function sendTextMessage() {
  if (!socket?.connected) {
    alert("Not connected to server.");
    return;
  }

  if (!currentChannelId) {
    alert("Please select a channel first or connect to a user.");
    return;
  }

  const msgContent = messageInput.value.trim();
  if (!msgContent) return;

  // Generate a tempId to track optimistic messages
  const tempId = `temp-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 5)}`;

  // Build temporary optimistic message
  const tempMessage = {
    tempId,
    content: msgContent,
    senderName: username,
    senderId: socket.auth?.userId,
    createdAt: new Date().toISOString(),
    channelId: currentChannelId,
    persisted: false, // flag for display
    messageType: "text",
  };

  tempMessages.set(tempId, tempMessage);

  // Render immediately
  if (messagesContainer) {
    const div = document.createElement("div");
    div.classList.add("message", "outgoing");
    div.dataset.tempId = tempId;

    div.innerHTML = `
      <div class="username">${escapeHtml(username)}</div>
      <div class="content">${escapeHtml(msgContent)}</div>
      <div class="timestamp">${formatTimestamp(tempMessage.createdAt)}</div>
      <span class="message-status" style="color:#bbb;">…</span>
    `;

    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // === Direct Chat ===
  if (currentChannelType === "direct") {
    const senderId = socket.auth?.userId;
    const receiverId = window.currentReceiverId;

    const channelId = findDirectChannelId(senderId, receiverId);
    if (!channelId) {
      alert("No valid direct channel found for this user pair.");
      return;
    }

    const messageData = {
      senderId,
      receiverId,
      channelId,
      content: msgContent,
      tempId,
      messageType: "text",
      metadata: {
        type: "direct",
        timestamp: new Date().toISOString(),
        participants: [senderId, receiverId],
      },
    };

    console.log(
      `[CLIENT] Sending direct message via channel ${channelId}`,
      messageData
    );
    socket.emit("message:send", messageData);
  }

  // === Group Chat ===
  else if (currentChannelType === "group") {
    const messageData = {
      groupId: currentChannelId,
      content: msgContent,
      tempId,
      messageType: "text",
      metadata: {
        type: "group",
        timestamp: new Date().toISOString(),
        groupId: currentChannelId,
      },
    };

    console.log(
      `[CLIENT] Sending group message → ${currentChannelId}`,
      messageData
    );
    socket.emit("group:message:send", messageData);
  }

  // Cleanup input & typing state
  messageInput.value = "";
  updateSendButtonState();
  stopTyping();
}

// TYPING HANDLER
function handleTyping() {
  if (!socket || !socket.connected || !currentChannelId) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit("typing:start", {
      conversationId: currentChannelId,
      type: currentChannelType,
    });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 2000);
}

function stopTyping() {
  if (isTyping && socket?.connected && currentChannelId) {
    socket.emit("typing:stop", {
      conversationId: currentChannelId,
    });
    isTyping = false;
  }
  clearTimeout(typingTimeout);
}

// SOCKET HANDLERS
function registerSocketHandlers() {
  // === Channel Loading ===
  socket.on("channels:load", (channels) => {
    console.log("Channels loaded from server:", channels);
    window.myChannels = channels;

    // Optionally render them dynamically if you have a sidebar or list
    const channelListContainer = document.getElementById("channel-list");
    if (channelListContainer) {
      channelListContainer.innerHTML = "";
      channels.forEach((c) => {
        const li = document.createElement("li");
        li.textContent = `${c.name || "Unnamed"} (${
          c.participants?.length || 0
        } members)`;
        li.onclick = () => joinChannel(c.id, c.type || "direct");
        channelListContainer.appendChild(li);
      });
    }
  });

  // --- Direct Messages ---
  socket.on("message:receive", (msg) => {
    addMessage(msg);
    unreadCount++;
    showUnreadCount(unreadCount);
  });
  socket.on("direct:history", ({ messages }) => {
    console.log("Loading direct message history:", messages?.length);
    if (messages && Array.isArray(messages)) {
      messages.forEach(addMessage);
    }
  });
  socket.on("message:error", (err) => {
    console.error("Direct message error:", err);
    addSystemMessage(`Error: ${err.error || "Failed to send message"}`);
  });

  // --- Group Messages ---
  socket.on("group:message:receive", (msg) => {
    addMessage(msg);
    unreadCount++;
    showUnreadCount(unreadCount);
  });
  socket.on("group:history", ({ messages }) => {
    console.log("Loading group message history:", messages?.length);
    if (messages && Array.isArray(messages)) {
      messages.forEach(addMessage);
    }
  });
  socket.on("group:message:error", (err) => {
    console.error("Group message error:", err);
    addSystemMessage(`Error: ${err.error || "Failed to send group message"}`);
  });

  // --- Group Membership Events ---
  socket.on("group:member:left", (data) => addSystemMessage(`User left group`));
  socket.on("group:leave:ack", (data) => addSystemMessage(`You left group`));
  socket.on("group:leave:error", (err) =>
    addSystemMessage(`Error leaving group: ${err.error}`)
  );

  // --- Presence Events ---
  socket.on("users:online", (list) => console.log("Online users:", list));
  socket.on("user_joined", (data) =>
    addSystemMessage(`${data.username || "Someone"} joined`)
  );
  socket.on("user_left", (data) =>
    addSystemMessage(`${data.username || "Someone"} left`)
  );
  socket.on("user_online", (data) =>
    console.log(`${data.username || "Someone"} is online`)
  );
  socket.on("user_offline", (data) =>
    console.log(`${data.username || "Someone"} went offline`)
  );

  // --- Typing Events ---
  socket.on("typing:start", (data) => {
    typingIndicator.textContent = `${data.username || "Someone"} is typing...`;
  });
  socket.on("typing:stop", () => {
    typingIndicator.textContent = "";
  });

  // --- Error Handling ---
  socket.on("error", (err) => {
    console.error("Socket error:", err);
    addSystemMessage(`Error: ${err.message || JSON.stringify(err)}`);
  });
  socket.on("auth_error", (err) => {
    alert("Authentication error: " + (err.message || "Invalid credentials"));
  });
}

// MESSAGE STATUS HANDLERS
function registerMessageStatusHandlers() {
  const statusMap = {
    ack: { text: "✓", color: "#4e4f50ff" },
    delivered: { text: "✓✓", color: "#4e4f50ff" },
    persisted: { text: "✓✓", color: "#5c2d91", bold: true },
  };

  function handleStatusUpdate(type, data, mapKey) {
    if (!data?.tempId) return;

    const statusKey = `${type}-${data.tempId}`;
    if (handledStatusUpdates.has(statusKey)) {
      console.log("Duplicate status update, skipping:", statusKey);
      return;
    }
    handledStatusUpdates.add(statusKey);

    updateMessageStatus(data.tempId, statusMap[type]);

    // Clean up old status keys to prevent memory leaks
    if (handledStatusUpdates.size > 1000) {
      const iterator = handledStatusUpdates.values();
      for (let i = 0; i < 500; i++) {
        handledStatusUpdates.delete(iterator.next().value);
      }
    }
  }

  // Direct messages
  socket.on("message:ack", (data) => handleStatusUpdate("ack", data));
  socket.on("message:delivered", (data) =>
    handleStatusUpdate("delivered", data)
  );
  socket.on("message:persisted", (data) =>
    handleStatusUpdate("persisted", data)
  );

  // Group messages
  socket.on("group:message:ack", (data) => handleStatusUpdate("ack", data));
  socket.on("group:message:delivered", (data) =>
    handleStatusUpdate("delivered", data)
  );
  socket.on("group:message:persisted", (data) =>
    handleStatusUpdate("persisted", data)
  );
}

// MESSAGE DISPLAY - Updated to handle different message types with proper media playback
function addMessage(msg) {
  if (!msg) return;

  // Skip re-render if we already showed the optimistic message
  if (msg.tempId && tempMessages.has(msg.tempId)) {
    updateMessageStatus(msg.tempId, {
      text: "✓✓",
      color: "#5c2d91",
      bold: true,
    });
    tempMessages.delete(msg.tempId);
    return;
  }

  // Avoid duplicates
  const messageId = msg.id || msg.tempId;
  if (receivedMessageIds.has(messageId)) {
    console.log("Duplicate message detected, skipping:", messageId);
    return;
  }
  receivedMessageIds.add(messageId);

  // Clean up old IDs
  if (receivedMessageIds.size > 1000) {
    const iterator = receivedMessageIds.values();
    for (let i = 0; i < 500; i++) {
      receivedMessageIds.delete(iterator.next().value);
    }
  }

  const channelId = msg.channelId || msg.groupId || msg.receiverId;
  if (!channelId || channelId !== currentChannelId) {
    console.log("Message for different channel, ignoring");
    return;
  }

  // Render normally if not optimistic
  const div = document.createElement("div");
  div.classList.add("message");

  const isOwnMessage =
    msg.senderId === socket?.id || msg.senderName === username;
  div.classList.add(isOwnMessage ? "outgoing" : "incoming");

  const senderName = msg.senderName || msg.senderId || "Unknown";
  const timestamp = msg.createdAt || msg.timestamp || new Date().toISOString();

  let contentHtml = "";
  let statusHtml = "";

  // Handle different message types with proper media players
  if (msg.messageType === "audio" && msg.audioData) {
    const audioUrl = `data:audio/wav;base64,${msg.audioData}`;
    contentHtml = `<audio class="audio-player" controls>
      <source src="${audioUrl}" type="audio/wav">
      Your browser does not support the audio element.
    </audio>`;
  } else if (msg.messageType === "file") {
    const fileUrl = `data:${msg.fileType};base64,${msg.fileData}`;
    contentHtml = `<a href="${fileUrl}" download="${escapeHtml(
      msg.fileName || "file"
    )}" class="file-download">
      📎 ${escapeHtml(msg.fileName || "File")} (${formatFileSize(
      msg.fileSize || 0
    )})
    </a>`;
  } else if (msg.messageType === "video" && msg.videoData) {
    const videoUrl = `data:video/mp4;base64,${msg.videoData}`;
    contentHtml = `<video class="video-player" controls width="250">
      <source src="${videoUrl}" type="video/mp4">
      Your browser does not support the video tag.
    </video>`;
    if (msg.fileName) {
      contentHtml += `<div>
        <a href="${videoUrl}" download="${escapeHtml(
        msg.fileName
      )}" class="file-download">
          📥 Download Video (${formatFileSize(msg.fileSize || 0)})
        </a>
      </div>`;
    }
  } else {
    // Default to text message
    const content = msg.content || msg.message || "";
    contentHtml = escapeHtml(content);
  }

  if (isOwnMessage) {
    let statusText = "✓✓";
    let statusColor = "#4e4f50ff";
    let isBold = false;

    if (msg.persisted) {
      statusColor = "#5c2d91";
      isBold = true;
    }

    statusHtml = `<span class="message-status" style="color: ${statusColor}; ${
      isBold ? "font-weight: bold;" : ""
    }">${statusText}</span>`;
  }

  div.innerHTML = `
    <div class="username">${escapeHtml(senderName)}</div>
    <div class="content">${contentHtml}</div>
    <div class="timestamp">${formatTimestamp(timestamp)}</div>
    ${statusHtml}
  `;

  if (msg.tempId) div.dataset.tempId = msg.tempId;

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// UI HELPERS
function updateInputState(connected) {
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-btn");
  const emojiBtn = document.getElementById("emoji-btn");
  const attachBtn = document.getElementById("attach-btn");
  const videoBtn = document.getElementById("video-btn");

  if (connected && currentChannelId) {
    messageInput.disabled = false;
    sendButton.disabled = false;
    emojiBtn.disabled = false;
    attachBtn.disabled = false;
    videoBtn.disabled = false;
    messageInput.placeholder = "Type a message...";

    if (videoBtn) {
      // Left-click → start video recording
      videoBtn.addEventListener("click", showVideoRecording);

      // Right-click → select a video file
      videoBtn.addEventListener("contextmenu", handleVideoFileSelect);
    }
  } else {
    messageInput.disabled = true;
    sendButton.disabled = true;
    emojiBtn.disabled = true;
    attachBtn.disabled = true;
    videoBtn.disabled = true;
    messageInput.placeholder =
      "Type a message... (Connect and select a channel first)";
  }

  updateSendButtonState();
}

function updateMessageStatus(tempId, { text, color, bold = false }) {
  if (!messagesContainer || !tempId) return;

  const msgDiv = messagesContainer.querySelector(`[data-temp-id="${tempId}"]`);
  if (msgDiv) {
    const status = msgDiv.querySelector(".message-status");
    if (status) {
      status.textContent = text;
      status.style.color = color;
      status.style.fontWeight = bold ? "bold" : "normal";
    }
  }
}

function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "system-message";
  div.textContent = text;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeMessageByTempId(tempId) {
  const tempDiv = messagesContainer.querySelector(`[data-temp-id="${tempId}"]`);
  if (tempDiv) tempDiv.remove();
}

function clearMessages() {
  if (messagesContainer) {
    messagesContainer.innerHTML = "";
  }
  if (typingIndicator) {
    typingIndicator.textContent = "";
  }
}

function updateStatus(className, text) {
  if (!socketStatus) return;

  const dot = socketStatus.querySelector(".status-dot");
  const label = socketStatus.querySelector(".status-text");

  if (dot) dot.className = `status-dot ${className}`;
  if (label) label.textContent = text;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

// Utility to fetch channels from server
async function loadChannels() {
  try {
    const response = await fetch("/channels");
    const data = await response.json();
    console.log("Available channels:", data.channels);
    return data.channels;
  } catch (error) {
    console.error("Failed to load channels:", error);
    return [];
  }
}
