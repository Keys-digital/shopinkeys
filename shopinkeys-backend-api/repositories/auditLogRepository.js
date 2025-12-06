const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");

/**
 * Create a new audit log entry
 */
exports.createAuditLog = async (data) => {
    try {
        const auditLog = new AuditLog(data);
        return await auditLog.save();
    } catch (error) {
        logger.error(`Error creating audit log: ${error.message}`);
        throw error;
    }
};

/**
 * Find audit logs with filters and pagination
 */
exports.findAuditLogs = async (filter = {}, options = {}) => {
    try {
        const {
            limit = 50,
            skip = 0,
            sort = { createdAt: -1 },
        } = options;

        return await AuditLog.find(filter)
            .sort(sort)
            .limit(limit)
            .skip(skip)
            .populate("actor.userId", "name email username")
            .populate("targetUser.userId", "name email username")
            .lean();
    } catch (error) {
        logger.error(`Error finding audit logs: ${error.message}`);
        throw error;
    }
};

/**
 * Find audit logs for a specific user (as actor or target)
 */
exports.findAuditLogsByUser = async (userId, options = {}) => {
    try {
        const filter = {
            $or: [
                { "actor.userId": userId },
                { "targetUser.userId": userId },
            ],
        };

        return await exports.findAuditLogs(filter, options);
    } catch (error) {
        logger.error(`Error finding audit logs by user: ${error.message}`);
        throw error;
    }
};

/**
 * Get audit log statistics
 */
exports.getAuditLogStats = async (filter = {}) => {
    try {
        const stats = await AuditLog.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$action",
                    count: { $sum: 1 },
                },
            },
        ]);

        return stats;
    } catch (error) {
        logger.error(`Error getting audit log stats: ${error.message}`);
        throw error;
    }
};

/**
 * Log an audit event
 * Simplified wrapper for createAuditLog with common use case
 */
exports.logAudit = async ({ userId, action, targetUserId, details, ipAddress, userAgent }) => {
    try {
        const auditData = {
            actor: {
                userId: userId,
            },
            action: action,
            details: details || "",
            metadata: {
                ipAddress: ipAddress || "unknown",
                userAgent: userAgent || "unknown",
            },
        };

        // Add targetUser if provided
        if (targetUserId) {
            auditData.targetUser = {
                userId: targetUserId,
            };
        }

        return await exports.createAuditLog(auditData);
    } catch (error) {
        // Log but don't throw - audit logging shouldn't break main functionality
        logger.error(`Error logging audit: ${error.message}`);
        return null;
    }
};
