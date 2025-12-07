// handlers/presenceHandler.js - ENHANCED VERSION
const logger = require("../utils/logger");

const connectedUsers = {}; // { userId: Set<socket.id> }
const userStatus = {}; // { userId: { status: 'online'|'away'|'offline', lastSeen } }

/**
 * Registers user presence and emits online/offline events.
 */
function registerPresenceHandler(io, socket) {
  const { id: userId, name } = socket.user;

  // Initialize user tracking
  if (!connectedUsers[userId]) {
    connectedUsers[userId] = new Set();
  }

  connectedUsers[userId].add(socket.id);

  // Update user status
  userStatus[userId] = {
    status: "online",
    lastSeen: new Date().toISOString(),
    username: name,
  };

  if (connectedUsers[userId].size === 1) {
    logger.info(`[presence] ${name} online (${socket.id})`);
    io.emit("user:online", {
      userId,
      username: name,
      timestamp: new Date().toISOString(),
    });
  }

  // Typing indicators
  socket.on("typing:start", ({ conversationId, type = "direct" }) => {
    socket.to(conversationId).emit("user:typing", {
      userId,
      username: name,
      conversationId,
      type,
    });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    socket.to(conversationId).emit("user:stop:typing", {
      userId,
      conversationId,
    });
  });

  // User status updates
  socket.on("user:status:update", ({ status }) => {
    if (["online", "away", "busy"].includes(status)) {
      userStatus[userId].status = status;
      userStatus[userId].lastSeen = new Date().toISOString();

      io.emit("user:status:changed", {
        userId,
        status,
        timestamp: userStatus[userId].lastSeen,
      });
    }
  });

  socket.on("disconnect", (reason) => {
    // Clean up typing indicators for all rooms
    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      if (room !== socket.id) {
        // Don't emit to personal room
        socket.to(room).emit("user:stop:typing", {
          userId,
          conversationId: room,
        });
      }
    });

    // Defensive guard
    if (!connectedUsers[userId]) return;

    const userSockets = connectedUsers[userId];
    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      delete connectedUsers[userId];
      userStatus[userId] = {
        status: "offline",
        lastSeen: new Date().toISOString(),
        username: name,
      };

      io.emit("user:offline", {
        userId,
        timestamp: userStatus[userId].lastSeen,
        username: name,
      });
      logger.info(
        `[presence] ${name} offline (${socket.id}) - Reason: ${reason}`
      );
    } else {
      logger.debug(
        `[presence] ${name} socket disconnected (${socket.id}) — ${userSockets.size} sockets remaining`
      );
    }
  });
}

/**
 * Get one socket ID (e.g., for direct messaging).
 */
function getSocketId(userId) {
  const sockets = connectedUsers[userId];
  return sockets ? Array.from(sockets)[0] : null;
}

/**
 * Utility: Get all socket IDs for a user.
 */
function getSocketIds(userId) {
  return connectedUsers[userId] ? Array.from(connectedUsers[userId]) : [];
}

/**
 * Utility: Return list of online users.
 */
function getOnlineUsers() {
  return Object.keys(connectedUsers).filter((userId) => {
    const sockets = connectedUsers[userId];
    return sockets && sockets.size > 0;
  });
}

/**
 * Get user status information
 */
function getUserStatus(userId) {
  return userStatus[userId] || { status: "offline", lastSeen: null };
}

/**
 * Get all user statuses
 */
function getAllUserStatuses() {
  return userStatus;
}

module.exports = {
  registerPresenceHandler,
  getSocketId,
  getSocketIds,
  getOnlineUsers,
  getUserStatus,
  getAllUserStatuses,
  connectedUsers,
};
