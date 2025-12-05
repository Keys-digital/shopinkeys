const mongoose = require("mongoose");

const collaboratorProfileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
        },
        bio: {
            type: String,
            maxlength: 500,
        },
        niche: {
            type: String,
        },
        affiliateCategory: {
            type: String,
        },
        avatar: {
            type: String, // S3 URL
        },
        banner: {
            type: String, // S3 URL
        },
        theme: {
            type: String,
            enum: ["default", "minimal", "modern", "creative"],
            default: "default",
        },
        socialLinks: {
            facebook: String,
            instagram: String,
            tiktok: String,
            twitter: String,
            pinterest: String,
            youtube: String,
            linkedin: String,
            tumblr: String,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CollaboratorProfile", collaboratorProfileSchema);
