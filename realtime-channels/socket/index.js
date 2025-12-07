// socket/index.js
const { Server } = require("socket.io");
const { verifySocketAuth } = require("./utils/socketAuth");
const registerDirectHandler = require("./handlers/directHandler");
const registerGroupHandler = require("./handlers/groupHandler");
const {
  registerPresenceHandler,
  getSocketId,
  getOnlineUsers,
  connectedUsers,
} = require("./handlers/presenceHandler");
const { messageQueue } = require("./config/queue");
const db = require("./config/db");

const useRedis =
  process.env.USE_REDIS === "true" || process.env.NODE_ENV === "production";

let redisPub = null;

if (useRedis) {
  const Redis = require("ioredis");
  redisPub = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  });

  redisPub.on("connect", () => {
    console.log(
      `[Redis] Connected to ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
    );
  });

  redisPub.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });
} else {
  console.warn("[Redis] Disabled — using in-memory mode for messaging");
}

/**
 * Initialize Socket.IO server with all handlers registered.
 */
function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" },
    path: "/socket/v1",
  });

  io.use(verifySocketAuth);

  io.on("connection", (socket) => {
    console.log("[Socket] New client connected, awaiting user:connect...");

    // --- User Connect Event ---
    socket.on("user:connect", async ({ userName }) => {
      try {
        if (!userName || !userName.trim()) {
          socket.emit("error", { message: "Username required" });
          return;
        }

        const result = await db.query(
          `SELECT id, name FROM "User" WHERE name = $1 LIMIT 1`,
          [userName.trim()]
        );

        let user = result.rows[0];

        // Create user if not found
        if (!user) {
          const createRes = await db.query(
            `INSERT INTO "User" (name, "isActive", "createdAt", "updatedAt")
           VALUES ($1, true, NOW(), NOW())
           RETURNING id, name`,
            [userName.trim()]
          );
          user = createRes.rows[0];
        }

        // Attach user to socket for later use
        socket.user = user;

        // Emit back to frontend
        socket.emit("user:connected", { userId: user.id, userName: user.name });

        console.log(`[User] Connected: ${user.name} (${user.id})`);

        // --- Register modular handlers after user connection ---
        registerPresenceHandler(io, socket);
        registerDirectHandler(io, socket, redisPub, messageQueue);
        registerGroupHandler(io, socket, redisPub, messageQueue);

        // Send online users immediately
        socket.emit("users:online", getOnlineUsers());
      } catch (err) {
        console.error("[user:connect] Error:", err.message);
        socket.emit("error", { message: "Failed to connect user" });
      }
    });

    socket.on("getChannels", async () => {
      try {
        const result = await db.query(`
          SELECT 
            id, type, name, avatar, description, 
            created_by AS "ownerId", 
            created_at AS "createdAt", 
            updated_at AS "updatedAt"
          FROM "Channel"
          ORDER BY created_at DESC
        `);
        socket.emit("channels", result.rows);
      } catch (err) {
        console.error("Error fetching channels:", err.message);
        socket.emit("error", { message: "Failed to fetch channels" });
      }
    });

    socket.on("getChannelMembers", async ({ channelId }) => {
      try {
        const result = await db.query(
          `SELECT u.id AS "userId", u.name AS "userName"
           FROM "ChannelParticipant" cp
           JOIN "User" u ON cp."userId" = u.id
           WHERE cp."channelId" = $1`,
          [channelId]
        );
        socket.emit("channelMembers", { channelId, members: result.rows });
      } catch (err) {
        console.error("Error fetching channel members:", err.message);
        socket.emit("error", { message: "Failed to fetch channel members" });
      }
    });

    socket.on("getChannelMessages", async ({ channelId }) => {
      try {
        const result = await db.query(
          `SELECT 
             m.id,
             m."clientMessageId",
             m."senderId",
             m."senderName",
             m."receiverId",
             m."receiverName",
             m."messageType",
             m.message,
             m.content,
             m.metadata,
             m."status",
             m."isGroup",
             m."encrypted",
             m."encryptionVersion",
             m."createdAt",
             m."updatedAt",
             COALESCE(json_agg(ma.*) FILTER (WHERE ma.id IS NOT NULL), '[]') AS attachments
           FROM "Message" m
           LEFT JOIN "MessageAttachment" ma ON ma."messageId" = m.id
           WHERE m."channelId" = $1
           GROUP BY m.id
           ORDER BY m."createdAt" ASC`,
          [channelId]
        );
        socket.emit("channelMessages", { channelId, messages: result.rows });
      } catch (err) {
        console.error("Error fetching channel messages:", err.message);
        socket.emit("error", { message: "Failed to fetch channel messages" });
      }
    });

    // --- Fetch all users from DB ---
    socket.on("getUsers", async () => {
      try {
        const result = await db.query(`
      SELECT 
        id,
        name AS "userName",
        avatar,
        email,
        "createdAt",
        "updatedAt",
        "isActive",
        "deletedAt"
      FROM "User"
      ORDER BY name ASC
    `);

        socket.emit("users", result.rows);
      } catch (err) {
        console.error("Error fetching users:", err.message);
        socket.emit("error", { message: "Failed to fetch users" });
      }
    });

    // --- Disconnect ---
    socket.on("disconnect", () => {
      console.log(`[socket] ${user.name} disconnected`);
    });
  });

  return io;
}

module.exports = {
  initSocket,
  getSocketId,
  connectedUsers,
};
