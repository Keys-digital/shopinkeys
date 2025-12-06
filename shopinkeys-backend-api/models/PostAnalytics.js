const mongoose = require("mongoose");

const postAnalyticsSchema = new mongoose.Schema(
    {
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BlogPost",
            required: true,
            unique: true,
        },
        views: { type: Number, default: 0 },
        uniqueViews: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
        totalRatings: { type: Number, default: 0 },

        trafficSources: {
            social: { type: Number, default: 0 },
            search: { type: Number, default: 0 },
            direct: { type: Number, default: 0 },
            referral: { type: Number, default: 0 },
        },

        dailyViews: [{
            date: Date,
            views: Number,
        }],
    },
    { timestamps: true }
);

module.exports = mongoose.model("PostAnalytics", postAnalyticsSchema);
