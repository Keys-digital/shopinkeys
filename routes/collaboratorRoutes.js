const express = require("express");
const { authenticateUser } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware");
const collaboratorController = require("../controllers/collaborator.controller");

const router = express.Router();

/**
 * @route   POST /api/collaborator/request
 * @desc    Submit a request to become a collaborator
 * @access  Registered User
 */
router.post(
    "/request",
    authenticateUser,
    collaboratorController.submitRequest
);

/**
 * @route   GET /api/collaborator/requests
 * @desc    Get all collaborator requests
 * @access  Admin, Super Admin
 */
router.get(
    "/requests",
    authenticateUser,
    roleMiddleware(["Admin", "Super Admin"]),
    collaboratorController.getAllRequests
);

/**
 * @route   PUT /api/collaborator/requests/:id/approve
 * @desc    Approve a collaborator request
 * @access  Admin, Super Admin
 */
router.put(
    "/requests/:id/approve",
    authenticateUser,
    roleMiddleware(["Admin", "Super Admin"]),
    collaboratorController.approveRequest
);

/**
 * @route   PUT /api/collaborator/requests/:id/reject
 * @desc    Reject a collaborator request
 * @access  Admin, Super Admin
 */
router.put(
    "/requests/:id/reject",
    authenticateUser,
    roleMiddleware(["Admin", "Super Admin"]),
    collaboratorController.rejectRequest
);

/**
 * @route   GET /api/collaborator/profile
 * @desc    Get current collaborator's profile
 * @access  Collaborator
 */
router.get(
    "/profile",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    collaboratorController.getProfile
);

/**
 * @route   PUT /api/collaborator/profile
 * @desc    Update current collaborator's profile
 * @access  Collaborator
 */
router.put(
    "/profile",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    collaboratorController.updateProfile
);

/**
 * @route   GET /api/collaborator/analytics
 * @desc    Get collaborator analytics
 * @access  Collaborator
 */
router.get(
    "/analytics",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    collaboratorController.getAnalytics
);

/**
 * @route   GET /api/collaborator/public/:username
 * @desc    Get public collaborator profile
 * @access  Public
 */
router.get(
    "/public/:username",
    collaboratorController.getPublicProfile
);

/**
 * @route   PUT /api/collaborator/:id/promote
 * @desc    Promote collaborator to Editor
 * @access  Admin, Super Admin
 */
router.put(
    "/:id/promote",
    authenticateUser,
    roleMiddleware(["Admin", "Super Admin"]),
    collaboratorController.promoteToEditor
);

/**
 * @route   PUT /api/collaborator/:id/assign-category
 * @desc    Assign category to Collaborator
 * @access  Editor, Admin, Super Admin
 */
router.put(
    "/:id/assign-category",
    authenticateUser,
    roleMiddleware(["Editor", "Admin", "Super Admin"]),
    collaboratorController.assignCategory
);

/**
 * @route   PUT /api/collaborator/promotion/accept
 * @desc    Accept promotion to Editor
 * @access  Collaborator, Editor
 */
router.put(
    "/promotion/accept",
    authenticateUser,
    roleMiddleware(["Collaborator", "Editor"]),
    collaboratorController.acceptPromotion
);

/**
 * @route   PUT /api/collaborator/promotion/decline
 * @desc    Decline promotion to Editor
 * @access  Collaborator
 */
router.put(
    "/promotion/decline",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    collaboratorController.declinePromotion
);

/**
 * @route   GET /api/collaborator/promotion/check-auto
 * @desc    Check and process auto-promotions (for cron jobs)
 * @access  Admin, Super Admin
 */
router.get(
    "/promotion/check-auto",
    authenticateUser,
    roleMiddleware(["Admin", "Super Admin"]),
    collaboratorController.checkAutoPromotions
);

module.exports = router;
