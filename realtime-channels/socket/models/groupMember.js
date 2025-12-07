// models/GroupMember.js
const pool = require("../config/db");

/**
 * Add a user to a group channel
 */
async function addMember({ groupId, userId, role = "member" }) {
  const query = `
    INSERT INTO "ChannelParticipant" ("channelId", "userId", role)
    VALUES ($1, $2, $3)
    ON CONFLICT ("channelId", "userId")
    DO UPDATE SET role = EXCLUDED.role, "leftAt" = NULL
    RETURNING "channelId" AS groupId, "userId", role, "joinedAt";
  `;
  const values = [groupId, userId, role];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Fetch all members of a group
 */
async function getMembersByGroup(groupId) {
  const query = `
    SELECT cp."userId", u.name, cp.role, cp."isMuted", cp."isPinned"
    FROM "ChannelParticipant" cp
    JOIN "User" u ON u.id = cp."userId"
    WHERE cp."channelId" = $1 AND cp."leftAt" IS NULL
    ORDER BY cp."joinedAt" ASC;
  `;
  const { rows } = await pool.query(query, [groupId]);
  return rows;
}

/**
 * Fetch all groups a user belongs to
 */
async function getGroupsByUser(userId) {
  const query = `
    SELECT c.id AS groupId, c.name, cp.role
    FROM "ChannelParticipant" cp
    JOIN "Channel" c ON c.id = cp."channelId"
    WHERE cp."userId" = $1 AND cp."leftAt" IS NULL AND c.type = 'group'
    ORDER BY c.name;
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Remove a user from a group
 */
async function removeMember({ groupId, userId }) {
  const query = `
    UPDATE "ChannelParticipant"
    SET "leftAt" = now()
    WHERE "channelId" = $1 AND "userId" = $2
    RETURNING "channelId" AS groupId, "userId", "leftAt";
  `;
  const { rows } = await pool.query(query, [groupId, userId]);
  return rows[0] || null;
}

module.exports = {
  addMember,
  getMembersByGroup,
  getGroupsByUser,
  removeMember,
};
