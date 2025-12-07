import { mediaHandler } from "./media-handlers.js";
import {
  escapeHtml,
  formatTimestamp,
  formatFileSize,
  addMessage,
  setupPlusMenu,
  renderChannels,
  addSystemMessage,
  clearMessages,
  updateStatus,
  updateSendButtonState,
  setupInputAreaFunctionality,
} from "./ui-helpers.js";
import { setSocketReference } from "./ui-helpers.js";

console.log("WKForce Chat Simulation - client.js loaded");

export const client = (() => {
  let socket = null;
  let username = "";
  let currentChannelId = null;
  let currentChannelType = null;
  let isTyping = false;
  let typingTimeout = null;

  const tempMessages = new Map();
  const receivedMessageIds = new Set();
  const handledStatusUpdates = new Set();
  let unreadCount = 0;

  let channels = {};
  let users = {};

  const setSocket = (s) => (socket = s);
  const setUsername = (name) => (username = name);

  // =====================
  // Getters
  // =====================
  const getSocket = () => socket;
  const getUsername = () => username;
  const getCurrentChannelId = () => currentChannelId;
  const getCurrentChannelType = () => currentChannelType;
  const getChannels = () => channels;
  const getUsers = () => users;
  const getParticipants = (channelId) => channels[channelId]?.members || [];
  const getOldMessages = () => Array.from(tempMessages.values());

  // === DOM Elements ===
  const elements = {
    socketStatus: document.getElementById("socketio-status"),
    messagesContainer: document.getElementById("messages"),
    typingIndicator: document.getElementById("typing-indicator"),
    messageInput: document.getElementById("message-input"),
    sendButton: document.getElementById("send-btn"),
    connectedUserLabel: document.getElementById("connected-user"),
    emojiBtn: document.getElementById("emoji-btn"),
    attachBtn: document.getElementById("attach-btn"),
    videoBtn: document.getElementById("video-btn"),
  };

  const connectBtn = document.getElementById("connectBtn");

  // === UTILITIES ===
  const generateTempId = () =>
    `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const showUnreadCount = (count) => {
    const indicator = document.getElementById("unread-indicator");
    if (!indicator) return;
    indicator.style.display = count > 0 ? "block" : "none";
    indicator.textContent =
      count > 0 ? `${count} unread message${count > 1 ? "s" : ""}` : "";
  };

  const initSocketConnection = (userId, name, onConnected = null) => {
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

    setSocketReference(socket);

    // Register once
    socket.once("user:connected", ({ userId, userName }) => {
      console.log(`Connected as ${userName} (${userId})`);
      username = userName;
      socket.auth = { userId, name: userName };

      if (onConnected) onConnected();

      // Now safe to emit other events
      socket.emit("channels:load");
      socket.emit("users");
    });

    socket.on("connect", () => {
      console.log(`[Socket] Connected as ${name} (${socket.id})`);
      socket.emit("user:connect", { userName: name });
      registerSocketListeners();
      registerMessageStatusHandlers();
      receivedMessageIds.clear();
      handledStatusUpdates.clear();
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      updateStatus("disconnected", "Disconnected");
      updateSendButtonState(false);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
      updateStatus("error", "Connection failed");
      updateSendButtonState(false);
    });

    socket.io.on("reconnect", () => {
      console.log("Reconnected — rejoining previous channel...");
      if (currentChannelId) joinChannel(currentChannelId, currentChannelType);
    });
  };

  // === CHANNEL MANAGEMENT ===
  const joinChannel = (
    channelId,
    type,
    receiverId = null,
    receiverName = null
  ) => {
    if (!socket?.connected) {
      alert("Please connect first.");
      return;
    }

    receivedMessageIds.clear();
    tempMessages.clear();

    currentChannelId = channelId;
    currentChannelType = type;

    if (receiverId) {
      window.currentReceiverId = receiverId;
      window.currentReceiverName = receiverName;
    }

    clearMessages();

    console.log(`Joining ${type} channel: ${channelId}`);

    if (type === "group") {
      socket.emit("group:get", { groupId: channelId });
    } else {
      socket.emit("channel:join", { channelId, type });
      socket.emit("channel:history", { channelId });
      addSystemMessage(`You joined ${getChannelName(channelId)}.`);
    }

    // Enable input for typing
    updateSendButtonState(true);
  };

  const getChannelName = (channelId) =>
    channels[channelId]?.name || "Unknown Channel";

  // Fetchers
  const fetchChannelMessages = (channelId = currentChannelId) => {
    if (!socket?.connected || !channelId) return;
    if (channels[channelId]?.type === "direct") {
      socket.emit("direct:history", {
        receiverId: channels[channelId].participantId,
      });
    } else {
      socket.emit("group:history", { groupId: channelId });
    }
  };

  const fetchUsers = () => {
    if (!socket?.connected) return;
    socket.emit("users");
  };

  const fetchChannels = () => {
    const sock = socket;
    if (!sock?.connected) {
      console.warn("[fetchChannels] socket not connected");
      return;
    }

    // Request direct channels list
    sock.emit("channels:load");
  };

  // === MESSAGING ===
  const sendMessage = (content, type = "text", fileData = null) => {
    if (!socket?.connected) {
      alert("Not connected to server.");
      return;
    }
    if (!currentChannelId) {
      alert("Please select a channel first.");
      return;
    }

    const tempId = generateTempId();

    // === TEMP MESSAGE (optimistic UI) ===
    const tempMessage = {
      tempId,
      content,
      senderName: username,
      senderId: socket.auth?.userId,
      createdAt: new Date().toISOString(),
      channelId: currentChannelId,
      persisted: false,
      messageType: type,
      isGroup: currentChannelType === "group",
      ...fileData,
    };

    tempMessages.set(tempId, tempMessage);
    renderTempMessage(tempMessage); // renders immediately

    // === SOCKET PAYLOAD ===
    const messageData = {
      ...tempMessage,
      groupId: currentChannelType === "group" ? currentChannelId : undefined,
      channelId: currentChannelType !== "group" ? currentChannelId : undefined,
      metadata: { timestamp: new Date().toISOString() },
    };

    // emit to backend
    const event =
      currentChannelType === "group" ? "group:message:send" : "message:send";
    socket.emit(event, messageData);

    // clear input if applicable
    if (["text", "emoji", "sticker", "gif"].includes(type)) {
      elements.messageInput.value = "";
      updateSendButtonState();
      stopTyping();
    }
  };

  const activeFileUrls = new Set();

  /**
   * Render a temporary outgoing message
   */
  const renderTempMessage = (msg) => {
    if (!elements.messagesContainer) return;

    const div = document.createElement("div");
    div.classList.add(
      "message",
      msg.senderId === socket.auth.userId ? "outgoing" : "incoming"
    );
    div.dataset.tempId = msg.tempId;

    const usernameDiv = document.createElement("div");
    usernameDiv.className = "username";
    usernameDiv.textContent = msg.senderName;

    const contentDiv = document.createElement("div");
    contentDiv.className = "content";

    const timestampDiv = document.createElement("div");
    timestampDiv.className = "timestamp";
    timestampDiv.textContent = msg.createdAt
      ? formatTimestamp(msg.createdAt)
      : "Sending...";

    const statusSpan = document.createElement("span");
    statusSpan.className = "message-status";
    statusSpan.style.color = "#bbb";
    statusSpan.textContent = "…";

    if (msg.messageType === "file" && msg.fileBlob instanceof Blob) {
      const fileLink = document.createElement("a");
      const fileUrl = URL.createObjectURL(msg.fileBlob);
      activeFileUrls.add(fileUrl);

      fileLink.href = fileUrl;
      fileLink.download = msg.fileName;
      fileLink.className = "file-download";
      fileLink.textContent = `📎 ${msg.fileName} (${formatFileSize(
        msg.fileSize
      )})`;
      fileLink.setAttribute("aria-label", `Download ${msg.fileName}`);

      fileLink.addEventListener("click", () => {
        setTimeout(() => {
          URL.revokeObjectURL(fileUrl);
          activeFileUrls.delete(fileUrl);
        }, 1000);
      });

      contentDiv.appendChild(fileLink);
    } else {
      contentDiv.textContent = msg.content;
    }

    div.append(usernameDiv, contentDiv, timestampDiv, statusSpan);
    elements.messagesContainer.appendChild(div);

    const isNearBottom =
      elements.messagesContainer.scrollHeight -
        elements.messagesContainer.scrollTop -
        elements.messagesContainer.clientHeight <
      50;
    if (isNearBottom) {
      elements.messagesContainer.scrollTop =
        elements.messagesContainer.scrollHeight;
    }
  };

  /**
   * Replace a temporary message with the confirmed server message
   */
  const replaceTempMessage = (tempId, confirmedMsg) => {
    const tempDiv = elements.messagesContainer.querySelector(
      `[data-temp-id="${tempId}"]`
    );
    if (!tempDiv) return;

    // Clean up any file URLs associated with the old temp message
    const oldLink = tempDiv.querySelector("a.file-download");
    if (oldLink && oldLink.href.startsWith("blob:")) {
      URL.revokeObjectURL(oldLink.href);
      activeFileUrls.delete(oldLink.href);
    }

    // Build a fresh DOM node for the confirmed message
    const newDiv = document.createElement("div");
    newDiv.classList.add(
      "message",
      confirmedMsg.senderId === socket.auth.userId ? "outgoing" : "incoming"
    );
    newDiv.dataset.messageId = confirmedMsg.id;

    const usernameDiv = document.createElement("div");
    usernameDiv.className = "username";
    usernameDiv.textContent = confirmedMsg.senderName;

    const contentDiv = document.createElement("div");
    contentDiv.className = "content";

    const timestampDiv = document.createElement("div");
    timestampDiv.className = "timestamp";
    timestampDiv.textContent = formatTimestamp(confirmedMsg.createdAt);

    const statusSpan = document.createElement("span");
    statusSpan.className = "message-status";
    statusSpan.textContent = confirmedMsg.status || "sent";

    if (confirmedMsg.messageType === "file" && confirmedMsg.fileUrl) {
      const fileLink = document.createElement("a");
      fileLink.href = confirmedMsg.fileUrl;
      fileLink.download = confirmedMsg.fileName;
      fileLink.className = "file-download";
      fileLink.textContent = `📎 ${confirmedMsg.fileName} (${formatFileSize(
        confirmedMsg.fileSize
      )})`;
      contentDiv.appendChild(fileLink);
    } else {
      contentDiv.textContent = confirmedMsg.content;
    }

    newDiv.append(usernameDiv, contentDiv, timestampDiv, statusSpan);

    // Replace the old temp message node with the confirmed one
    tempDiv.replaceWith(newDiv);

    // Optional: add a small fade-in animation for UX polish
    newDiv.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
  };

  /**
   * Clean up any remaining file URLs when clearing chat
   */
  const clearRenderedMessages = () => {
    elements.messagesContainer.innerHTML = "";
    for (const url of activeFileUrls) URL.revokeObjectURL(url);
    activeFileUrls.clear();
  };

  const addGroupMessage = (msg) => {
    // If this is a new incoming message with tempId
    if (msg.tempId && tempMessages.has(msg.tempId)) {
      replaceTempMessage(msg.tempId, msg);
      tempMessages.delete(msg.tempId);
    } else {
      // Regular incoming group message
      renderTempMessage(msg); // could rename to renderMessage for shared usage
    }

    unreadCount++;
    showUnreadCount(unreadCount);
  };

  /**
   * Update message status tick (ack / delivered / persisted)
   * Works for both temp and confirmed messages.
   */
  const updateMessageStatus = (tempIdOrId, { text, color, bold = false }) => {
    if (!elements.messagesContainer) return;

    // Try both temp and confirmed message selectors
    const msgEl =
      elements.messagesContainer.querySelector(
        `[data-temp-id="${tempIdOrId}"]`
      ) ||
      elements.messagesContainer.querySelector(
        `[data-message-id="${tempIdOrId}"]`
      );

    if (!msgEl) return;

    const statusSpan = msgEl.querySelector(".message-status");
    if (!statusSpan) return;

    statusSpan.textContent = text || statusSpan.textContent;
    statusSpan.style.color = color || "#888";
    statusSpan.style.fontWeight = bold ? "600" : "normal";

    // Optional: brief fade pulse to indicate an update visually
    statusSpan.animate([{ opacity: 0.4 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
  };

  const sendTextMessage = () => {
    const text = elements.messageInput.value.trim();
    if (text) sendMessage(text, "text");
  };

  const sendFileMessage = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const fileBase64 = reader.result.split(",")[1];
      sendMessage(`📎 ${file.name}`, "file", {
        fileData: fileBase64,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileBlob: file,
      });
    };
    reader.readAsDataURL(file);
  };

  // === TYPING ===
  const handleTyping = () => {
    if (!socket?.connected || !currentChannelId) return;
    if (!isTyping) {
      isTyping = true;
      socket.emit("typing:start", {
        conversationId: currentChannelId,
        type: currentChannelType,
      });
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 2000);
  };

  const stopTyping = () => {
    if (isTyping && socket?.connected && currentChannelId) {
      socket.emit("typing:stop", { conversationId: currentChannelId });
      isTyping = false;
    }
    clearTimeout(typingTimeout);
  };

  const getCurrentChannelMessages = () => {
    if (!currentChannelId) return [];
    return channels[currentChannelId]?.messages || [];
  };

  const getChannelParticipants = (channelId = currentChannelId) => {
    if (!channelId) return [];
    const channel = channels[channelId];
    if (!channel) return [];

    // Direct channel participants
    if (channel.type === "direct") return channel.participants || [];

    // Group channel participants
    if (channel.type === "group") return channel.members || [];

    return [];
  };

  // Socket listeners to update local store
  const registerSocketListeners = () => {
    if (!socket) return;

    socket.on("channels:load", (channelsList) => {
      channelsList.forEach((ch) => {
        channels[ch.id] = {
          id: ch.id,
          name: ch.name || "Unnamed",
          type: "direct",
          participants: ch.participants || [],
          unreadCount: ch.unreadCount || 0,
        };
      });
      renderChannels(Object.values(channels));
    });

    const totalUnread = Object.values(channels).reduce(
      (sum, ch) => sum + (ch.unreadCount || 0),
      0
    );
    showUnreadCount(totalUnread);

    socket.on("group:auto:joined", ({ group, members, messages }) => {
      channels[group.id] = {
        id: group.id,
        name: group.name || "Unnamed Group",
        type: "group",
        participants: members || [],
        unreadCount: 0,
        messages: messages || [],
      };

      renderChannels(Object.values(channels));

      if (currentChannelId === group.id) {
        clearMessages();
        (messages || []).forEach((msg) => addMessage(msg));
      }
    });

    socket.on("group:get:success", ({ group, members, messages }) => {
      channels[group.id] = {
        id: group.id,
        name: group.name || "Unnamed Group",
        type: "group",
        participants: members || [],
        unreadCount: channels[group.id]?.unreadCount || 0,
        messages: messages || [],
      };

      if (currentChannelId === group.id) {
        clearMessages();
        (messages || []).forEach((msg) => addMessage(msg));
      }

      renderChannels(Object.values(channels));
    });

    // Handle error event for group:get
    socket.on("group:get:error", ({ error }) => {
      console.error("[group:get:error]", error);
      addSystemMessage(`Failed to load group: ${error}`);
    });

    socket.on("direct:history", ({ channelId, messages }) => {
      if (!channels[channelId]) {
        channels[channelId] = {
          id: channelId,
          type: "direct",
          participants: [], // you may fill if you know
          messages: [],
          unreadCount: 0,
        };
      }
      channels[channelId].messages = messages;

      // If this is the current channel being viewed:
      if (currentChannelId === channelId) {
        clearMessages();
        messages.forEach((msg) => addMessage(msg));
      }
    });

    socket.on("direct:history", ({ channelId, messages }) => {
      if (!channels[channelId]) {
        channels[channelId] = {
          id: channelId,
          type: "direct",
          participants: [],
          messages: [],
          unreadCount: 0,
        };
      }
      channels[channelId].messages = messages;

      if (currentChannelId === channelId) {
        clearMessages();
        messages.forEach((msg) => addMessage(msg));
      }
    });

    // Unread counts updates
    socket.on("message:unread", ({ channelId, unreadCount }) => {
      if (!channels[channelId])
        channels[channelId] = {
          messages: [],
          type: "direct",
          participants: [],
        };
      channels[channelId].unreadCount = unreadCount;
    });

    socket.on("users", (userList) => {
      users = userList.reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});
      console.log("Users loaded:", users);
    });

    socket.on("direct:history", ({ channelId, messages }) => {
      if (!channels[channelId])
        channels[channelId] = {
          messages: [],
          type: "direct",
          participants: [],
        };
      channels[channelId].messages = messages;
    });

    socket.on("typing:start", (data) => {
      elements.typingIndicator.textContent = `${
        data.username || "Someone"
      } is typing...`;
    });

    socket.on("typing:stop", () => {
      elements.typingIndicator.textContent = "";
    });

    socket.on("error", (err) =>
      addSystemMessage(`Error: ${err.message || JSON.stringify(err)}`)
    );
    socket.on("auth_error", (err) =>
      alert(`Authentication error: ${err.message || "Invalid credentials"}`)
    );

    socket.on("group:get:success", ({ group, members, messages }) => {
      channels[group.id] = {
        id: group.id,
        name: group.name,
        type: "group",
        members,
        messages,
        unreadCount: 0,
      };

      clearMessages();
      messages.forEach((msg) => addGroupMessage(msg));
      addSystemMessage(`You joined group: ${group.name}`);

      renderChannels(Object.values(channels));
    });

    // Group auto-join with messages
    socket.on("group:auto:joined", ({ group, members, messages }) => {
      channels[group.id] = {
        ...group,
        type: "group",
        members,
        messages,
        unreadCount: 0,
      };
      renderChannels(Object.values(channels));
    });

    // Group messages received
    socket.on("group:message:receive", (msg) => {
      const gId = msg.groupId;
      if (!channels[gId]) {
        channels[gId] = {
          id: gId,
          type: "group",
          members: [],
          messages: [],
          unreadCount: 0,
        };
      }
      channels[gId].messages.push(msg);
      if (currentChannelId === gId) {
        addGroupMessage(msg);
      } else {
        channels[gId].unreadCount = (channels[gId].unreadCount || 0) + 1;
        const totalUnread = Object.values(channels).reduce(
          (sum, ch) => sum + (ch.unreadCount || 0),
          0
        );
        showUnreadCount(totalUnread);
      }
    });

    // Group history fetched
    socket.on("group:history", ({ groupId, messages }) => {
      if (!channels[groupId]) {
        channels[groupId] = {
          id: groupId,
          type: "group",
          members: [],
          messages: [],
          unreadCount: 0,
        };
      }
      channels[groupId].messages = messages;
      if (currentChannelId === groupId) {
        clearMessages();
        messages.forEach((msg) => addGroupMessage(msg));
      }
    });

    socket.on("group:message:unread", ({ channelId, unreadCount }) => {
      if (!channels[channelId]) {
        channels[channelId] = {
          id: channelId,
          type: "group",
          members: [],
          messages: [],
          unreadCount: 0,
        };
      }
      channels[channelId].unreadCount = unreadCount;
      const totalUnread = Object.values(channels).reduce(
        (sum, ch) => sum + (ch.unreadCount || 0),
        0
      );
      showUnreadCount(totalUnread);
    });

    socket.on("user:online", ({ userId, username, timestamp }) => {
      // update local user store
      if (users[userId]) {
        users[userId].status = "online";
        users[userId].lastSeen = timestamp;
      } else {
        users[userId] = {
          id: userId,
          name: username,
          status: "online",
          lastSeen: timestamp,
        };
      }
      console.log(`${username} is online`);
      // optionally update UI presence indicator
    });

    socket.on("user:offline", ({ userId, username, timestamp }) => {
      if (users[userId]) {
        users[userId].status = "offline";
        users[userId].lastSeen = timestamp;
      } else {
        users[userId] = {
          id: userId,
          name: username,
          status: "offline",
          lastSeen: timestamp,
        };
      }
      console.log(`${username} went offline`);
      // optionally update UI presence indicator
    });
    socket.on("user:status:changed", ({ userId, status, timestamp }) => {
      if (users[userId]) {
        users[userId].status = status;
        users[userId].lastSeen = timestamp;
      } else {
        users[userId] = { id: userId, status, lastSeen: timestamp };
      }
      console.log(`User ${userId} changed status to ${status}`);
      // optionally update UI presence indicator
    });
  };

  // === MESSAGE STATUS HANDLERS ===
  const registerMessageStatusHandlers = () => {
    const statusMap = {
      ack: { text: "✓", color: "#4e4f50ff" },
      delivered: { text: "✓✓", color: "#4e4f50ff" },
      persisted: { text: "✓✓", color: "#5c2d91", bold: true },
    };

    const handleStatusUpdate = (type, data) => {
      if (!data?.tempId) return;
      const key = `${type}-${data.tempId}`;
      if (handledStatusUpdates.has(key)) return;
      handledStatusUpdates.add(key);
      updateMessageStatus(data.tempId, statusMap[type]);
      if (handledStatusUpdates.size > 1000) {
        const it = handledStatusUpdates.values();
        for (let i = 0; i < 500; i++)
          handledStatusUpdates.delete(it.next().value);
      }
    };

    socket.on("message:ack", (data) => handleStatusUpdate("ack", data));
    socket.on("message:delivered", (data) =>
      handleStatusUpdate("delivered", data)
    );
    socket.on("message:persisted", (data) =>
      handleStatusUpdate("persisted", data)
    );
    socket.on("group:message:ack", (data) => handleStatusUpdate("ack", data));
    socket.on("group:message:delivered", (data) =>
      handleStatusUpdate("delivered", data)
    );
    socket.on("group:message:persisted", (data) =>
      handleStatusUpdate("persisted", data)
    );
  };

  // === INITIALIZATION ===
  const init = () => {
    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("connectBtn").onclick = () => {
        const userId = document.getElementById("userId").value.trim();
        const name = document.getElementById("userName").value.trim();
        if (userId && name) initSocketConnection(userId, name);
      };

      connectBtn.addEventListener("click", () => {
        const userName = document.getElementById("userName").value?.trim();
        if (!userName) {
          alert("Please enter a username");
          return;
        }

        client.initSocketConnection(userId, userName);
      });

      elements.sendButton.addEventListener("click", sendTextMessage);
      elements.messageInput.addEventListener(
        "keypress",
        (e) => e.key === "Enter" && sendTextMessage()
      );
      elements.messageInput.addEventListener("input", handleTyping);

      setupInputAreaFunctionality();

      setupPlusMenu();

      window.joinChannel = joinChannel;
      window.connectSocketSimple = initSocketConnection;
    });
  };

  return {
    init,
    initSocketConnection,
    sendMessage,
    sendTextMessage,
    sendFileMessage,
    joinChannel,
    fetchChannels,
    fetchUsers,
    fetchChannelMessages,
    getSocket,
    getUsername,
    getCurrentChannelId,
    getCurrentChannelType,
    getChannels,
    getUsers,
    getParticipants,
    getChannelParticipants,
    getOldMessages,
    getCurrentChannelMessages,
    updateMessageStatus,
    clearRenderedMessages,
    showUnreadCount,
  };
})();
client.init();
