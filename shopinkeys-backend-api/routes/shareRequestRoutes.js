const express = require("express");
const { authenticateUser } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware");
const shareRequestController = require("../controllers/shareRequest.controller");

const router = express.Router();

/**
 * @route   POST /api/share-requests
 * @desc    Submit a share request
 * @access  Registered User
 */
router.post(
    "/",
    authenticateUser,
    shareRequestController.submitShareRequest
);

/**
 * @route   GET /api/share-requests/my-requests
 * @desc    Get share requests for collaborator's posts
 * @access  Collaborator, Admin
 */
router.get(
    "/my-requests",
    authenticateUser,
    roleMiddleware(["Collaborator", "Editor", "Admin", "Super Admin"]),
    shareRequestController.getMyShareRequests
);

/**
 * @route   GET /api/share-requests/my-submissions
 * @desc    Get user's own share request submissions
 * @access  Registered User
 */
router.get(
    "/my-submissions",
    authenticateUser,
    shareRequestController.getMySubmissions
);

/**
 * @route   GET /api/share-requests/all
 * @desc    Get all share requests (Admin analytics/audit only)
 * @access  Admin, Super Admin (VIEW ONLY)
 */
router.get(
    "/all",
    authenticateUser,
    roleMiddleware(["Admin", "Super Admin"]),
    shareRequestController.getAllShareRequests
);

/**
 * @route   PUT /api/share-requests/:id/approve
 * @desc    Approve a share request
 * @access  Collaborator (post owner ONLY)
 */
router.put(
    "/:id/approve",
    authenticateUser,
    roleMiddleware(["Collaborator", "Editor"]),
    shareRequestController.approveShareRequest
);

/**
 * @route   PUT /api/share-requests/:id/reject
 * @desc    Reject a share request
 * @access  Collaborator (post owner ONLY)
 */
router.put(
    "/:id/reject",
    authenticateUser,
    roleMiddleware(["Collaborator", "Editor"]),
    shareRequestController.rejectShareRequest
);

module.exports = router;
