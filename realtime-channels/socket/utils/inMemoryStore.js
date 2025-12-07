// utils/inMemoryStore.js
// Channel-wise in-memory storage for demo / fallback

const inMemoryStore = {
  directMessages: {}, // { channelId: [messages] }
  groupMessages: {},  // { channelId: [messages] }

  /**
   * Add a message to in-memory store
   * @param {"direct"|"group"} type
   * @param {object} message
   */
  add(type, message) {
    const key = type === "direct" ? "directMessages" : "groupMessages";
    const idKey = type === "direct" ? message.channelId : message.groupId;

    if (!idKey) {
      console.warn(`[InMemoryStore] Missing channel/group ID for ${type}`);
      return;
    }

    if (!this[key][idKey]) {
      this[key][idKey] = [];
    }

    this[key][idKey].push(message);

    // Optional: keep last 200 messages per channel/group
    if (this[key][idKey].length > 200) {
      this[key][idKey] = this[key][idKey].slice(-200);
    }

    console.log(
      `[InMemoryStore] Added message to ${key}[${idKey}] (${this[key][idKey].length} messages)`
    );
  },

  /**
   * Get messages for a channel/group
   * @param {"direct"|"group"} type
   * @param {string} id channelId or groupId
   * @param {number} limit optional, number of messages to return
   */
  get(type, id, limit = 50) {
    const key = type === "direct" ? "directMessages" : "groupMessages";
    const msgs = this[key][id] || [];
    return msgs
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-limit);
  },

  /**
   * Clear messages for a channel/group (optional utility)
   */
  clear(type, id) {
    const key = type === "direct" ? "directMessages" : "groupMessages";
    if (id) {
      delete this[key][id];
    } else {
      this[key] = {};
    }
    console.log(`[InMemoryStore] Cleared ${type} messages${id ? ` for ${id}` : ""}`);
  },
};

module.exports = inMemoryStore;
