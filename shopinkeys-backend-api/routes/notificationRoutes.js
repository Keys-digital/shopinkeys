const express = require("express");
const router = express.Router();
const {
    getMyNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteAllReadNotifications,
} = require("../controllers/notification.controller");
const { authenticate } = require("../middlewares/authMiddleware");

// All notification routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for authenticated user
 * @access  Private (Authenticated User)
 * @query   read (boolean), type (string), limit (number), skip (number), page (number)
 */
router.get("/", getMyNotifications);

/**
 * @route   GET /api/notifications/unread/count
 * @desc    Get unread notification count
 * @access  Private (Authenticated User)
 */
router.get("/unread/count", getUnreadCount);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (Authenticated User)
 */
router.patch("/read-all", markAllNotificationsAsRead);

/**
 * @route   DELETE /api/notifications/read-all
 * @desc    Delete all read notifications
 * @access  Private (Authenticated User)
 */
router.delete("/read-all", deleteAllReadNotifications);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private (Authenticated User - owner only)
 */
router.patch("/:id/read", markNotificationAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private (Authenticated User - owner only)
 */
router.delete("/:id", deleteNotification);

module.exports = router;
