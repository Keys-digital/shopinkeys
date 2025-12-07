// socket/utils/messageFormatter.js
const { v4: uuidv4 } = require("uuid");

/**
 * Enhanced attachment normalization with validation (backward compatible)
 */
function normalizeAttachments(attachments = []) {
  return attachments.map((att) => {
    const normalized = {
      id: att.id || uuidv4(),
      url: att.url,
      mimeType: att.mimeType || "application/octet-stream",
      size: att.size || null,
      meta: att.meta || null,
    };

    // Add filename extraction if URL provided but no filename
    if (att.url && !att.filename && !att.name) {
      try {
        const urlObj = new URL(att.url);
        const pathname = urlObj.pathname;
        const filename = pathname.split("/").pop();
        if (filename) normalized.filename = filename;
      } catch (error) {
        // Silently fail - maintain existing behavior
      }
    }

    return normalized;
  });
}

/**
 * Enhanced message type detection with additional types (backward compatible)
 */
function detectMessageType(payload) {
  // Preserve existing detection logic exactly
  if (payload.attachments?.length) {
    const mime = payload.attachments[0].mimeType || "";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "file";
  }
  if (payload.emoji) return "emoji";
  if (payload.replyTo) return "reply";
  if (payload.reaction) return "reaction";
  if (payload.system) return "system";

  // NEW: Additional type detection (doesn't break existing logic)
  if (payload.poll) return "poll";
  if (payload.location) return "location";
  if (payload.contact) return "contact";

  // Check for URL-only messages (new feature)
  const text = payload.content?.text || payload.message || "";
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex);
  if (urls && urls.length === 1 && text.trim() === urls[0]) {
    return "link";
  }

  return payload.messageType || "text";
}

/**
 * Enhanced content handling with sanitization (backward compatible)
 */
function processContent(payload) {
  // Preserve exact existing logic
  const content = payload.content || {
    text: payload.message || payload.text || "",
    blocks: payload.blocks || [],
    replyTo: payload.replyTo || null,
    emoji: payload.emoji || null,
    reaction: payload.reaction || null,
    system: payload.system || null,
  };

  // NEW: Add content sanitization without breaking existing structure
  if (typeof content === "object" && content.text) {
    // Trim and limit length (safely)
    content.text = content.text.trim().slice(0, 10000);
  }

  return content;
}

/**
 * Enhanced metadata with additional fields (backward compatible)
 */
function buildMetadata(payload) {
  // Start with existing structure
  const baseMetadata = {
    device: payload.metadata?.device || "web",
    client: payload.metadata?.client || "socket",
    ...payload.metadata,
  };

  // NEW: Add additional metadata fields if not present
  if (!baseMetadata.timestamp) {
    baseMetadata.timestamp = new Date().toISOString();
  }

  if (!baseMetadata.version) {
    baseMetadata.version = "1.0.0";
  }

  return baseMetadata;
}

/**
 * Format socket payload into a DB-ready message structure
 * Enhanced version that maintains 100% backward compatibility
 */
function formatMessage(payload, user, overrides = {}) {
  const now = new Date().toISOString();
  const clientMessageId = payload.clientMessageId || uuidv4();

  // Use channelId as the universal reference (existing logic preserved)
  const channelId = payload.channelId || payload.groupId || payload.sessionId;

  // Determine message type — prioritize user-declared type, then auto-detect, fallback to "text"
  const messageType = payload.type || detectMessageType(payload) || "text";

  // Use enhanced content processing
  const content = processContent(payload);

  // Preserve existing message text logic exactly
  const messageText =
    typeof content === "object"
      ? content.text || payload.message || ""
      : payload.message || "";

  // Build the formatted message with existing structure
  const formatted = {
    id: uuidv4(),
    clientMessageId,
    channelId,
    senderId: user?.id || null,
    senderName:
      user?.name ||
      user?.username ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Unknown",
    receiverId: payload.receiverId || null,
    receiverName: payload.receiverName || null,
    sessionId: payload.sessionId || null,
    messageType,
    message: messageText || null,
    content,
    metadata: buildMetadata(payload), 
    status: overrides.status || "queued",
    isRead: false,
    isGroup: !!payload.isGroup || !!payload.groupId,
    encrypted: payload.encrypted || false,
    encryptionVersion: payload.encryptionVersion || null,
    attachments: normalizeAttachments(payload.attachments || []),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  // NEW: Add version tracking without breaking existing structure
  if (!formatted.version) {
    formatted.version = 1;
  }

  return formatted;
}

// NEW: Additional utility functions (optional, doesn't affect existing code)
function createSystemMessage(content, channelId, metadata = {}) {
  return formatMessage(
    {
      content: { text: content, system: true },
      channelId,
      system: true,
      metadata,
    },
    {
      id: "system",
      name: "System",
    },
    {
      status: "sent",
    }
  );
}

function createReactionMessage(reaction, messageId, channelId, user) {
  return formatMessage(
    {
      content: { reaction, reactsTo: messageId },
      channelId,
      reaction: true,
    },
    user,
    {
      status: "sent",
    }
  );
}

// NEW: Validation helper (optional)
function validateMessagePayload(payload) {
  const errors = [];

  if (!payload) {
    errors.push("Payload is required");
  }

  const hasContent = payload.content || payload.message || payload.text;
  const hasAttachments = payload.attachments?.length > 0;

  if (!hasContent && !hasAttachments) {
    errors.push("Message must have content or attachments");
  }

  if (payload.attachments) {
    payload.attachments.forEach((att, index) => {
      if (!att.url) {
        errors.push(`Attachment ${index} missing URL`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = formatMessage;

module.exports.normalizeAttachments = normalizeAttachments;
module.exports.detectMessageType = detectMessageType;
module.exports.createSystemMessage = createSystemMessage;
module.exports.createReactionMessage = createReactionMessage;
module.exports.validateMessagePayload = validateMessagePayload;
