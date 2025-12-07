const mongoose = require("mongoose");

const postInteractionSchema = new mongoose.Schema(
    {
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BlogPost",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            // Required for likes, ratings, comments. Optional for anonymous views/clicks
        },
        type: {
            type: String,
            enum: ["view", "like", "rating", "share", "click", "comment"],
            required: true,
        },
        // For Rating
        ratingValue: {
            type: Number,
            min: 1,
            max: 5,
        },
        // For Comment
        content: {
            type: String,
            maxlength: 1000,
        },
        parentInteractionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PostInteraction", // For comment replies
        },
        isApproved: {
            type: Boolean,
            default: true, // Change to false if moderation is required by default
        },

        // Metadata
        ipAddress: String,
        userAgent: String,
        country: String,
        device: String,
        referrer: String,
        refSource: {
            type: String, // e.g., "facebook", "twitter", "direct", "search"
        },
    },
    { timestamps: true }
);

// Indexes
postInteractionSchema.index({ postId: 1, type: 1 });
postInteractionSchema.index({ postId: 1, userId: 1, type: 1 }); // To prevent duplicate likes/ratings
postInteractionSchema.index({ userId: 1 });
postInteractionSchema.index({ parentInteractionId: 1 }); // For fetching replies
postInteractionSchema.index({ postId: 1, ipAddress: 1, createdAt: -1 }); // For view deduplication

module.exports = mongoose.model("PostInteraction", postInteractionSchema);
