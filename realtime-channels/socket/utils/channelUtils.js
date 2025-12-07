// utils/channelUtils.js
const pool = require("../config/db");
const logger = require("./logger");

/**
 * Check if a user is still an active participant in a channel
 */
async function isParticipant(channelId, userId) {
  try {
    logger.info(
      `[isParticipant] Checking channelId='${channelId}', userId='${userId}'`
    );
    const res = await pool.query(
      `SELECT 1 
       FROM "ChannelParticipant" cp
       JOIN "User" u ON cp."userId" = u.id
       JOIN "Channel" c ON cp."channelId" = c.id
       WHERE cp."channelId" = $1 
         AND cp."userId" = $2 
         AND cp."leftAt" IS NULL
         AND u."isActive" = true 
         AND u."deletedAt" IS NULL
         AND c."isActive" = true
         AND c."deletedAt" IS NULL`,
      [channelId, userId]
    );
    logger.info(`[isParticipant] Query result: rowCount=${res.rowCount}`);
    return res.rowCount > 0;
  } catch (err) {
    logger.error(`[ChannelUtils] Participant check failed:`, err);
    return false;
  }
}

/**
 * Get all active participants in a given channel
 * Used by frontend for typing indicators, avatars, and online display
 */
async function getParticipants(channelId) {
  try {
    const res = await pool.query(
      `SELECT cp."userId", u.name 
       FROM "ChannelParticipant" cp
       JOIN "User" u ON cp."userId" = u.id
       JOIN "Channel" c ON cp."channelId" = c.id
       WHERE cp."channelId" = $1 
         AND cp."leftAt" IS NULL
         AND u."isActive" = true
         AND u."deletedAt" IS NULL
         AND c."isActive" = true
         AND c."deletedAt" IS NULL`,
      [channelId]
    );
    return res.rows;
  } catch (err) {
    logger.error(
      `[ChannelUtils] Failed to fetch participants (channelId=${channelId}): ${err.message}`
    );
    return [];
  }
}

/**
 * Get basic channel info + member list
 * Useful for rendering chat sidebar or header metadata
 */
async function getChannelInfo(channelId) {
  try {
    const res = await pool.query(
      `SELECT 
         c.id, 
         c.name, 
         c.type AS "channelType", 
         COALESCE(
           json_agg(
             json_build_object(
               'userId', cp."userId", 
               'name', u.name,
               'role', cp.role,
               'isMuted', cp."isMuted",
               'isPinned', cp."isPinned"
             )
           ) FILTER (WHERE cp."userId" IS NOT NULL),
           '[]'
         ) AS members
       FROM "Channel" c
       JOIN "ChannelParticipant" cp ON cp."channelId" = c.id
       JOIN "User" u ON cp."userId" = u.id
       WHERE c.id = $1
         AND cp."leftAt" IS NULL
         AND u."isActive" = true
         AND u."deletedAt" IS NULL
         AND c."isActive" = true
         AND c."deletedAt" IS NULL
       GROUP BY c.id`,
      [channelId]
    );

    const channel = res.rows[0];
    if (!channel) return null;

    return {
      id: channel.id,
      name: channel.name,
      isGroup: channel.channelType === "group",
      members: channel.members,
    };
  } catch (err) {
    logger.error(
      `[ChannelUtils] Failed to fetch channel info (channelId=${channelId}): ${err.message}`
    );
    return null;
  }
}

/**
 * Get all channels a user participates in
 */
async function getChannelsForUser(userId) {
  try {
    const res = await pool.query(
      `SELECT 
         c.id, 
         c.name, 
         c.type AS "channelType",
         c.avatar
       FROM "Channel" c
       JOIN "ChannelParticipant" cp ON cp."channelId" = c.id
       JOIN "User" u ON cp."userId" = u.id
       WHERE cp."userId" = $1 
         AND cp."leftAt" IS NULL
         AND u."isActive" = true
         AND u."deletedAt" IS NULL
         AND c."isActive" = true
         AND c."deletedAt" IS NULL
       ORDER BY c.name`,
      [userId]
    );
    return res.rows;
  } catch (err) {
    logger.error(
      `[ChannelUtils] Failed to fetch channels for user (userId=${userId}): ${err.message}`
    );
    return [];
  }
}

module.exports = {
  isParticipant,
  getParticipants,
  getChannelInfo,
  getChannelsForUser,
};
