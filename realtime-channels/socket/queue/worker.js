require("dotenv").config();

const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const { Pool } = require("pg");
const EventEmitter = require("events");
const { messageQueue, usingRedis } = require("../config/queue");

const REDIS = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let pub;
let pubIsRedis = false;
if (usingRedis) {
  pub = new IORedis(REDIS);
  pubIsRedis = true;
} else {
  pub = new EventEmitter();
}

const QUEUE_NAME = process.env.QUEUE_NAME || "message-persistence";
console.log(
  `Worker initialized for queue: ${QUEUE_NAME} (usingRedis=${usingRedis})`
);

/**
 * Increment unread counts for other participants
 */
async function updateUnreadCounts(client, channelId, senderId) {
  const query = `
    UPDATE "ChannelParticipant"
    SET "unreadCount" = "unreadCount" + 1
    WHERE "channelId" = $1 AND "userId" != $2
    RETURNING "userId", "unreadCount";
  `;
  const res = await client.query(query, [channelId, senderId]);
  return res.rows || [];
}

/**
 * Persist direct message + attachments atomically
 */
async function persistMessage(msg) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT 1 FROM "Message"
       WHERE "id"=$1 OR "tempId"=$2 OR "clientMessageId"=$3`,
      [msg.id, msg.tempId, msg.clientMessageId]
    );
    if (exists.rowCount > 0) {
      await client.query("ROLLBACK");
      console.log(`Message ${msg.id} already persisted — skipping`);
      return { ok: true, note: "duplicate" };
    }

    const insertSQL = `
      INSERT INTO "Message"
        (id, "tempId", "clientMessageId", "channelId", "sessionId",
         "senderId", "senderName", "receiverId", "receiverName",
         "messageType", "message", "content", "metadata",
         "status", "isGroup", "encrypted", "encryptionVersion",
         "createdAt", "updatedAt", "persistedAt")
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,$12,$13,
        $14,$15,$16,$17,
        $18, now(), now()
      )
      RETURNING id, "channelId";
    `;

    const values = [
      msg.id,
      msg.tempId || null,
      msg.clientMessageId || null,
      msg.channelId,
      msg.sessionId || null,
      msg.senderId,
      msg.senderName || null,
      msg.receiverId || null,
      msg.receiverName || null,
      msg.messageType || "text",
      msg.message || null,
      JSON.stringify(msg.content || null),
      JSON.stringify(msg.metadata || {}),
      "persisted",
      false,
      msg.encrypted || false,
      msg.encryptionVersion || null,
      msg.createdAt || new Date().toISOString(),
    ];

    const res = await client.query(insertSQL, values);
    const created = res.rows[0];

    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      const attachValues = [];
      const attachPlaceholders = [];

      msg.attachments.forEach((a, i) => {
        const base = i * 4;
        attachValues.push(
          created.id,
          a.url,
          a.mimeType || null,
          JSON.stringify(a.meta || {})
        );
        attachPlaceholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        );
      });

      const attachSQL = `
        INSERT INTO "MessageAttachment" ("messageId", "url", "mimeType", "meta")
        VALUES ${attachPlaceholders.join(", ")}
      `;
      await client.query(attachSQL, attachValues);
    }

    const unreadUpdates = await updateUnreadCounts(
      client,
      msg.channelId,
      msg.senderId
    );

    await client.query("COMMIT");

    return {
      ok: true,
      created,
      unreadUpdates,
      persistedAt: new Date().toISOString(),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Persist transaction failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Persist group message + attachments atomically
 */
async function persistGroupMessage(msg) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT 1 FROM "Message"
       WHERE "id"=$1 OR "tempId"=$2 OR "clientMessageId"=$3`,
      [msg.id, msg.tempId, msg.clientMessageId]
    );
    if (exists.rowCount > 0) {
      await client.query("ROLLBACK");
      console.log(`Group message ${msg.id} already persisted — skipping`);
      return { ok: true, note: "duplicate" };
    }

    const insertSQL = `
      INSERT INTO "Message"
        (id, "tempId", "clientMessageId", "channelId", "sessionId",
         "senderId", "senderName",
         "messageType", "message", "content", "metadata",
         "status", "isGroup", "encrypted", "encryptionVersion",
         "createdAt", "updatedAt", "persistedAt")
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,
        $8,$9,$10,$11,
        $12,$13,$14,$15,
        $16, now(), now()
      )
      RETURNING id, "channelId";
    `;

    // groupId is stored as channelId
    const values = [
      msg.id,
      msg.tempId || null,
      msg.clientMessageId || null,
      msg.groupId, // 👈 key fix
      msg.sessionId || null,
      msg.senderId,
      msg.senderName || null,
      msg.messageType || "text",
      msg.message || null,
      JSON.stringify(msg.content || null),
      JSON.stringify(msg.metadata || {}),
      "persisted",
      true,
      msg.encrypted || false,
      msg.encryptionVersion || null,
      msg.createdAt || new Date().toISOString(),
    ];

    const res = await client.query(insertSQL, values);
    const created = res.rows[0];

    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      const attachValues = [];
      const attachPlaceholders = [];

      msg.attachments.forEach((a, i) => {
        const base = i * 4;
        attachValues.push(
          created.id,
          a.url,
          a.mimeType || null,
          JSON.stringify(a.meta || {})
        );
        attachPlaceholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        );
      });

      const attachSQL = `
        INSERT INTO "MessageAttachment" ("messageId", "url", "mimeType", "meta")
        VALUES ${attachPlaceholders.join(", ")}
      `;
      await client.query(attachSQL, attachValues);
    }

    const unreadUpdates = await updateUnreadCounts(
      client,
      msg.groupId, // 👈 key fix
      msg.senderId
    );

    await client.query("COMMIT");

    return {
      ok: true,
      created,
      unreadUpdates,
      persistedAt: new Date().toISOString(),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Persist group transaction failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Deactivate users inactive for a defined period
 */
async function deactivateAbandonedUsers() {
  const years = Number(process.env.USER_INACTIVITY_YEARS || 2);
  const threshold = new Date();
  threshold.setFullYear(threshold.getFullYear() - years);

  try {
    // Deactivate abandoned users and get their IDs
    const { rows } = await pool.query(
      `UPDATE "User"
       SET "isActive" = false, "deletedAt" = NOW()
       WHERE "lastLogin" < $1 AND "isActive" = true
       RETURNING id, "name", "email";`,
      [threshold]
    );

    const userIds = rows.map((u) => u.id);

    if (userIds.length > 0) {
      // Deactivate their participations
      await pool.query(
        `UPDATE "ChannelParticipant"
         SET "isActive" = false
         WHERE "userId" = ANY($1);`,
        [userIds]
      );

      // Prepare event payload
      const eventPayload = {
        event: "user:deactivated",
        count: userIds.length,
        users: rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        })),
        timestamp: new Date().toISOString(),
      };

      // Emit event through Redis or in-memory pub/sub
      if (pubIsRedis) {
        await pub.publish("user:deactivated", JSON.stringify(eventPayload));
      } else {
        pub.emit("user:deactivated", eventPayload);
      }

      console.log(
        `Deactivated ${userIds.length} abandoned users — event emitted.`
      );
    } else {
      console.log("No users to deactivate.");
    }
  } catch (err) {
    console.error("Error deactivating abandoned users:", err.message);
  }
}



// Function to run the deactivation process periodically
async function runDeactivation() {
  try {
    await deactivateAbandonedUsers();
    console.log("Abandoned user deactivation complete.");
  } catch (err) {
    console.error("Error during abandoned user deactivation:", err.message);
  }
}

// Run once on startup
runDeactivation();

// Schedule to run daily (every 24 hours)
setInterval(runDeactivation, 24 * 60 * 60 * 1000); // 24 hours in ms

/**
 * Core job handler
 */
async function processJobWrapper(jobLike) {
  const msg = jobLike?.data || jobLike;

  try {
    const result = msg.isGroup
      ? await persistGroupMessage(msg)
      : await persistMessage(msg);

    if (!result.ok) throw new Error("Message persistence failed");

    const eventPayload = {
      id: result.created.id,
      clientMessageId: msg.clientMessageId,
      channelId: result.created.channelId,
      senderId: msg.senderId,
      messageType: msg.messageType,
      unreadUpdates: result.unreadUpdates,
      status: "persisted",
      persistedAt: result.persistedAt,
    };

    const eventName = msg.isGroup
      ? "group:message:persisted"
      : "message:persisted";

    if (pubIsRedis) {
      await pub.publish(eventName, JSON.stringify(eventPayload));
    } else {
      pub.emit(eventName, eventPayload);
    }

    console.log(`Message ${msg.id} persisted and event emitted.`);
    return { ok: true };
  } catch (err) {
    console.error(`Job failed for message ${msg.id}:`, err.message);
    throw err;
  }
}

/**
 * Worker setup
 */
if (usingRedis) {
  console.log("Starting BullMQ worker (Redis) ...");
  const worker = new Worker(QUEUE_NAME, processJobWrapper, {
    connection: REDIS,
    concurrency: 5,
    limiter: { max: 50, duration: 1000 },
  });

  worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
  worker.on("failed", (job, err) =>
    console.error(`Job ${job?.id} failed:`, err?.message || err)
  );
  worker.on("error", (err) =>
    console.error("Worker connection error:", err.message)
  );

  process.on("SIGINT", async () => {
    console.log("Shutting down Redis worker...");
    await worker.close();
    await pool.end();
    if (pubIsRedis) pub.disconnect();
    process.exit(0);
  });
} else {
  console.log("Using in-memory queue processing (no Redis) ...");
  messageQueue.process(async (jobLike) => {
    try {
      await processJobWrapper(jobLike);
    } catch (err) {
      console.error("In-memory job error:", err.message);
    }
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down in-memory worker...");
    try {
      if (typeof messageQueue.shutdown === "function") messageQueue.shutdown();
      await pool.end();
    } catch (e) {
      console.error("Shutdown error:", e?.message || e);
    } finally {
      process.exit(0);
    }
  });
}

module.exports = { pub, usingRedis, processJobWrapper };
