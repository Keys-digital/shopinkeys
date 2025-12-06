const mongoose = require("mongoose");

const blogPostSchema = new mongoose.Schema(
    {
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        content: {
            type: String,
            required: true, // Rich text / Markdown
        },
        excerpt: {
            type: String,
            maxlength: 300,
        },
        featuredImage: {
            type: String, // S3 URL
        },
        media: [{
            type: {
                type: String,
                enum: ["image", "video", "infographic"],
            },
            url: String,
            caption: String,
        }],
        status: {
            type: String,
            enum: ["draft", "in_review", "approved", "rejected", "published"],
            default: "draft",
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        editorFeedback: {
            type: String,
        },
        publishedAt: {
            type: Date,
        },
        tags: [{
            type: String,
            trim: true,
        }],
        category: {
            type: String,
        },
        metaDescription: {
            type: String,
        },
        keywords: [{
            type: String,
            trim: true,
        }],
        canonicalUrl: {
            type: String,
            trim: true,
        },
        isCommentsEnabled: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Index for searching and filtering
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ authorId: 1 });

module.exports = mongoose.model("BlogPost", blogPostSchema);
