const mongoose = require("mongoose");

const shareRequestSchema = new mongoose.Schema(
    {
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BlogPost",
            required: true,
        },
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        collaboratorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        requestMessage: {
            type: String,
            maxlength: 500,
        },
        platforms: [{
            type: String,
            enum: ["facebook", "twitter", "instagram", "linkedin", "pinterest", "whatsapp", "telegram", "other"],
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
        reviewNotes: {
            type: String,
            maxlength: 500,
        },
        expiresAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

// Indexes
shareRequestSchema.index({ postId: 1, requestedBy: 1 }, { unique: true });
shareRequestSchema.index({ collaboratorId: 1, status: 1 });
shareRequestSchema.index({ requestedBy: 1, status: 1 });

module.exports = mongoose.model("ShareRequest", shareRequestSchema);
