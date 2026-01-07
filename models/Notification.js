const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                "collaborator_request_rejected",
                "collaborator_request_approved",
                "share_request_rejected",
                "share_request_approved",
                "post_approved",
                "post_rejected",
                "promotion_initiated",
                "promotion_accepted",
                "promotion_declined",
            ],
            required: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        message: {
            type: String,
            required: true,
            maxlength: 1000,
        },
        metadata: {
            requestId: {
                type: mongoose.Schema.Types.ObjectId,
                required: false,
            },
            postId: {
                type: mongoose.Schema.Types.ObjectId,
                required: false,
            },
            reviewNotes: {
                type: String,
                required: false,
            },
            postTitle: {
                type: String,
                required: false,
            },
        },
        read: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    { timestamps: true }
);

// Compound index for efficient querying
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
