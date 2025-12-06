const { v4: uuidv4 } = require("uuid");
const inMemoryStore = require("../utils/inMemoryStore"); 
const { messageQueue } = require("../config/queue"); 

class DirectMessage {
  constructor({
    id = uuidv4(),
    clientMessageId = uuidv4(),
    channelId,
    sessionId = null,
    senderId,
    senderName = null,
    receiverId,
    receiverName = null,
    messageType = "text",
    message = null,
    content = {},
    attachments = [],
    metadata = {},
    status = "queued",
    isGroup = false,
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    Object.assign(this, {
      id,
      clientMessageId,
      channelId,
      sessionId,
      senderId,
      senderName,
      receiverId,
      receiverName,
      messageType,
      message,
      content,
      attachments,
      metadata,
      status,
      isGroup,
      createdAt,
      updatedAt,
    });
  }

  static async getUserConversations(userId) {
  const allMessages = Object.values(inMemoryStore.directMessages).flat();
  const conversations = [];

  const uniqueChannelMap = new Map();

  for (const msg of allMessages) {
    if (msg.senderId === userId || msg.receiverId === userId) {
      const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const channelKey = msg.channelId;

      if (!uniqueChannelMap.has(channelKey)) {
        uniqueChannelMap.set(channelKey, {
          channelId: msg.channelId,
          participantId: otherUserId,
          lastMessage: msg.message,
          lastMessageAt: msg.createdAt,
        });
      }
    }
  }

  return Array.from(uniqueChannelMap.values());
}

  async save() {
    // Push to Better Queue for async DB persistence
    if (messageQueue && messageQueue.add) {
      messageQueue.add("persistDirectMessage", this, {
        attempts: 5,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
      });
    }

    // Push to in-memory store for demo/live retrieval
    if (!inMemoryStore.directMessages[this.channelId]) {
      inMemoryStore.directMessages[this.channelId] = [];
    }
    inMemoryStore.directMessages[this.channelId].push(this);

    return this;
  }

  static getHistory(channelId, limit = 50) {
    const msgs = inMemoryStore.directMessages[channelId] || [];
    return msgs
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-limit);
  }
}

module.exports = DirectMessage;
