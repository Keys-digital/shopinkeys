const { v4: uuidv4 } = require("uuid");
const inMemoryStore = require("../utils/inMemoryStore");
const { messageQueue } = require("../config/queue");

class GroupMessage {
  constructor({
    id = uuidv4(),
    groupId,
    senderId,
    senderName = null,
    messageType = "text",
    message = null,
    content = {},
    attachments = [],
    metadata = {},
    status = "queued",
    isGroup = true,
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    Object.assign(this, {
      id,
      groupId,
      senderId,
      senderName,
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

  async save() {
    if (messageQueue && messageQueue.add) {
      messageQueue.add("persistGroupMessage", this, {
        attempts: 5,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
      });
    }

    if (!inMemoryStore.groupMessages[this.groupId]) {
      inMemoryStore.groupMessages[this.groupId] = [];
    }
    inMemoryStore.groupMessages[this.groupId].push(this);

    return this;
  }

  static getHistory(groupId, limit = 50) {
    const msgs = inMemoryStore.groupMessages[groupId] || [];
    return msgs
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-limit);
  }
}

module.exports = GroupMessage;
