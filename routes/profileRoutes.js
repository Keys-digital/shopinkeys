const express = require("express");
const profileController = require("../controllers/profile.controller");
const { authenticateUser } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

// All profile routes require authentication
router.use(authenticateUser);

/**
 * Get current user profile
 */
router.get("/", profileController.getProfile);

/**
 * Update user profile (name, bio, socialLinks)
 */
router.patch("/", profileController.updateProfile);

/**
 * Upload avatar
 */
router.post("/avatar", upload.single("avatar"), profileController.uploadAvatar);

module.exports = router;
