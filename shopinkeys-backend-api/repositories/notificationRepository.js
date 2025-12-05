const Notification = require("../models/Notification");
const logger = require("../utils/logger");

/**
 * Create a new notification
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (data) => {
    try {
        const notification = new Notification(data);
        await notification.save();
        logger.info(`Notification created for user ${data.userId}: ${data.type}`);
        return notification;
    } catch (error) {
        logger.error(`Error creating notification: ${error.message}`);
        throw error;
    }
};

/**
 * Get notifications for a user with filters
 * @param {String} userId - User ID
 * @param {Object} filters - Filter options (read, type, limit, skip)
 * @returns {Promise<Array>} List of notifications
 */
const getUserNotifications = async (userId, filters = {}) => {
    try {
        const { read, type, limit = 20, skip = 0 } = filters;

        const query = { userId };
        if (read !== undefined) {
            query.read = read;
        }
        if (type) {
            query.type = type;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        return notifications;
    } catch (error) {
        logger.error(`Error fetching notifications: ${error.message}`);
        throw error;
    }
};

/**
 * Get total count of notifications for a user
 * @param {String} userId - User ID
 * @param {Object} filters - Filter options (read, type)
 * @returns {Promise<Number>} Total count
 */
const getNotificationCount = async (userId, filters = {}) => {
    try {
        const { read, type } = filters;

        const query = { userId };
        if (read !== undefined) {
            query.read = read;
        }
        if (type) {
            query.type = type;
        }

        const count = await Notification.countDocuments(query);
        return count;
    } catch (error) {
        logger.error(`Error counting notifications: ${error.message}`);
        throw error;
    }
};

/**
 * Mark a notification as read
 * @param {String} notificationId - Notification ID
 * @param {String} userId - User ID (for authorization)
 * @returns {Promise<Object>} Updated notification
 */
const markAsRead = async (notificationId, userId) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            throw new Error("Notification not found or unauthorized");
        }

        logger.info(`Notification ${notificationId} marked as read by user ${userId}`);
        return notification;
    } catch (error) {
        logger.error(`Error marking notification as read: ${error.message}`);
        throw error;
    }
};

/**
 * Mark all notifications as read for a user
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Update result
 */
const markAllAsRead = async (userId) => {
    try {
        const result = await Notification.updateMany(
            { userId, read: false },
            { read: true }
        );

        logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
        return result;
    } catch (error) {
        logger.error(`Error marking all notifications as read: ${error.message}`);
        throw error;
    }
};

/**
 * Delete a notification
 * @param {String} notificationId - Notification ID
 * @param {String} userId - User ID (for authorization)
 * @returns {Promise<Object>} Deleted notification
 */
const deleteNotification = async (notificationId, userId) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            userId,
        });

        if (!notification) {
            throw new Error("Notification not found or unauthorized");
        }

        logger.info(`Notification ${notificationId} deleted by user ${userId}`);
        return notification;
    } catch (error) {
        logger.error(`Error deleting notification: ${error.message}`);
        throw error;
    }
};

/**
 * Delete all read notifications for a user
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Delete result
 */
const deleteAllRead = async (userId) => {
    try {
        const result = await Notification.deleteMany({
            userId,
            read: true,
        });

        logger.info(`Deleted ${result.deletedCount} read notifications for user ${userId}`);
        return result;
    } catch (error) {
        logger.error(`Error deleting read notifications: ${error.message}`);
        throw error;
    }
};

module.exports = {
    createNotification,
    getUserNotifications,
    getNotificationCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
};
