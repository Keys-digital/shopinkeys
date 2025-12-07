const express = require("express");
const { authenticateUser, optionalAuthenticateUser } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware");
const affiliateProductController = require("../controllers/affiliateProduct.controller");
const { clickTrackingLimiter, contentCreationLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

/**
 * @route   GET /api/affiliate-products
 * @desc    Get all approved affiliate products (with pagination and filters)
 * @access  Public
 */
router.get(
    "/",
    affiliateProductController.getAllProducts
);

/**
 * @route   GET /api/affiliate-products/my-products
 * @desc    Get current collaborator's submitted products
 * @access  Collaborator
 */
router.get(
    "/my-products",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    affiliateProductController.getMyProducts
);

/**
 * @route   GET /api/affiliate-products/:id
 * @desc    Get single affiliate product by ID
 * @access  Public
 */
router.get(
    "/:id",
    affiliateProductController.getProductById
);

/**
 * @route   POST /api/affiliate-products/:id/click
 * @desc    Track affiliate link click
 * @access  Public
 * @rateLimit 50 clicks per hour per IP
 */
router.post(
    "/:id/click",
    optionalAuthenticateUser,
    clickTrackingLimiter,
    affiliateProductController.trackClick
);

/**
 * @route   POST /api/affiliate-products
 * @desc    Submit new affiliate product
 * @access  Collaborator
 * @rateLimit 10 submissions per hour per IP
 */
router.post(
    "/",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    contentCreationLimiter,
    affiliateProductController.submitProduct
);

/**
 * @route   PUT /api/affiliate-products/:id/approve
 * @desc    Approve affiliate product
 * @access  Admin, Editor, Super Admin
 */
router.put(
    "/:id/approve",
    authenticateUser,
    roleMiddleware(["Admin", "Editor", "Super Admin"]),
    affiliateProductController.approveProduct
);

/**
 * @route   PUT /api/affiliate-products/:id/reject
 * @desc    Reject affiliate product
 * @access  Admin, Editor, Super Admin
 */
router.put(
    "/:id/reject",
    authenticateUser,
    roleMiddleware(["Admin", "Editor", "Super Admin"]),
    affiliateProductController.rejectProduct
);

/**
 * @route   PUT /api/affiliate-products/:id
 * @desc    Update affiliate product
 * @access  Admin, Editor, Super Admin
 */
router.put(
    "/:id",
    authenticateUser,
    roleMiddleware(["Admin", "Editor", "Super Admin"]),
    affiliateProductController.updateProduct
);

/**
 * @route   DELETE /api/affiliate-products/:id
 * @desc    Delete affiliate product
 * @access  Admin, Super Admin
 */
router.delete(
    "/:id",
    authenticateUser,
    roleMiddleware(["Admin", "Super Admin"]),
    affiliateProductController.deleteProduct
);

module.exports = router;
