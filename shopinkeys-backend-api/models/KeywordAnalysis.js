const mongoose = require("mongoose");

/**
 * Keyword Analysis Schema
 * Stores KGR (Keyword Golden Ratio) analysis results for SEO optimization
 */
const keywordAnalysisSchema = new mongoose.Schema(
    {
        keyword: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true, // Index for efficient lookups
        },
        allintitle: {
            type: Number,
            required: true,
            description: "Number of Google results with keyword in title",
        },
        searchVolume: {
            type: Number,
            required: true,
            description: "Estimated monthly search volume",
        },
        kgr: {
            type: Number,
            required: true,
            description: "Keyword Golden Ratio (allintitle / searchVolume)",
        },
        difficulty: {
            type: String,
            enum: ["Easy", "Moderate", "Hard"],
            required: true,
        },
        recommendation: {
            type: String,
            description: "SEO recommendation for this keyword",
        },
        niche: {
            type: String,
            description: "Content niche/category",
        },
        analyzedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            description: "User who requested the analysis",
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
            description: "Last time this keyword was analyzed",
            index: true, // Index for efficient date-based queries
        },
    },
    { timestamps: true }
);

// Indexes for efficient querying
keywordAnalysisSchema.index({ keyword: 1 }, { unique: true });
keywordAnalysisSchema.index({ kgr: 1 }); // For sorting by difficulty
keywordAnalysisSchema.index({ niche: 1 });
keywordAnalysisSchema.index({ difficulty: 1 });

// Static method to find or create keyword analysis
keywordAnalysisSchema.statics.findOrAnalyze = async function (keyword) {
    const { analyzeKeyword } = require("../utils/seo");

    // Check if we have recent analysis (within 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let analysis = await this.findOne({
        keyword: keyword.toLowerCase(),
        lastUpdated: { $gte: sevenDaysAgo },
    });

    if (analysis) {
        return analysis;
    }

    // Perform new analysis
    const result = await analyzeKeyword(keyword);
    if (!result) {
        return null;
    }

    // Save or update
    analysis = await this.findOneAndUpdate(
        { keyword: keyword.toLowerCase() },
        { ...result, lastUpdated: new Date() },
        { upsert: true, new: true }
    );

    return analysis;
};

module.exports = mongoose.model("KeywordAnalysis", keywordAnalysisSchema);
