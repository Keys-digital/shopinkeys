/**
 * UI Helper Functions for Chat App
 * These handle DOM rendering for channels and messages.
 */
import { mediaHandler } from './media-handlers.js';


let messageInput, sendButton;
let socket = null;

export function setSocketReference(sock) {
  socket = sock;
}


const socketStatus = document.getElementById("socketio-status");
export const elements = {
  messageInput: document.getElementById("message-input"),
  sendButton: document.getElementById("send-btn"),
  emojiBtn: document.getElementById("emoji-btn"),
  attachBtn: document.getElementById("attach-btn"),
  videoBtn: document.getElementById("video-btn"),
};

// ==============================
// Input Area Functionality
// ==============================
function setupInputAreaFunctionality() {
  const { messageInput, sendButton, emojiBtn, attachBtn, videoBtn } = elements;

  if (!messageInput || !sendButton || !emojiBtn || !attachBtn || !videoBtn) {
    console.error("One or more input elements are missing in DOM");
    return;
  }

  messageInput.addEventListener("input", updateSendButtonState);
  emojiBtn.addEventListener("click", toggleEmojiPicker);
  attachBtn.addEventListener("click", handleAttachClick);
  videoBtn.addEventListener("click", mediaHandler.handleVideoClick);
videoBtn.addEventListener("contextmenu", mediaHandler.handleVideoFileSelect);

  updateSendButtonState();
}

function updateSendButtonState() {
    const { messageInput, sendButton } = elements;
  if (!messageInput || !sendButton) return;

  const hasText = messageInput.value?.trim() !== "";

  if (hasText) {
    sendButton.classList.remove("voice-mode");
    sendButton.title = "Send message";
  } else {
    sendButton.classList.add("voice-mode");
    sendButton.title = "Record voice message";
  }
}

function handleSendButtonClick() {
  if (!sendButton) return;

  if (sendButton.classList.contains("voice-mode")) {
    mediaHandler?.toggleVoiceRecording?.();
  } else {
    sendTextMessage?.();
  }
}

function handleAttachClick() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = false;
  fileInput.accept = "*/*";

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview overlay
    const overlay = document.createElement("div");
    overlay.id = "file-preview-overlay";
    overlay.style.cssText = `
      position: fixed; top:0; left:0; width:100%; height:100%;
      background: rgba(0,0,0,0.8); display:flex; align-items:center;
      justify-content:center; z-index:10000; flex-direction:column; padding:20px;
    `;

    const previewContainer = document.createElement("div");
    previewContainer.style.cssText = `
      background:#222; padding:20px; border-radius:10px; display:flex;
      flex-direction:column; align-items:center; max-width:90%; max-height:80%;
      overflow:auto;
    `;

    // File preview
    let previewEl;
    if (file.type.startsWith("image/")) {
      previewEl = document.createElement("img");
      previewEl.src = URL.createObjectURL(file);
      previewEl.style.maxWidth = "400px";
      previewEl.style.maxHeight = "300px";
    } else if (file.type.startsWith("video/")) {
      previewEl = document.createElement("video");
      previewEl.src = URL.createObjectURL(file);
      previewEl.controls = true;
      previewEl.style.maxWidth = "400px";
      previewEl.style.maxHeight = "300px";
    } else if (file.type.startsWith("audio/")) {
      previewEl = document.createElement("audio");
      previewEl.src = URL.createObjectURL(file);
      previewEl.controls = true;
    } else {
      previewEl = document.createElement("div");
      previewEl.textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
      previewEl.style.color = "#fff";
    }

    previewContainer.appendChild(previewEl);

    // Buttons
    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = "margin-top:15px; display:flex; gap:10px;";

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "Send";
    sendBtn.onclick = () => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(",")[1];
        sendMessage(
          { fileName: file.name, fileSize: file.size, fileType: file.type },
          "file",
          { fileData: base64Data }
        );
      };
      reader.readAsDataURL(file);
      document.body.removeChild(overlay);
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => document.body.removeChild(overlay);

    btnContainer.appendChild(sendBtn);
    btnContainer.appendChild(cancelBtn);
    previewContainer.appendChild(btnContainer);

    overlay.appendChild(previewContainer);
    document.body.appendChild(overlay);
  };

  fileInput.click();
}


// ==============================
// Plus Menu Functionality
// ==============================
function setupPlusMenu() {
  const plusBtn = document.getElementById("plus-btn");
  const plusMenu = document.getElementById("plus-menu");

  if (!plusBtn || !plusMenu) return;

  // --- Toggle menu visibility ---
  plusBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = plusMenu.style.display === "none" || plusMenu.style.display === "";
    plusMenu.style.display = isHidden ? "flex" : "none";
  });

  // --- Hide menu when clicking outside ---
  document.addEventListener("click", (e) => {
    if (!plusMenu.contains(e.target) && e.target !== plusBtn) {
      plusMenu.style.display = "none";
    }
  });

  // --- Handle option clicks ---
  plusMenu.querySelectorAll(".plus-option").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.type;
      plusMenu.style.display = "none";

      switch (type) {
        // SEND CONTACT
        case "contact": {
          const name = prompt("Enter contact name to share:");
          const phone = prompt("Enter phone number:");

          if (!name || !phone) {
            alert("Contact not shared — both fields required.");
            return;
          }

          const contact = { name, phone };

          // Keep a local in-memory contact list
          if (!window.userContacts) window.userContacts = [];
          const exists = window.userContacts.some(c => c.phone === phone);
          if (!exists) {
            window.userContacts.push(contact);
            console.log("Contact added:", contact);
          }

          client?.sendMessage({
            messageType: "contact",
            content: contact,
          });
          break;
        }

        // CREATE POLL
        case "poll": {
          showPollModal(); 
          break;
        }

        // SHARE LOCATION
        case "location": {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const { latitude, longitude } = pos.coords;
                client?.sendMessage({
                  messageType: "location",
                  content: { lat: latitude, lng: longitude },
                });
              },
              (err) => alert("Unable to fetch location: " + err.message)
            );
          } else {
            alert("Geolocation not supported in this browser");
          }
          break;
        }
      }
    });
  });
}

// ==============================
// Poll Modal Logic
// ==============================
function showPollModal() {
  const modal = document.getElementById("poll-modal");
  const addOptionBtn = document.getElementById("add-option-btn");
  const cancelBtn = document.getElementById("cancel-poll-btn");
  const sendBtn = document.getElementById("send-poll-btn");
  const pollOptionsContainer = document.getElementById("poll-options");
  const pollQuestion = document.getElementById("poll-question");

  if (!modal) return;
  modal.style.display = "flex";

  // Reset fields
  pollQuestion.value = "";
  pollOptionsContainer.innerHTML = `
    <input type="text" placeholder="Option 1" class="poll-option" />
    <input type="text" placeholder="Option 2" class="poll-option" />
  `;

  addOptionBtn.onclick = () => {
    const count = pollOptionsContainer.querySelectorAll(".poll-option").length + 1;
    if (count <= 5) {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `Option ${count}`;
      input.className = "poll-option";
      pollOptionsContainer.appendChild(input);
    } else {
      alert("Maximum 5 options allowed.");
    }
  };

  cancelBtn.onclick = () => {
    modal.style.display = "none";
  };

  sendBtn.onclick = () => {
    const question = pollQuestion.value.trim();
    const options = Array.from(pollOptionsContainer.querySelectorAll(".poll-option"))
      .map((i) => i.value.trim())
      .filter(Boolean);

    if (!question || options.length < 2) {
      alert("Please enter a question and at least two options.");
      return;
    }

    modal.style.display = "none";

    client?.sendMessage({
      messageType: "poll",
      content: { question, options },
    });

    alert("Poll sent!");
  };
}


function toggleEmojiPicker() {
  const { messageInput, emojiBtn } = elements;

  if (!emojiBtn || !messageInput) return;

  const existingPicker = document.getElementById("emoji-picker");
  if (existingPicker) {
    existingPicker.remove();
    return;
  }

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

  const rect = emojiBtn.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 250);
  const bottom = window.innerHeight - rect.top + 10;
  picker.style.left = `${left}px`;
  picker.style.bottom = `${bottom}px`;

  // --- Tabs ---
  const tabs = document.createElement("div");
  tabs.style.display = "flex";
  tabs.style.justifyContent = "space-around";
  tabs.style.marginBottom = "6px";

  const emojiTab = document.createElement("button");
  const stickerTab = document.createElement("button");
  const gifTab = document.createElement("button");

  emojiTab.textContent = "😀";
  stickerTab.textContent = "🖼️";
  gifTab.textContent = "🎞️";

  [emojiTab, stickerTab, gifTab].forEach((btn, i) => {
    btn.className = i === 0 ? "tab-btn active" : "tab-btn";
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

  const content = document.createElement("div");
  content.id = "picker-content";
  picker.appendChild(content);

  const emojis = ["😀","😊","😂","❤️","👍","🎉","🔥","⭐","🙏","👏","😎","😢","🤔","😡","🥳","💯","🎶","🍕","🍀","⚡","👋","💃","🕺"];
  const stickers = ["https://media.tenor.com/FGY-nz6R4uIAAAAC/thumbs-up.gif","https://media.tenor.com/bD0f8YRVyH8AAAAC/party-cat.gif","https://media.tenor.com/VDYcJtff5Q0AAAAC/hug.gif"];
  const gifs = ["https://media.giphy.com/media/Ju7l5y9osyymQ/giphy.gif","https://media.giphy.com/media/l0MYB8Ory7Hqefo9a/giphy.gif","https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif"];

  function loadItems(items, type) {
    content.innerHTML = "";
    items.forEach((item) => {
      const el = document.createElement(type === "emoji" ? "span" : "img");
      if (type === "emoji") {
        el.textContent = item;
        el.style.fontSize = "1.3em";
        el.style.padding = "4px";
      } else {
        el.src = item;
        el.style.width = type === "sticker" ? "60px" : "70px";
        el.style.margin = "4px";
      }
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        if (type === "emoji") messageInput.value += item;
        else messageInput.value += `[${type.toUpperCase()}:${item}]`;
        messageInput.focus();
        updateSendButtonState();
        picker.remove();
      });
      content.appendChild(el);
    });
  }
  
  loadItems(emojis, "emoji");

  emojiTab.addEventListener("click", () => {
    emojiTab.classList.add("active");
    stickerTab.classList.remove("active");
    gifTab.classList.remove("active");
    loadItems(emojis, "emoji");
  });

  stickerTab.addEventListener("click", () => {
    stickerTab.classList.add("active");
    emojiTab.classList.remove("active");
    gifTab.classList.remove("active");
    loadItems(stickers, "sticker");
  });

  gifTab.addEventListener("click", () => {
    gifTab.classList.add("active");
    emojiTab.classList.remove("active");
    stickerTab.classList.remove("active");
    loadItems(gifs, "gif");
  });

  document.body.appendChild(picker);


  setTimeout(() => {
    const closePicker = (e) => {
      if (!picker.contains(e.target) && e.target !== emojiBtn) {
        picker.remove();
        document.removeEventListener("click", closePicker);
      }
    };
    document.addEventListener("click", closePicker);
  });
}



// ==============================
// Message Helpers
// ==============================
function updateMessageStatus(tempId, { text, color, bold = false }) {
  if (!messagesContainer || !tempId) return;
  const msgDiv = messagesContainer.querySelector(`[data-temp-id="${tempId}"]`);
  const status = msgDiv?.querySelector(".message-status");
  if (status) {
    status.textContent = text;
    status.style.color = color;
    status.style.fontWeight = bold ? "bold" : "normal";
  }
}

function addSystemMessage(text) {
  if (!messagesContainer || !text) return;
  const div = document.createElement("div");
  div.className = "system-message";
  div.textContent = text;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeMessageByTempId(tempId) {
  if (!messagesContainer || !tempId) return;
  const tempDiv = messagesContainer.querySelector(`[data-temp-id="${tempId}"]`);
  tempDiv?.remove();
}

function clearMessages() {
  if (messagesContainer) messagesContainer.innerHTML = "";
  if (typingIndicator) typingIndicator.textContent = "";
}

// ==============================
// Status & Utilities
// ==============================
function updateStatus(socket, className, text) {
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
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
}

// ==============================
// Channel Rendering
// ==============================
function renderChannels(channels) {
  const channelListContainer = document.getElementById("channel-list");
  if (!channelListContainer || !Array.isArray(channels)) return;

  channelListContainer.innerHTML = "";
  channels.forEach((c) => {
    const li = document.createElement("li");
    li.textContent = `${c?.name || "Unnamed"} (${c?.participants?.length || 0} members)`;
    li.onclick = () => joinChannel(c?.id, c?.type || "direct");
    channelListContainer.appendChild(li);
  });
}

function parseSpecialContent(text) {
  if (!text) return "";
  if (text.startsWith("[GIF:") && text.endsWith("]")) {
    const url = text.slice(5, -1);
    return `<img src="${escapeHtml(url)}" class="chat-gif" />`;
  }
  if (text.startsWith("[Sticker:") && text.endsWith("]")) {
    const url = text.slice(9, -1);
    return `<img src="${escapeHtml(url)}" class="chat-sticker" />`;
  }
  return escapeHtml(text);
}


// ==============================
// Message Rendering
// ==============================

const currentUserId   = socket?.auth?.userId;
const currentUserName = typeof username === "string" ? username : null;

function renderMessageContent(rawText) {
  if (!rawText) return "";
  let safeText = escapeHtml(rawText);
  safeText = safeText
    .replace(/\[gif:\s*(https?:\/\/[^\]]+)\]/gi, '<img src="$1" alt="GIF" class="chat-gif">')
    .replace(/\[sticker:\s*(https?:\/\/[^\]]+)\]/gi, '<img src="$1" alt="Sticker" class="chat-sticker">');
  return safeText;
}

// ==============================
// Message Rendering
// ==============================
const addMessage = async (msg) => {
  if (!msg || !messagesContainer) return;

  const messageId = msg.id || msg.tempId;
  if (!messageId) return;

  // TEMP message replacement
  if (msg.tempId && tempMessages.has(msg.tempId)) {
    replaceTempMessage
      ? replaceTempMessage(msg.tempId, msg)
      : updateMessageStatus?.(msg.tempId, { text: "✓✓", color: "#5c2d91", bold: true });
    tempMessages.delete(msg.tempId);
    return;
  }

  if (receivedMessageIds.has(messageId)) return;
  receivedMessageIds.add(messageId);

  // Prevent memory overflow
  if (receivedMessageIds.size > 1000) {
    const iterator = receivedMessageIds.values();
    for (let i = 0; i < 500; i++) receivedMessageIds.delete(iterator.next().value);
  }

  // Only show messages for current channel
  const channelId = msg.channelId || msg.groupId || msg.receiverId;
console.log(
  "[Channel Check] msg.channelId:", msg.channelId,
  "computed channelId:", channelId,
  "currentChannelId:", currentChannelId
);

if (channelId !== currentChannelId) {
  unreadCount++;
  showUnreadCount?.(unreadCount);
  console.warn("Message ignored: not for the current channel");
  return;
}

  const isPart = await isParticipant(channelId, socket?.auth?.userId);
  if (!isPart) {
  console.warn("User is not participant in this channel, ignoring message");
  return;
}

  const div = document.createElement("div");
  div.classList.add("message");
  const isOwnMessage = (
    (msg.senderId && currentUserId && msg.senderId === currentUserId)
  || (msg.senderName && currentUserName && msg.senderName === currentUserName)
);

// Warn if neither identifier is valid
if (!currentUserId && !currentUserName) {
  console.warn("addMessage: no currentUserId or currentUserName defined, isOwnMessage logic may mis-classify");
}

  div.classList.add(isOwnMessage ? "outgoing" : "incoming");

  const senderName = msg.senderName || msg.senderId || "Unknown";
  const timestamp = msg.createdAt || msg.timestamp || new Date().toISOString();

  const usernameDiv = document.createElement("div");
  usernameDiv.className = "username";
  usernameDiv.textContent = escapeHtml(senderName);

  const contentDiv = document.createElement("div");
  contentDiv.className = "content";

  // ===== Render by MessageType =====
  switch (msg.messageType) {
    case "text":
    case "emoji":
  contentDiv.innerHTML = parseSpecialContent(msg.content?.text || msg.message || "");
  break;
    case "image":
      contentDiv.innerHTML = `<img src="${escapeHtml(msg.content?.url || msg.message)}" class="chat-image" />`;
      break;
    case "file":
      if (msg.fileUrl || msg.fileData) {
        const fileLink = document.createElement("a");
        fileLink.href = msg.fileUrl || `data:${msg.fileType};base64,${msg.fileData}`;
        fileLink.download = msg.fileName || "file";
        fileLink.className = "file-download";
        fileLink.textContent = `📎 ${msg.fileName || "File"} (${formatFileSize(msg.fileSize || 0)})`;
        contentDiv.appendChild(fileLink);
      }
      break;
    case "audio":
      if (msg.audioData) contentDiv.appendChild(mediaHandler?.renderAudioMessage?.(msg));
      break;
    case "video":
      if (msg.videoData) contentDiv.appendChild(mediaHandler?.renderVideoMessage?.(msg));
      break;
    case "sticker":
      contentDiv.innerHTML = `<img src="${escapeHtml(msg.content?.text || msg.message)}" class="chat-sticker" />`;
      break;
    case "gif":
      contentDiv.innerHTML = `<img src="${escapeHtml(msg.content?.text || msg.message)}" class="chat-gif" />`;
      break;
    case "system":
      addSystemMessage(msg.content?.text || msg.message || "");
      return; // system messages handled separately
    case "reply":
      contentDiv.innerHTML = `<div class="reply">${escapeHtml(msg.content?.text || msg.message)}</div>`;
      break;
    case "reaction":
      contentDiv.innerHTML = `<span class="reaction">${escapeHtml(msg.content?.reaction)}</span>`;
      break;
    case "poll": {
  const { question, options = [] } = msg.content || {};
  if (question && options.length) {
    const optsHTML = options
      .map((opt) => `<li>📊 ${escapeHtml(opt)}</li>`)
      .join("");
    contentDiv.innerHTML = `
      <div class="poll-card">
        <strong>${escapeHtml(question)}</strong>
        <ul>${optsHTML}</ul>
      </div>`;
  } else {
    contentDiv.innerHTML = `<div class="poll">Invalid poll data</div>`;
  }
  break;
}
    case "location":
      const { lat, lng } = msg.content || {};
      if (lat && lng) contentDiv.innerHTML = `<a href="https://maps.google.com/?q=${lat},${lng}" target="_blank">📍 Location</a>`;
      break;
    case "contact":
      contentDiv.innerHTML = `<div class="contact-card">${escapeHtml(msg.content?.name || "Contact")}</div>`;
      break;
    default:
      contentDiv.innerHTML = renderMessageContent(msg.content?.text || msg.message || "");
  }

  const timestampDiv = document.createElement("div");
  timestampDiv.className = "timestamp";
  timestampDiv.textContent = formatTimestamp(timestamp);

  const statusSpan = document.createElement("span");
  statusSpan.className = "message-status";
  if (isOwnMessage) {
    const persisted = msg.persisted ? "✓✓" : "…";
    statusSpan.textContent = persisted;
    statusSpan.style.color = msg.persisted ? "#5c2d91" : "#bbb";
  }

  div.append(usernameDiv, contentDiv, timestampDiv, statusSpan);

  if (msg.tempId) div.dataset.tempId = msg.tempId;

  messagesContainer.appendChild(div);

  // Scroll if near bottom
  const isNearBottom =
    messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
  if (isNearBottom) messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

// Group messages just call addMessage and increment unread
const addGroupMessage = async (msg) => {
  await addMessage(msg);
  if (msg.channelId !== currentChannelId) {
    unreadCount++;
    showUnreadCount?.(unreadCount);
  }
};


// ==============================
// Exports
// ==============================
export {
  setupInputAreaFunctionality,
  updateSendButtonState,
  handleSendButtonClick,
  toggleEmojiPicker,
  updateMessageStatus,
  addSystemMessage,
  removeMessageByTempId,
  clearMessages,
  updateStatus,
  escapeHtml,
  formatTimestamp,
  formatFileSize,
  renderChannels,
  renderMessageContent,
  addMessage,
  setupPlusMenu
};
