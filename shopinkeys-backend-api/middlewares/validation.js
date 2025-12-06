const Joi = require("joi");

/**
 * Validation schema for affiliate product submission
 */
exports.affiliateProductSchema = Joi.object({
    title: Joi.string().trim().max(200).required().messages({
        "string.empty": "Title is required",
        "string.max": "Title must not exceed 200 characters",
    }),
    description: Joi.string().trim().max(1000).allow("").optional(),
    image: Joi.string().uri().trim().optional().messages({
        "string.uri": "Image must be a valid URL",
    }),
    affiliateUrl: Joi.string()
        .uri()
        .pattern(/^https?:\/\//)
        .required()
        .messages({
            "string.empty": "Affiliate URL is required",
            "string.uri": "Affiliate URL must be a valid URL",
            "string.pattern.base": "Affiliate URL must start with http:// or https://",
        }),
    price: Joi.number().min(0).optional().messages({
        "number.min": "Price must be a positive number",
    }),
    niche: Joi.string().trim().optional(),
    partner: Joi.string()
        .valid("Amazon", "Jumia", "Temu", "ClickBank", "Other")
        .optional()
        .default("Other"),
});

/**
 * Validation schema for share request submission
 */
exports.shareRequestSchema = Joi.object({
    postId: Joi.string().hex().length(24).required().messages({
        "string.empty": "Post ID is required",
        "string.hex": "Post ID must be a valid MongoDB ObjectId",
        "string.length": "Post ID must be 24 characters",
    }),
    requestMessage: Joi.string().trim().max(500).optional(),
    platforms: Joi.array()
        .items(
            Joi.string().valid(
                "Facebook",
                "Twitter",
                "LinkedIn",
                "Instagram",
                "Pinterest",
                "WhatsApp",
                "Other"
            )
        )
        .min(1)
        .required()
        .messages({
            "array.min": "At least one platform is required",
            "any.required": "Platforms are required",
        }),
});

/**
 * Validation schema for collaborator application
 */
exports.collaboratorRequestSchema = Joi.object({
    requestMessage: Joi.string().trim().min(50).max(1000).required().messages({
        "string.empty": "Request message is required",
        "string.min": "Request message must be at least 50 characters",
        "string.max": "Request message must not exceed 1000 characters",
    }),
    niche: Joi.string().trim().required().messages({
        "string.empty": "Niche is required",
    }),
    socialLinks: Joi.object({
        facebook: Joi.string().uri().optional(),
        twitter: Joi.string().uri().optional(),
        instagram: Joi.string().uri().optional(),
        linkedin: Joi.string().uri().optional(),
        youtube: Joi.string().uri().optional(),
        website: Joi.string().uri().optional(),
    }).optional(),
    affiliateDetails: Joi.object({
        amazonAffiliateId: Joi.string().optional(),
        temuAffiliateId: Joi.string().optional(),
        jumiaAffiliateId: Joi.string().optional(),
        clickbankId: Joi.string().optional(),
    }).optional(),
    sampleContent: Joi.string().uri().optional(),
    documents: Joi.array().items(Joi.string().uri()).optional(),
});

/**
 * Validation schema for blog post creation/update
 */
exports.blogPostSchema = Joi.object({
    title: Joi.string().trim().min(10).max(200).required().messages({
        "string.empty": "Title is required",
        "string.min": "Title must be at least 10 characters",
        "string.max": "Title must not exceed 200 characters",
    }),
    content: Joi.string().trim().min(100).required().messages({
        "string.empty": "Content is required",
        "string.min": "Content must be at least 100 characters",
    }),
    excerpt: Joi.string().trim().max(300).optional(),
    featuredImage: Joi.string().uri().optional(),
    media: Joi.array()
        .items(
            Joi.object({
                type: Joi.string().valid("image", "video").required(),
                url: Joi.string().uri().required(),
                caption: Joi.string().optional(),
            })
        )
        .optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    category: Joi.string().trim().optional(),
    status: Joi.string()
        .valid("draft", "in_review", "approved", "published", "rejected")
        .optional()
        .default("draft"),
    keywords: Joi.string().trim().optional(),
    canonicalUrl: Joi.string().uri().optional(),
    metaDescription: Joi.string().trim().max(160).optional(),
});

/**
 * Validation middleware factory
 */
exports.validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Return all errors
            stripUnknown: true, // Remove unknown fields
        });

        if (error) {
            const errors = error.details.map((detail) => ({
                field: detail.path.join("."),
                message: detail.message,
            }));

            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Validation failed",
                ERRORS: errors,
            });
        }

        // Replace req.body with validated and sanitized value
        req.body = value;
        next();
    };
};
