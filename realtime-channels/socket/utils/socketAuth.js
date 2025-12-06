function verifySocketAuth(socket, next) {
  try {
    const { userId, name } = socket.handshake.auth || {};

    if (!userId) {
      console.warn(`[auth] Missing userId`);
      return next(new Error("Unauthorized: missing userId"));
    }

    socket.user = { id: userId, name: name || "Anonymous" };

    if (!socket.user?.id) {
      return next(new Error("Unauthorized: invalid user"));
    }

    return next();
  } catch (err) {
    return next(new Error(`Socket auth failed: ${err.message}`));
  }
}

module.exports = { verifySocketAuth };
