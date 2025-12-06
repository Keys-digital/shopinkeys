const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        actor: {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: false, // Allow system actions
            },
            role: {
                type: String,
                required: false,
            },
            email: {
                type: String,
                required: false,
            },
        },
        action: {
            type: String,
            enum: [
                // Role management
                "ROLE_ASSIGNED",
                "ROLE_CHANGED",
                "ROLE_REVOKED",
                // Post management
                "AUTO_APPROVE_POST",
                "APPROVE_POST",
                "REJECT_POST",
                // Collaborator management
                "APPROVE_COLLABORATOR_REQUEST",
                "REJECT_COLLABORATOR_REQUEST",
                // Editor promotion
                "INITIATE_PROMOTION",
                "ACCEPT_PROMOTION",
                "DECLINE_PROMOTION",
                "AUTO_PROMOTE_EDITOR",
                // Category assignment
                "ASSIGN_CATEGORY",
                // Share request management
                "APPROVE_SHARE_REQUEST",
                "REJECT_SHARE_REQUEST",
            ],
            required: true,
        },
        targetUser: {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: false,
            },
            email: {
                type: String,
                required: false,
            },
        },
        changes: {
            previousRole: {
                type: String,
                required: false,
            },
            newRole: {
                type: String,
                required: false,
            },
        },
        details: {
            type: String,
            default: "",
        },
        metadata: {
            ipAddress: {
                type: String,
                default: "unknown",
            },
            userAgent: {
                type: String,
                default: "unknown",
            },
        },
        // Legacy fields for backwards compatibility
        ipAddress: {
            type: String,
            default: "unknown",
        },
        userAgent: {
            type: String,
            default: "unknown",
        },
    },
    { timestamps: true }
);

// Index for efficient querying
auditLogSchema.index({ "actor.userId": 1, createdAt: -1 });
auditLogSchema.index({ "targetUser.userId": 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
