const IORedis = require("ioredis");

/**
 * Redis Subscriber that listens for message persistence events
 * and emits them to connected socket clients.
 */
module.exports = function createRedisSubscriber(io) {
  const redisHost = process.env.REDIS_HOST || "127.0.0.1";
  const redisPort = Number(process.env.REDIS_PORT || 6379);
  const useRedis = !!process.env.REDIS_HOST;

  if (!useRedis) {
    console.warn("Redis not configured — subscriber inactive.");
    return;
  }

  const sub = new IORedis({ host: redisHost, port: redisPort });

  const CHANNELS = ["message:persisted", "group:message:persisted"];

  sub.on("connect", () => {
    console.log(`Redis subscriber connected to ${redisHost}:${redisPort}`);
    sub.subscribe(...CHANNELS, (err, count) => {
      if (err) {
        console.error("Redis subscribe failed:", err.message);
      } else {
        console.log(`Subscribed to ${count} channels: ${CHANNELS.join(", ")}`);
      }
    });
  });

  sub.on("message", (channel, raw) => {
    try {
      const data = JSON.parse(raw);
      console.log(`[${channel}] Received:`, data);

      // Emit to clients using the original event name
      io.to(data.channelId).emit(channel, data);
    } catch (err) {
      console.error(`[${channel}] Invalid payload:`, err.message);
    }
  });

  sub.on("error", (err) => {
    console.error("Redis subscriber error:", err.message);
  });

  sub.on("close", () => {
    console.warn("Redis subscriber connection closed");
  });

  return sub;
};
