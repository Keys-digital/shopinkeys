// socket/utils/conversationId.js
/**
 * Deterministic conversation ID for two users.
 * Ensures both sides (A,B) and (B,A) share the same ID.
 */
function getConversationId(userA, userB) {
  if (!userA || !userB) throw new Error("Both user IDs required");
  return [String(userA), String(userB)].sort().join("_");
}

module.exports = getConversationId;
