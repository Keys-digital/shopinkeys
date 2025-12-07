const mongoose = require("mongoose");

const affiliateProductSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 1000,
        },
        image: {
            type: String, // Product image URL
            trim: true,
            validate: {
                validator: function (v) {
                    return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v);
                },
                message: props => `${props.value} is not a valid URL!`
            }
        },
        affiliateUrl: {
            type: String,
            required: true,
            trim: true,
            validate: {
                validator: function (v) {
                    return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v);
                },
                message: props => `${props.value} is not a valid URL!`
            }
        },
        price: {
            type: Number,
            min: 0,
        },
        niche: {
            type: String,
            trim: true,
            index: true, // For filtering by niche
        },
        partner: {
            type: String,
            enum: ["Amazon", "Jumia", "Temu", "ClickBank", "Other"],
            default: "Other",
            index: true, // For filtering by partner
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // For finding products by collaborator
        },
        approved: {
            type: Boolean,
            default: false,
            index: true, // For filtering approved products
        },
        rejected: {
            type: Boolean,
            default: false,
            index: true, // For filtering rejected products
        },
        rejectedAt: {
            type: Date,
        },
        deleted: {
            type: Boolean,
            default: false,
            index: true, // For filtering deleted products
        },
        deletedAt: {
            type: Date,
        },
        clicks: {
            type: Number,
            default: 0,
            min: 0,
        },
        clicksDetail: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                ipAddress: {
                    type: String,
                },
                userAgent: {
                    type: String,
                },
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        reviewNotes: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

// Index for public product listing (approved products only)
affiliateProductSchema.index({ approved: 1, createdAt: -1 });

// Index for collaborator's products
affiliateProductSchema.index({ addedBy: 1, createdAt: -1 });

// Index for filtering by niche and partner
affiliateProductSchema.index({ niche: 1, partner: 1, approved: 1 });

module.exports = mongoose.model("AffiliateProduct", affiliateProductSchema);
