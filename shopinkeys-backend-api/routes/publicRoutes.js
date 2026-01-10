const express = require("express");
const publicController = require("../controllers/public.controller");
const router = express.Router();

/**
 * @route   GET /api/public/branding-platforms
 * @desc    Get branding platforms for homepage animation
 * @access  Public
 */
router.get(
    "/branding-platforms",
    publicController.getBrandingPlatforms
);

module.exports = router;
