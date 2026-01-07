// config/queue.js
require("dotenv").config();
const mongoose = require("mongoose");
const EventEmitter = require("events");

const usingRedis =
  process.env.USE_REDIS === "true" || process.env.NODE_ENV === "production";

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing in environment variables");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("[DB] Connected to MongoDB"))
  .catch((err) => {
    console.error("[DB] MongoDB connection error:", err.message);
    process.exit(1);
  });

mongoose.connection.on("error", (err) => {
  console.error("[DB] Unexpected MongoDB error:", err.message);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("[DB] MongoDB connection closed");
  process.exit(0);
});

// --- Queue Logic (Redis or In-Memory Fallback) ---
let messageQueue;

if (usingRedis) {
  console.log("[Queue] Redis mode enabled");
  messageQueue = null; // Redis worker handles queue externally
} else {
  console.log("[Queue] Using in-memory message queue");

  const emitter = new EventEmitter();

  // Simple API for job processing
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

module.exports = { mongoose, messageQueue, usingRedis };
