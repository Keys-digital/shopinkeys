// models/group.js
const pool = require("../config/db");

async function createGroup({
  name,
  description,
  avatar = null,
  createdBy = null,
}) {
  const query = `
    INSERT INTO "Channel" (name, type, avatar, description)
    VALUES ($1, 'group', $2, $3)
    RETURNING id, name, type AS "channelType", avatar, description;
  `;
  const { rows } = await pool.query(query, [name, avatar, description]);
  const newGroup = rows[0];

  if (createdBy) {
    await addMemberToGroup(newGroup.id, createdBy, "owner");
  }

  return newGroup;
}

/**
 * Add a member to a group with a specific role
 */
async function addMemberToGroup(groupId, userId, role) {
  const query = `
    INSERT INTO "ChannelParticipant" ("channelId", "userId", role)
    VALUES ($1, $2, $3)
    ON CONFLICT ("channelId", "userId") DO NOTHING;
  `;
  await pool.query(query, [groupId, userId, role]);
}

/**
 * Fetch group by ID
 */
async function getGroupById(groupId) {
  const query = `
    SELECT 
      c.id,
      c.name,
      c.type AS "channelType",
      c.avatar,
      json_agg(json_build_object(
        'userId', cp."userId",
        'role', cp.role,
        'isMuted', cp."isMuted",
        'isPinned', cp."isPinned",
        'name', u.name
      )) AS members
    FROM "Channel" c
    LEFT JOIN "ChannelParticipant" cp ON cp."channelId" = c.id AND cp."leftAt" IS NULL
    LEFT JOIN "User" u ON u.id = cp."userId"
    WHERE c.id = $1 AND c.type = 'group'
    GROUP BY c.id;
  `;
  const { rows } = await pool.query(query, [groupId]);
  return rows[0] || null;
}

/**
 * Fetch all groups
 */
async function getAllGroups() {
  const query = `
    SELECT id, name, type AS "channelType", avatar
    FROM "Channel"
    WHERE type = 'group'
    ORDER BY id DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
}

/**
 * Soft delete a group by ID
 */
async function deleteGroup(groupId) {
  const query = `
    UPDATE "Channel"
    SET "deletedAt" = NOW()  -- Soft delete by setting the timestamp
    WHERE id = $1 AND type = 'group' AND "deletedAt" IS NULL  -- Ensure it's not already deleted
    RETURNING id, name, type AS "channelType", avatar, "deletedAt";
  `;
  const { rows } = await pool.query(query, [groupId]);
  return rows[0] || null;
}

/**
 * Assign admin role to a group member
 */
async function assignAdminRole(groupId, userId, adminId) {
  // First, check if the requesting user is the creator or an admin of the group
  const checkAdminQuery = `
    SELECT role
    FROM "ChannelParticipant"
    WHERE "channelId" = $1 AND "userId" = $2
      AND role IN ('owner', 'admin')
  `;
  const { rows: adminCheck } = await pool.query(checkAdminQuery, [
    groupId,
    adminId,
  ]);

  if (adminCheck.length === 0) {
    throw new Error("Only the creator or an admin can assign the admin role.");
  }

  // Ensure that the user is a participant in the group
  const checkParticipantQuery = `
    SELECT 1
    FROM "ChannelParticipant"
    WHERE "channelId" = $1 AND "userId" = $2
  `;
  const { rows: participantCheck } = await pool.query(checkParticipantQuery, [
    groupId,
    userId,
  ]);

  if (participantCheck.length === 0) {
    throw new Error("User is not a participant of this group.");
  }

  // Assign the 'admin' role
  const assignRoleQuery = `
    UPDATE "ChannelParticipant"
    SET role = 'admin'
    WHERE "channelId" = $1 AND "userId" = $2
    RETURNING "userId", role;
  `;
  const { rows: updatedParticipant } = await pool.query(assignRoleQuery, [
    groupId,
    userId,
  ]);

  if (updatedParticipant.length === 0) {
    throw new Error("Failed to assign admin role.");
  }

  return updatedParticipant[0];
}

module.exports = {
  createGroup,
  getGroupById,
  getAllGroups,
  deleteGroup,
  assignAdminRole,
  addMemberToGroup,
};
