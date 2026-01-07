const Joi = require("joi");
const i18n = require("../config/i18nConfig");

/**
 * Validation schema for affiliate product submission
 */
exports.affiliateProductSchema = Joi.object({
    title: Joi.string().trim().max(200).required().messages({
        "string.empty": "validation.affiliate.title_required",
        "any.required": "validation.affiliate.title_required",
        "string.max": "validation.affiliate.title_max",
    }),
    description: Joi.string().trim().max(1000).allow("").optional(),
    image: Joi.string().uri().trim().optional().messages({
        "string.uri": "validation.affiliate.image_url",
    }),
    affiliateUrl: Joi.string()
        .uri()
        .pattern(/^https?:\/\//)
        .required()
        .messages({
            "string.empty": "validation.affiliate.url_required",
            "any.required": "validation.affiliate.url_required",
            "string.uri": "validation.affiliate.url_valid",
            "string.pattern.base": "validation.affiliate.url_protocol",
        }),
    price: Joi.number().min(0).optional().messages({
        "number.min": "validation.affiliate.price_positive",
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
        "string.empty": "validation.share.post_id_required",
        "any.required": "validation.share.post_id_required",
        "string.hex": "validation.share.post_id_invalid",
        "string.length": "validation.share.post_id_length",
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
            "array.min": "validation.share.platforms_min",
            "any.required": "validation.share.platforms_required",
        }),
});

/**
 * Validation schema for collaborator application
 */
exports.collaboratorRequestSchema = Joi.object({
    requestMessage: Joi.string().trim().min(50).max(1000).required().messages({
        "string.empty": "validation.collaborator.message_required",
        "any.required": "validation.collaborator.message_required",
        "string.min": "validation.collaborator.message_min",
        "string.max": "validation.collaborator.message_max",
    }),
    niche: Joi.string().trim().required().messages({
        "string.empty": "validation.collaborator.niche_required",
        "any.required": "validation.collaborator.niche_required",
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
        "string.empty": "validation.blog.title_required",
        "any.required": "validation.blog.title_required",
        "string.min": "validation.blog.title_min",
        "string.max": "validation.blog.title_max",
    }),
    content: Joi.string()
        .custom((value, helpers) => {
            if (!value || value.trim().length < 100) {
                return helpers.error("string.min");
            }
            return value;
        })
        .required()
        .messages({
            "string.min": "validation.blog.content_min",
            "string.empty": "validation.blog.content_required",
            "any.required": "validation.blog.content_required",
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
            errors: {
                wrap: { label: false },
            },
        });

        if (error) {
            const errors = error.details.map((detail) => {
                // If a custom message is defined in the schema (e.g., via .messages()), Joi puts it in detail.message
                // We trust that our schema defines i18n keys in .messages()
                const messageKey = detail.message;

                return {
                    field: detail.path.join("."),
                    // Translate if it's a key, otherwise fallback to the raw message (though all should be keys now)
                    message: i18n.exists(messageKey) ? i18n.t(messageKey) : messageKey,
                };
            });

            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: i18n.t("validation.failed"),
                ERRORS: errors,
            });
        }

        // Replace req.body with validated and sanitized value
        req.body = value;
        next();
    };
};
