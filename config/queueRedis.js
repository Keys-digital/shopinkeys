const IORedis = require("ioredis");

const queueRedis = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        // Retry after: 50ms, 100ms, 150ms... max 2000ms
        return Math.min(times * 50, 2000);
    },
});

queueRedis.on("connect", () => {
    console.log("🚀 BullMQ Redis connected");
});

queueRedis.on("error", (err) => {
    console.error("❌ BullMQ Redis error:", err);
});

module.exports = queueRedis;
