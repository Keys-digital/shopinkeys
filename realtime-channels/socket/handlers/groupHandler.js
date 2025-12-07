// handlers/groupHandler.js
const formatMessage = require("../utils/messageFormatter");
const inMemoryStore = require("../utils/inMemoryStore");
const { updateUnreadCount } = require("../utils/unreadUtils");
const { markAsRead } = require("../utils/readUtils");
const { getMessageHistory } = require("../utils/historyUtils");
const { isParticipant } = require("../utils/channelUtils");
const logger = require("../utils/logger");
const { pub } = require("../queue/worker");
const GroupMessage = require("../models/groupMessageModel");
const GroupMember = require("../models/groupMember");
const Group = require("../models/group");
const { createPoll } = require("../utils/pollUtils");

/**
 * Register Group Chat Handlers
 */
module.exports = function registerGroupHandler(
  io,
  socket,
  redisPub,
  messageQueue
) {
  const user = socket.user;

  // Clean existing listeners
  socket.removeAllListeners("group:message:send");
  socket.removeAllListeners("group:read");
  socket.removeAllListeners("group:join");
  socket.removeAllListeners("group:leave");

  if (process.env.USE_REDIS === "false") {
    const originalGetGroupsByUser = GroupMember.getGroupsByUser;
    GroupMember.getGroupsByUser = async (userId) =>
      originalGetGroupsByUser(userId);
  }

  GroupMember.isMember = async (groupId, userId) => {
    const groups = await GroupMember.getGroupsByUser(userId);
    return groups.some((g) => g.group_id === groupId);
  };

  socket.on("group:create", async ({ name, description, members }) => {
    try {
      if (!name) throw new Error("Group name required");
      if (!members || members.length < 2)
        throw new Error("At least 3 members required to create a group");

      // Create the group
      const newGroup = await Group.createGroup({
        name,
        description,
        createdBy: user.id,
      });

      // Ensure creator is not in members list
      const memberIds = members.filter((id) => id !== user.id);

      // Add other members
      await Promise.all(
        memberIds.map((memberId) =>
          Group.addMemberToGroup(newGroup.id, memberId, "member")
        )
      );

      // Join the socket room
      socket.join(`group:${newGroup.id}`);

      // Emit success
      socket.emit("group:create:success", { group: newGroup });
      logger.info(`[Group] User ${user.id} created group ${newGroup.id}`);
    } catch (err) {
      logger.error(`[Group] group:create error: ${err.message}`);
      socket.emit("group:create:error", { error: err.message });
    }
  });

  /**
   *   Fetch group details with members and recent messages
   */
  socket.on("group:get", async ({ groupId }) => {
    try {
      if (!groupId) throw new Error("Missing groupId");

      // Check if user is a member
      const isMember = await GroupMember.isMember(groupId, user.id);
      if (!isMember) {
        socket.emit("group:get:error", {
          error: "You are not a member of this group",
        });
        return;
      }

      // Fetch group details
      const group = await Group.getGroupById(groupId);
      if (!group) throw new Error("Group not found");

      // Fetch members
      const members = await GroupMember.getMembersByGroup(groupId);

      // Fetch recent messages (last 50)
      const messages = await GroupMessage.getMessagesByGroup(groupId, 50);

      // Return all info
      socket.emit("group:get:success", {
        group,
        members,
        messages,
      });
    } catch (err) {
      logger.error(`[Group] group:get error: ${err.message}`);
      socket.emit("group:get:error", { error: err.message });
    }
  });

  // Assign the admin role to a group member
  socket.on("group:assignAdmin", async ({ groupId, userId }) => {
    try {
      // Ensure that the user is either the owner or an admin
      const assignedAdmin = await Group.assignAdminRole(
        groupId,
        userId,
        user.id
      );

      // Emit success if role was successfully assigned
      socket.emit("group:assignAdmin:success", {
        userId,
        role: assignedAdmin.role,
      });
    } catch (err) {
      logger.error(`[Group] Error assigning admin role: ${err.message}`);
      socket.emit("group:assignAdmin:error", { error: err.message });
    }
  });

  // Soft delete a group (owner only)
  socket.on("group:delete:soft", async ({ groupId }) => {
    try {
      if (!groupId) throw new Error("Missing groupId");

      // Check that the user is the owner
      const members = await GroupMember.getMembersByGroup(groupId);
      const owner = members.find((m) => m.role === "owner");
      if (owner?.userId !== user.id) {
        socket.emit("group:delete:error", {
          error: "Only the group owner can delete this group",
        });
        return;
      }

      // Soft delete (mark as deleted)
      const deleted = await Group.deleteGroup(groupId);
      if (!deleted) {
        socket.emit("group:delete:error", { error: "Group not found" });
        return;
      }

      // Notify other servers/sockets
      pub?.emit("group:deleted", {
        groupId,
        deletedBy: user.id,
        softDeleted: true,
      });

      socket.emit("group:delete:success", {
        groupId,
        message: "Group soft-deleted successfully",
      });

      logger.info(
        `[GroupHandler] User ${user.id} soft-deleted group:${groupId}`
      );
    } catch (err) {
      logger.error(`[GroupHandler] group:delete error: ${err.message}`);
      socket.emit("group:delete:error", { error: err.message });
    }
  });

  /**
   * Auto-join all groups the user is part of on connection
   */
  (async () => {
    try {
      const groups = (await GroupMember.getGroupsByUser?.(user.id)) || [];
      if (!Array.isArray(groups) || groups.length === 0) {
        logger.debug(
          `[Socket] No groups found for ${user.id} — skipping auto-join.`
        );
        return;
      }

      for (const g of groups) {
        if (!g?.group_id) continue;

        socket.join(`group:${g.group_id}`);

        // Fetch group details sequentially
        const groupDetails = await Group.getGroupById(g.group_id);

        // Fetch members and messages in parallel (per group)
        const [members, messages] = await Promise.all([
          GroupMember.getMembersByGroup(g.group_id),
          GroupMessage.getHistory(g.group_id, 50),
        ]);

        socket.emit("group:auto:joined", {
          group: groupDetails,
          members,
          messages,
        });

        logger.debug(
          `[Socket] User ${user.id} auto-joined group:${g.group_id} (${
            groupDetails.name || "Unnamed"
          })`
        );
      }
    } catch (err) {
      logger.warn(
        `[Socket] Failed to auto-join groups for ${user.id}: ${
          err?.message || JSON.stringify(err)
        }`
      );
    }
  })();

  /**
   *  Handle group leave
   */
  socket.on("group:leave", async ({ groupId }) => {
    try {
      const result = await GroupMember.removeMember({
        groupId,
        userId: user.id,
      });
      socket.leave(`group:${groupId}`);
      io.to(`group:${groupId}`).emit("group:member:left", {
        groupId,
        userId: user.id,
      });
      logger.info(`[Group] ${user.id} left group:${groupId}`);
      socket.emit("group:leave:ack", result);
    } catch (err) {
      logger.error(`[Group] Error leaving group:${groupId} → ${err.message}`);
      socket.emit("group:leave:error", { error: err.message });
    }
  });

  /**
   *   Send Group Message
   */
  socket.on("group:message:send", async (payload) => {
    try {
      const message = formatMessage(payload, user, { status: "queued" });
      message.isGroup = true;

      const groupId = message.channelId || payload.groupId;
      if (!groupId) throw new Error("Missing groupId");

      const isMember = await GroupMember.isMember(groupId, user.id);
      if (!isMember) {
        logger.warn(
          `[GroupHandler] Unauthorized send by ${user.id} in group:${groupId}`
        );
        socket.emit("group:message:error", {
          error: "You are not a member of this group",
        });
        return;
      }

      socket.join(`group:${groupId}`);

      const groupMsg = new GroupMessage({
        ...message,
        groupId,
        senderId: user.id,
        senderName: user.username || user.name || "Unknown",
      });

      // --- Broadcast the message with tempId/clientMessageId intact --- //
      const outgoingMsg = {
        ...groupMsg,
        clientMessageId: payload.clientMessageId || message.clientMessageId,
        tempId: payload.tempId || message.tempId, // optional, if client uses tempId naming
      };

      logger.debug(
        `[GroupHandler] Emitting group message ${groupMsg.id} (temp: ${outgoingMsg.clientMessageId}) to group:${groupId}`
      );

      // Broadcast to all group members (including sender for UI sync)
      io.to(`group:${groupId}`).emit("group:message:receive", outgoingMsg);

      socket.emit("group:message:ack", {
        temp_id: groupMsg.clientMessageId || `temp-${Date.now()}`,
        status: "queued",
        createdAt: groupMsg.createdAt,
      });

      // Queue persistence with async/await (refactor from callback)
      if (messageQueue?.createJob) {
        try {
          const job = messageQueue
            .createJob("persistGroupMessage", groupMsg)
            .priority("normal")
            .timeout(60000)
            .retries(5)
            .backoff({ type: "exponential", delay: 3000 });

          await new Promise((resolve, reject) => {
            job.save((err) => (err ? reject(err) : resolve()));
          });
          logger.success(`Queued group message ${groupMsg.id} for persistence`);
        } catch (err) {
          logger.warn(`Failed to queue group message: ${err.message}`);
          inMemoryStore.add("group", groupMsg);
        }
      } else if (messageQueue?.add) {
        await messageQueue.add("persistGroupMessage", groupMsg, {
          attempts: 5,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: true,
        });
        logger.success(`Queued group message ${groupMsg.id} for persistence`);
      } else {
        throw new Error("messageQueue not initialized");
      }

      // Update unread counts
      const unreadUpdates = await updateUnreadCount(groupId, groupMsg.senderId);
      unreadUpdates.forEach((u) => {
        io.to(u.userId).emit("group:message:unread", u);
      });

      // Redis cache last 200 messages
      const listKey = `channel:messages:${groupId}`;
      try {
        await redisPub.rpush(listKey, JSON.stringify(groupMsg));
        await redisPub.ltrim(listKey, -200, -1);
      } catch (e) {
        logger.debug(`Redis cache failed (safe): ${e.message}`);
      }

      // Delivery confirmation
      socket.to(`group:${groupId}`).emit("group:message:delivered", {
        messageId: groupMsg.id,
        senderId: groupMsg.senderId,
      });

      if (!messageQueue && process.env.USE_REDIS === "false") {
        pub.emit("group:message:persisted", groupMsg);
      }
    } catch (err) {
      logger.error(`[GroupHandler] ${err.message}`);
      socket.emit("group:message:error", {
        error: "Failed to send group message",
        details: err.message,
      });
    }
  });

  /**
   *   Read Group Messages / Fetch History
   */
  socket.on("group:history", async ({ groupId }) => {
    try {
      const allowed = await isParticipant(groupId, user.id);
      if (!allowed) {
        logger.warn(
          `[GroupHandler] Unauthorized history request by ${user.id} for group:${groupId}`
        );
        return;
      }

      const history = await getMessageHistory(groupId, 50, true);
      socket.emit("group:history", { groupId, messages: history });
    } catch (err) {
      logger.error(`[GroupHandler] group:history error: ${err.message}`);
    }
  });

  /**
   *   Mark Group Messages as Read
   */
  socket.on("group:read", async ({ groupId }) => {
    const userId = user.id;
    try {
      const allowed = await isParticipant(groupId, userId);
      if (!allowed) {
        logger.warn(
          `[GroupHandler] Unauthorized read by ${userId} on group:${groupId}`
        );
        return;
      }

      const result = await markAsRead(groupId, userId);
      if (result.success) {
        socket.emit("group:read:confirm", { groupId, unreadCount: 0 });
      }

      // Fetch updated history after marking as read
      const history = await getMessageHistory(groupId, 50, true);
      socket.emit("group:history:update", { groupId, messages: history });
    } catch (err) {
      logger.error(`[GroupHandler] group:read error: ${err.message}`);
    }
  });

  /**
   *   Persistence Event (Pub/Sub)
   */
  pub?.on("group:message:persisted", (evt) => {
    if (evt.type === "group" && evt.groupId) {
      io.to(`group:${evt.groupId}`).emit("group:message:persisted", evt);
    }
  });

  /**   Create a Poll in Group
   */
  socket.on("group:poll:create", async ({ channelId, question, options }) => {
    try {
      // Check if user is a participant
      const isMember = await isParticipant(channelId, user.id);
      if (!isMember) {
        socket.emit("group:poll:error", {
          error: "You are not a member of this group",
        });
        return;
      }

      const pollId = await createPoll({
        channelId,
        question,
        options,
        createdBy: user.id,
      });

      // Broadcast the new poll to the group
      io.to(`group:${channelId}`).emit("group:poll:created", {
        pollId,
        question,
        options,
        createdBy: user.id,
      });
    } catch (err) {
      socket.emit("group:poll:error", { error: err.message });
    }
  });

  /**
   * Graceful Socket Disconnect Handling
   */
  socket.on("disconnect", async (reason) => {
    logger.info(`[Socket] User ${user.id} disconnected: ${reason}`);
    try {
    } catch (err) {
      logger.warn(
        `[Socket] Disconnect cleanup failed for user ${user.id}: ${err.message}`
      );
    }
  });
};
