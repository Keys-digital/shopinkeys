const User = require("../models/User");
const { uploadToS3, deleteFromS3 } = require("./s3Service");

/**
 * Get user profile by ID
 */
const getUserProfile = async (userId) => {
    try {
        const user = await User.findById(userId).select("-password -passwordResetToken -passwordResetExpires -googleId -facebookId");

        if (!user) {
            return { success: false, message: "auth.user_not_found", statusCode: 404 };
        }

        return { success: true, data: user, statusCode: 200 };
    } catch (error) {
        console.error("Get Profile Error:", error);
        return { success: false, message: "errors.internal_server", statusCode: 500 };
    }
};

/**
 * Update user profile (name, bio, socialLinks)
 */
const updateProfile = async (userId, updates) => {
    try {
        const { name, bio, socialLinks } = updates;

        const updateData = {};
        if (name) updateData.name = name;
        if (bio !== undefined) updateData["profile.bio"] = bio;
        if (socialLinks) updateData["profile.socialLinks"] = socialLinks;

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select("-password -passwordResetToken -passwordResetExpires -googleId -facebookId");

        if (!user) {
            return { success: false, message: "auth.user_not_found", statusCode: 404 };
        }

        return { success: true, data: user, message: "profile.update_success", statusCode: 200 };
    } catch (error) {
        console.error("Update Profile Error:", error);
        return { success: false, message: "errors.internal_server", statusCode: 500 };
    }
};

/**
 * Upload avatar to S3 and update user profile
 */
const uploadAvatar = async (userId, file) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, message: "auth.user_not_found", statusCode: 404 };
        }

        // Upload new avatar to S3
        const avatarUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype);

        // Delete old avatar from S3 (if not default)
        if (user.profile?.avatar && !user.profile.avatar.includes("default-avatar")) {
            await deleteFromS3(user.profile.avatar);
        }

        // Update user profile with new avatar URL
        user.profile = user.profile || {};
        user.profile.avatar = avatarUrl;
        await user.save();

        return { success: true, data: { avatar: avatarUrl }, message: "profile.avatar_upload_success", statusCode: 200 };
    } catch (error) {
        console.error("Upload Avatar Error:", error);
        return { success: false, message: "errors.internal_server", statusCode: 500 };
    }
};

module.exports = {
    getUserProfile,
    updateProfile,
    uploadAvatar,
};
