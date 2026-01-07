const {
    getUserNotifications,
    getNotificationCount,
    markAsRead,
    markAllAsRead,
    deleteNotification: deleteNotificationRepo,
    deleteAllRead,
} = require("../repositories/notificationRepository");
const logger = require("../utils/logger");

/**
 * Get all notifications for the authenticated user
 * GET /api/notifications
 * Access: Authenticated User
 */
exports.getMyNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const { read, type, limit, skip, page } = req.query;

        // Calculate skip from page if provided
        const parsedLimit = parseInt(limit) || 20;
        const parsedSkip = page ? (parseInt(page) - 1) * parsedLimit : parseInt(skip) || 0;

        const filters = {
            read: read !== undefined ? read === "true" : undefined,
            type,
            limit: parsedLimit,
            skip: parsedSkip,
        };

        const notifications = await getUserNotifications(userId, filters);
        const totalCount = await getNotificationCount(userId, {
            read: filters.read,
            type: filters.type,
        });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Notifications retrieved successfully.",
            DATA: {
                notifications,
                pagination: {
                    total: totalCount,
                    limit: parsedLimit,
                    skip: parsedSkip,
                    page: page ? parseInt(page) : Math.floor(parsedSkip / parsedLimit) + 1,
                    totalPages: Math.ceil(totalCount / parsedLimit),
                },
            },
        });
    } catch (error) {
        logger.error(`Error fetching notifications: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread/count
 * Access: Authenticated User
 */
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = await getNotificationCount(userId, { read: false });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            DATA: {
                unreadCount: count,
            },
        });
    } catch (error) {
        logger.error(`Error fetching unread count: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 * Access: Authenticated User (owner only)
 */
exports.markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const notification = await markAsRead(id, userId);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Notification marked as read.",
            DATA: notification,
        });
    } catch (error) {
        if (error.message.includes("not found") || error.message.includes("unauthorized")) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Notification not found.",
            });
        }

        logger.error(`Error marking notification as read: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 * Access: Authenticated User
 */
exports.markAllNotificationsAsRead = async (req, res) => {
    try {
        const userId = req.user._id;
        const result = await markAllAsRead(userId);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: `${result.modifiedCount} notifications marked as read.`,
            DATA: {
                modifiedCount: result.modifiedCount,
            },
        });
    } catch (error) {
        logger.error(`Error marking all notifications as read: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 * Access: Authenticated User (owner only)
 */
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        await deleteNotificationRepo(id, userId);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Notification deleted successfully.",
        });
    } catch (error) {
        if (error.message.includes("not found") || error.message.includes("unauthorized")) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Notification not found.",
            });
        }

        logger.error(`Error deleting notification: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Delete all read notifications
 * DELETE /api/notifications/read-all
 * Access: Authenticated User
 */
exports.deleteAllReadNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const result = await deleteAllRead(userId);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: `${result.deletedCount} read notifications deleted.`,
            DATA: {
                deletedCount: result.deletedCount,
            },
        });
    } catch (error) {
        logger.error(`Error deleting read notifications: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

module.exports = {
    getMyNotifications: exports.getMyNotifications,
    getUnreadCount: exports.getUnreadCount,
    markNotificationAsRead: exports.markNotificationAsRead,
    markAllNotificationsAsRead: exports.markAllNotificationsAsRead,
    deleteNotification: exports.deleteNotification,
    deleteAllReadNotifications: exports.deleteAllReadNotifications,
};
