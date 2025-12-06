require("dotenv").config();
console.log("[DEBUG] DATABASE_URL =", process.env.DATABASE_URL);
const db = require("./config/db");
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");

const { initSocket, connectedUsers, getSocketId } = require("./index");
const { messageQueue } = require("./config/queue");
const { pub } = require("./queue/worker");

if (!messageQueue) {
  console.warn(
    "[Warning] Message queue not initialized — using in-memory mode"
  );
}

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());
const server = http.createServer(app);

const io = initSocket(server);
app.set("io", io);

// --- Express: keep healthz & static for ops ---
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/healthz", async (_, res) => {
  const health = {
    status: "ok",
    database: false,
    redis: false,
    queue: !!messageQueue,
    sockets: {
      totalConnected: io.engine.clientsCount || 0,
      onlineUsers: Object.keys(connectedUsers).length,
      connectedUserIds: Object.keys(connectedUsers),
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  try {
    if (db?.query) {
      await db.query("SELECT 1");
      health.database = true;
    }
    if (pub && (pub.status === "ready" || (await pub.ping()))) {
      health.redis = true;
    }
  } catch (err) {
    health.status = "degraded";
    health.error = err.message;
  }

  const code = health.status === "ok" ? 200 : 500;
  res.status(code).json(health);
});

async function shutdown() {
  console.log("\nShutting down comms-service...");
  try {
    if (db.end) await db.end();
    if (typeof messageQueue.shutdown === "function") messageQueue.shutdown();
    if (pub && typeof pub.disconnect === "function") pub.disconnect();
    await new Promise((resolve) => server.close(resolve));
    console.log("Shutdown complete.");
  } catch (err) {
    console.error("Shutdown error:", err.message);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const PORT = process.env.PORT || 4000;

server
  .listen(PORT, () => {
    console.log(`Comms Socket Server running on port ${PORT}`);
  })
  .on("error", (err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
