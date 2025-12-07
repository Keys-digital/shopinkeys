// utils/historyUtils.js
const inMemoryStore = require("./inMemoryStore");

/**
 * Get message history from in-memory store
 * @param {string} channelId
 * @param {number} limit
 * @param {boolean} isGroup
 * @returns {Array} sorted messages (oldest first)
 */
function getMessageHistory(channelId, limit = 50, isGroup = false) {
  const type = isGroup ? "group" : "direct";
  return inMemoryStore.get(type, channelId, limit);
}

module.exports = { getMessageHistory };
