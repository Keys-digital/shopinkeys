const formatMessage = require("../utils/messageFormatter");
const DirectMessage = require("../models/directMessageModel");
const inMemoryStore = require("../utils/inMemoryStore");
const { updateUnreadCount } = require("../utils/unreadUtils");
const { markAsRead } = require("../utils/readUtils");
const { getMessageHistory } = require("../utils/historyUtils");
const { isParticipant } = require("../utils/channelUtils");
const getConversationId = require("../utils/conversationId");
const logger = require("../utils/logger");
const { pub } = require("../queue/worker");

const db = require("../config/db");

/**
 * Load all direct chat channels and messages for a given user.
 */
const loadUserChannels = async (userId) => {
  // Fetch all channels this user participates in
  const channelQuery = `
    SELECT 
      c.id,
      c.name,
      c.type,
      c.avatar,
      c.description,
      c.created_by   AS "createdBy",
      c.created_at   AS "createdAt",
      c.updated_at   AS "updatedAt"
    FROM "Channel" c
    INNER JOIN "ChannelParticipant" cp 
      ON c.id = cp."channelId"
    WHERE cp."userId" = $1
      AND c.type = 'direct'
      AND c."isActive" = true
      AND c."deletedAt" IS NULL;
  `;

  const { rows: channels } = await db.query(channelQuery, [userId]);

  // Attach participants and messages to each channel
  for (const channel of channels) {
    // Participants
    const participantsQuery = `
      SELECT 
        u.id AS "userId",
        u.name AS "userName",
        u.avatar AS "userAvatar"
      FROM "ChannelParticipant" cp
      INNER JOIN "User" u 
        ON cp."userId" = u.id
      WHERE cp."channelId" = $1
        AND u."isActive" = true
        AND u."deletedAt" IS NULL;
    `;
    const { rows: participants } = await db.query(participantsQuery, [
      channel.id,
    ]);
    channel.participants = participants;

    // Messages
    const messagesQuery = `
      SELECT 
        m.id,
        m.content,
        m."createdAt",
        m."senderId" AS "userId",
        u.name AS "userName",
        u.avatar AS "userAvatar"
      FROM "Message" m
      INNER JOIN "User" u 
        ON m."senderId" = u.id
      WHERE u."isActive" = true
        AND u."deletedAt" IS NULL
        AND m."channelId" = $1
      ORDER BY m."createdAt" ASC;
    `;
    const { rows: messages } = await db.query(messagesQuery, [channel.id]);
    channel.messages = messages;
  }

  return channels;
};

const getUserActiveConversations = async (userId) => {
  try {
    const conversations = await DirectMessage.getUserConversations(userId);
    return conversations.map((conv) => ({
      participantId: conv.participantId,
      channelId: conv.channelId,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
    }));
  } catch (error) {
    logger.error(`Error getting active conversations: ${error.message}`);
    return [];
  }
};

/**
 * Ensure a direct channel exists between two users.
 * Uses getConversationId() for consistent naming.
 */
async function createChannel(userId1, userId2) {
  try {
    const channelName = `direct_${getConversationId(userId1, userId2)}`;

    // Check if it already exists
    const checkQuery = `
      SELECT id FROM "Channel"
WHERE name = $1
  AND type = 'direct'
  AND "isActive" = true
  AND "deletedAt" IS NULL
LIMIT 1;

    `;
    const { rows: existing } = await db.query(checkQuery, [channelName]);
    if (existing.length > 0) {
      logger.debug(
        `[DirectHandler] Existing direct channel found: ${existing[0].id}`
      );
      return existing[0];
    }

    // Create new channel
    const insertChannelQuery = `
      INSERT INTO "Channel" (id, name, type, "created_by", "created_at")
      VALUES (gen_random_uuid(), $1, 'direct', $2, NOW())
      RETURNING id;
    `;
    const { rows } = await db.query(insertChannelQuery, [channelName, userId1]);
    const newChannel = rows[0];

    // Add both users as participants
    const participantQuery = `
      INSERT INTO "ChannelParticipant" ("channelId", "userId", "joinedAt", "unreadCount")
      VALUES ($1, $2, NOW(), 0), ($1, $3, NOW(), 0);
    `;
    await db.query(participantQuery, [newChannel.id, userId1, userId2]);

    logger.debug(
      `[DirectHandler] Created new channel ${newChannel.id} for users ${userId1}, ${userId2}`
    );
    return newChannel;
  } catch (err) {
    logger.error(`[DirectHandler] createChannel error: ${err.message}`);
    throw err;
  }
}

/**
 * Register Direct (1-to-1) chat handlers for a socket connection.
 */
module.exports = function registerDirectHandler(
  io,
  socket,
  redisPub,
  messageQueue
) {
  const user = socket.user;

  // Load all direct chat channels for this user when they connect
  (async () => {
    try {
      const channels = await loadUserChannels(user.id);

      // Join all direct channel rooms
      channels.forEach((ch) => socket.join(ch.id));

      // Send full channel data to the client
      socket.emit("channels:load", channels);

      logger.debug(
        `[DirectHandler] ${user.id} joined ${channels.length} direct channels.`
      );
    } catch (err) {
      logger.error(
        `[DirectHandler] Failed to load user channels: ${err.message}`
      );
    }
  })();

  // Clear existing listeners for this socket
  socket.removeAllListeners("message:send");
  socket.removeAllListeners("message:read");
  socket.removeAllListeners("direct:history");

  // Join all existing direct chat rooms for this user on connection
  (async () => {
    try {
      const activeConversations = await getUserActiveConversations(user.id);
      activeConversations.forEach(({ participantId }) => {
        const conversationId = getConversationId(user.id, participantId);
        socket.join(conversationId);
        logger.debug(
          `[Socket] User ${user.id} joined conversation: ${conversationId}`
        );
      });
    } catch (error) {
      logger.warn(
        `Failed to join conversations for ${user.id}: ${error.message}`
      );
    }
  })();

  /**
   * Send a direct message
   */
  socket.on("message:send", async (payload) => {
    try {
      logger.debug(`[DirectHandler] Message send payload:`, payload);

      // Ensure deterministic channelId for direct messages
      if (!payload.channelId && payload.receiverId) {
        const channelName = `direct_${getConversationId(
          user.id,
          payload.receiverId
        )}`;

        const existingChannel = await db.query(
          `SELECT id FROM "Channel"
WHERE name = $1
  AND type = 'direct'
  AND "isActive" = true
  AND "deletedAt" IS NULL
LIMIT 1;`,
          [channelName]
        );

        if (existingChannel.rows.length > 0) {
          payload.channelId = existingChannel.rows[0].id;
        } else {
          // Create a new DB-backed channel if it doesn't exist
          const channel = await createChannel(user.id, payload.receiverId);
          payload.channelId = channel.id;
        }
      }
      if (!payload.channelId) {
        throw new Error("Missing channelId or receiverId");
      }

      const formattedMessage = formatMessage(payload, user, {
        status: "queued",
      });

      const message = new DirectMessage(formattedMessage);

      // Attach client tempId so client can reconcile optimistic message
      if (payload.tempId) {
        message.tempId = payload.tempId;
      }

      // === Optimistic broadcast (so both users see it immediately)
      io.to(message.channelId).emit("message:receive", {
        ...message,
        tempId: payload.tempId,
        optimistic: true,
      });

      // ACK to sender
      socket.emit("message:ack", {
        tempId: payload.tempId,
        status: message.status,
        createdAt: message.createdAt,
      });

      // === Persist message in DB
      try {
        await message.save();
        logger.debug(
          `[DirectHandler] Message saved successfully: ${message.id}`
        );
      } catch (saveError) {
        logger.error(
          `[DirectHandler] Failed to save message: ${saveError.message}`
        );
      }

      // === Unread counts / notifications
      try {
        const unreadUpdates = await updateUnreadCount(
          message.channelId,
          message.senderId
        );
        unreadUpdates.forEach((u) => {
          io.to(u.userId).emit("message:unread", u);
        });
      } catch (unreadError) {
        logger.debug(
          `[DirectHandler] Unread count update failed: ${unreadError.message}`
        );
      }

      // === Redis cache
      const listKey = `channel:message:${message.channelId}`;
      try {
        await redisPub.rpush(listKey, JSON.stringify(message));
        await redisPub.ltrim(listKey, -200, -1);
      } catch (e) {
        logger.debug(`Redis cache store failed (safe to ignore): ${e.message}`);
      }

      // === Delivery confirmation
      if (message.receiverId) {
        const receiverConversationId = getConversationId(
          message.receiverId,
          message.senderId
        );
        io.to(receiverConversationId).emit("message:delivered", {
          tempId: payload.tempId,
        });
      }

      // === Persistence confirmation (final confirmation)
      socket.emit("message:persisted", {
        tempId: payload.tempId,
        id: message.id,
        channelId: message.channelId,
        persistedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`[DirectHandler] Message send error: ${err.message}`);
      socket.emit("message:error", {
        error: "Failed to send message",
        details: err.message,
        tempId: payload.tempId,
      });
    }
  });

  /**
     /**
   * Read / Fetch history
   */
  socket.on("direct:history", async ({ receiverId }) => {
    try {
      if (!receiverId) {
        throw new Error("receiverId is required");
      }

      const finalChannelId = getConversationId(user.id, receiverId);
      const userId = user.id;

      logger.debug(
        `[DirectHandler] Fetching history for channel: ${finalChannelId}`
      );

      // Use the model instead of utility
      const history = await DirectMessage.getHistory(finalChannelId, 50);

      socket.emit("direct:history", {
        channelId: finalChannelId,
        messages: history,
      });

      logger.debug(
        `[DirectHandler] Sent ${history.length} messages to user ${userId}`
      );
    } catch (err) {
      logger.error(`[DirectHandler] Error in direct:history: ${err.message}`);
      socket.emit("message:error", {
        error: "Failed to load message history",
        details: err.message,
      });
    }
  });

  /**
   * Mark messages as read
   */
  socket.on("message:read", async ({ channelId, receiverId }) => {
    try {
      const finalChannelId =
        channelId || getConversationId(user.id, receiverId);
      const userId = user.id;

      const ok = await isParticipant(finalChannelId, userId);
      if (!ok) {
        logger.warn(
          `[DirectHandler] Unauthorized read attempt by ${userId} on ${finalChannelId}`
        );
        return;
      }

      const result = await markAsRead(finalChannelId, userId);
      if (result.success) {
        logger.debug(
          `[DirectHandler] Unread count reset for ${userId} in ${finalChannelId}`
        );
        socket.emit("message:read:confirm", {
          channelId: finalChannelId,
          unreadCount: 0,
        });
      }
    } catch (err) {
      logger.error(`[DirectHandler] Error in message:read: ${err.message}`);
    }
  });

  /**
   *  3. Persistence confirmation via pub/sub
   */
  pub?.on("message:persisted", (evt) => {
    if (evt.type === "direct" && evt.channelId) {
      io.to(evt.channelId).emit("message:persisted", evt);
    }
  });
};

/**
 * 4. Handle user deactivation broadcast
 */
pub?.on("user:deactivated", (evt) => {
  try {
    const data = typeof evt === "string" ? JSON.parse(evt) : evt;
    io.emit("user:deactivated", data);
    logger.debug(
      `[DirectHandler] Broadcasted user:deactivated — ${data.count} users`
    );
  } catch (err) {
    logger.error(
      `[DirectHandler] Failed to broadcast user:deactivated: ${err.message}`
    );
  }
});
