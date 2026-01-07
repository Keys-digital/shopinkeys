const profileService = require("../services/profileService");
const logger = require("../utils/logger");
const i18next = require("../config/i18nConfig");

// Helper to safely resolve language
const getLang = (req) =>
    req?.language || req?.headers?.["accept-language"]?.split(",")[0] || "en";

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
    const lang = getLang(req);
    try {
        const result = await profileService.getUserProfile(req.user.id);

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: i18next.t(result.message, { lng: lang }),
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        logger.error(`Error fetching profile: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: i18next.t("errors.internal_server", { lng: lang }),
        });
    }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
    const lang = getLang(req);
    try {
        const { name, bio, socialLinks } = req.body;

        const result = await profileService.updateProfile(req.user.id, { name, bio, socialLinks });

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: i18next.t(result.message, { lng: lang }),
            });
        }

        return res.status(200).json({
            success: true,
            message: i18next.t(result.message, { lng: lang }),
            data: result.data,
        });
    } catch (error) {
        logger.error(`Error updating profile: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: i18next.t("errors.internal_server", { lng: lang }),
        });
    }
};

/**
 * Upload avatar
 */
exports.uploadAvatar = async (req, res) => {
    const lang = getLang(req);
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: i18next.t("errors.no_file_uploaded", { lng: lang }),
            });
        }

        const result = await profileService.uploadAvatar(req.user.id, req.file);

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: i18next.t(result.message, { lng: lang }),
            });
        }

        return res.status(200).json({
            success: true,
            message: i18next.t(result.message, { lng: lang }),
            data: result.data,
        });
    } catch (error) {
        logger.error(`Error uploading avatar: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: i18next.t("errors.internal_server", { lng: lang }),
        });
    }
};
