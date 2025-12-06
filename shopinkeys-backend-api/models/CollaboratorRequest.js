const mongoose = require("mongoose");

const collaboratorRequestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // One active request per user
        },
        requestMessage: {
            type: String,
            required: true,
            maxlength: 2000,
        },
        niche: {
            type: String,
            required: true,
            enum: ["tech", "beauty", "finance", "lifestyle", "fashion", "health", "other"],
        },
        affiliateDetails: {
            amazonAffiliateId: String,
            temuAffiliateId: String,
            jumiaAffiliateId: String,
            kongaAffiliateId: String,
            other: String,
        },
        sampleContent: {
            type: String,
        },
        socialMediaLinks: {
            facebook: String,
            instagram: String,
            tiktok: String,
            twitter: String,
            pinterest: String,
            youtube: String,
            linkedin: String,
            tumblr: String,
        },
        documents: [{
            type: String, // S3 URLs
        }],
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        reviewNotes: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model("CollaboratorRequest", collaboratorRequestSchema);
