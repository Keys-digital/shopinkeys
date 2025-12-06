// utils/unreadUtils.js
const pool = require("../config/db");
const logger = require("./logger");

/**
 * Updates unread counts for all non-sender participants in a channel
 * Works for both direct and group chats
 *
 * @param {string} channelId - The channel ID
 * @param {string} senderId - The ID of the message sender
 * @returns {Promise<Array<{userId: string, channelId: string, unreadCount: number}>>}
 */
async function updateUnreadCount(channelId, senderId) {
  try {
    const updateQuery = `
      UPDATE "ChannelParticipant"
      SET "unreadCount" = "unreadCount" + 1
      WHERE "channelId" = $1 AND "userId" != $2
      RETURNING "userId" AS "userId", "channelId" AS "channelId", "unreadCount" AS "unreadCount";
    `;

    const res = await pool.query(updateQuery, [channelId, senderId]);
    const updatedCounts = res.rows;

    logger.debug(
      `[UnreadUtils] Updated unread counts for channel ${channelId}:`,
      updatedCounts
    );

    return updatedCounts;
  } catch (err) {
    logger.error(
      `[UnreadUtils] Failed to update unread counts for channel ${channelId}: ${err.message}`
    );
    return [];
  }
}

module.exports = { updateUnreadCount };
