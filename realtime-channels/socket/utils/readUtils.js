const pool = require("../config/db");
const logger = require("./logger");

/**
 * Resets unread count for a participant when they open a channel.
 * Works for both direct and group channels.
 *
 * @param {string} channelId - The channel ID being viewed
 * @param {string} userId - The user who has read the messages
 * @returns {Promise<{success: boolean, resetCount?: number}>}
 */
async function markAsRead(channelId, userId) {
  try {
    const updateQuery = `
      UPDATE "ChannelParticipant"
      SET "unreadCount" = 0
      WHERE "channelId" = $1 AND "userId" = $2
      RETURNING "unreadCount";
    `;

    const res = await pool.query(updateQuery, [channelId, userId]);

    if (res.rowCount === 0) {
      logger.warn(
        `[ReadUtils] No participant record found for user ${userId} in channel ${channelId}`
      );
      return { success: false };
    }

    logger.debug(
      `[ReadUtils] Unread count reset for user ${userId} in channel ${channelId}`
    );

    return { success: true, resetCount: res.rows[0].unreadCount };
  } catch (err) {
    logger.error(
      `[ReadUtils] Failed to reset unread count for user ${userId} in channel ${channelId}: ${err.message}`
    );
    return { success: false };
  }
}

module.exports = { markAsRead };
