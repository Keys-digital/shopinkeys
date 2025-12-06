require("dotenv").config();
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");
const { PrismaClient, MessageType } = require("../generated/prisma");
const prisma = new PrismaClient();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const {
  users,
  directChannels,
  groupChannels,
  messages,
} = require("../seedData");

async function seed() {
  try {
    const now = new Date();

    // -----------------------------
    // Insert User
    // -----------------------------
    for (const user of users) {
      await pool.query(
        `INSERT INTO "User" (id, name, avatar, email, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO NOTHING`,
        [user.id, user.name, user.avatar, user.email, now, now]
      );
    }

    // -----------------------------
    // Insert Direct Channels & Participants
    // -----------------------------
    for (const ch of directChannels) {
      const creatorId = ch.participants[0]; // user A
      const channelName =
        users.find((u) => u.id === creatorId)?.name ||
        `direct-channel-${ch.id}`;

      await pool.query(
        `INSERT INTO "Channel" (id, type, name, avatar, "created_by", "created_at", "updated_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
        [ch.id, ch.type, channelName, ch.avatar || null, creatorId, now, now]
      );

      for (const userId of ch.participants) {
        const role = "member";
        await pool.query(
          `INSERT INTO "ChannelParticipant" ("id", "channelId", "userId", role, "joinedAt")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [uuidv4(), ch.id, userId, role, now]
        );
      }
    }

    // -----------------------------
    // Insert Group Channels, Participants, & Roles
    // -----------------------------
    for (const group of groupChannels) {
      await pool.query(
        `INSERT INTO "Channel" (
     id, type, name, avatar, description, "created_by", "created_at", "updated_at"
   )
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   ON CONFLICT (id) DO NOTHING`,
        [
          group.id,
          group.type,
          group.name,
          group.avatar || null,
          group.description || null,
          group.admins?.[0] || null,
          now,
          now,
        ]
      );

      for (const userId of group.participants) {
        const role = group.admins.includes(userId) ? "admin" : "member";

        // Find the user details from your users array
        const user = users.find((u) => u.id === userId);
        if (!user) continue; // skip if not found

        await pool.query(
          `INSERT INTO "User" (id, name, avatar, email, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO NOTHING`,
          [user.id, user.name, user.avatar, user.email, now, now]
        );

        await pool.query(
          `INSERT INTO "ChannelParticipant" ("id", "channelId", "userId", role, "joinedAt")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
          [uuidv4(), group.id, userId, role, now]
        );
      }
    }

    // -----------------------------
    // Insert Messages (via Prisma)
    // -----------------------------
    for (const msg of messages) {
      const messageType = Object.values(MessageType).includes(msg.messageType)
        ? msg.messageType
        : MessageType.text;

      await prisma.message.create({
        data: {
          id: msg.id,
          channelId: msg.channelId,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          sessionId: msg.sessionId,
          messageType,
          content: msg.content || {},
          metadata: msg.metadata || {},
          status: msg.status || "queued",
          isRead: msg.isRead || false,
          isGroup: msg.isGroup || false,
          encrypted: msg.encrypted || false,
          encryptionVersion: msg.encryptionVersion || null,
          senderName: msg.senderName || null,
          receiverName: msg.receiverName || null,
          attachments:
            msg.attachments && msg.attachments.length > 0
              ? { create: msg.attachments }
              : undefined,
          createdAt: new Date(msg.createdAt),
          updatedAt: new Date(msg.updatedAt),
        },
      });
    }

    console.log("Seeding completed successfully!");
  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

seed();
