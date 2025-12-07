// config/queue.js
require("dotenv").config();
const { Pool } = require("pg");
const EventEmitter = require("events");

const usingRedis =
  process.env.USE_REDIS === "true" || process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: usingRedis ? { rejectUnauthorized: false } : false,
});

pool.on("connect", () => {
  console.log("[DB] Connected to PostgreSQL");
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error:", err.message);
});

process.on("SIGINT", async () => {
  await pool.end();
  console.log("[DB] Pool closed");
  process.exit(0);
});

let messageQueue;

// Fallback logic
if (usingRedis) {
  console.log("[Queue] Redis mode enabled");
  messageQueue = null; // Worker will handle Redis connection
} else {
  console.log("[Queue] Using in-memory message queue");
  const emitter = new EventEmitter();

  // Minimal API for compatibility
  messageQueue = {
    process: (handler) => {
      emitter.on("enqueue", (job) => handler(job));
    },
    add: async (jobName, data) => {
      emitter.emit("enqueue", { name: jobName, data });
    },
    shutdown: () => emitter.removeAllListeners(),
    emit: (...args) => emitter.emit(...args),
    on: (...args) => emitter.on(...args),
  };
}

module.exports = { pool, messageQueue, usingRedis };
