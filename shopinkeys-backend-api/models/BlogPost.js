const mongoose = require("mongoose");
const { POST_STATUS } = require("../constants");

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
            enum: Object.values(POST_STATUS),
            default: POST_STATUS.DRAFT,
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
        metaTitle: {
            type: String,
            maxlength: 60,
            trim: true,
        },
        metaDescription: {
            type: String,
            maxlength: 155,
            trim: true,
        },
        keywords: [{
            type: String,
            trim: true,
        }],
        canonicalUrl: {
            type: String,
            trim: true,
        },
        readingTime: {
            type: Number,  // in minutes
            min: 1,
            default: 1,
        },
        isCommentsEnabled: {
            type: Boolean,
            default: true,
        },
        isFeatured: {
            type: Boolean,
            default: false,
            index: true,
        },
        isTrending: {
            type: Boolean,
            default: false,
            index: true,
        },
        ctas: [{
            type: {
                type: String, // e.g., "button", "link", "banner"
                default: "button",
            },
            text: {
                type: String,
                trim: true,
            },
            url: {
                type: String,
                trim: true,
            },
            placement: {
                type: String, // e.g., "top", "bottom", "inline"
                default: "bottom",
            },
            style: {
                type: String, // e.g., "primary", "secondary"
            },
            affiliateLink: { // Actual tracked link if different from url
                type: String,
                trim: true,
            }
        }],
    },
    { timestamps: true }
);

// Index for searching and filtering
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ authorId: 1 });

// Pre-save hook: Auto-calculate reading time
blogPostSchema.pre('save', function (next) {
    if (this.isModified('content')) {
        const text = this.content || "";
        const words = text.trim()
            ? text.trim().split(/\s+/).length
            : 0;

        // Calculate reading time (200 words per minute), minimum 1 minute
        this.readingTime = Math.max(1, Math.ceil(words / 200));
    }
    next();
});

module.exports = mongoose.model("BlogPost", blogPostSchema);

