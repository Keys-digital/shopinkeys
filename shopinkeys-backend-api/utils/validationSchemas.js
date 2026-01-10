const Joi = require("joi");
const { ROLES, POST_STATUS, AFFILIATE_PARTNERS, SOCIAL_PLATFORMS } = require("../constants");

// Affiliate Product Schemas
exports.submitProductSchema = Joi.object({
    title: Joi.string().trim().min(10).max(200).required().messages({
        "string.empty": "validation.affiliate.title_required",
        "any.required": "validation.affiliate.title_required",
        "string.min": "validation.affiliate.title_min",
        "string.max": "validation.affiliate.title_max"
    }),
    description: Joi.string().trim().max(1000).allow(""),
    image: Joi.string().uri().allow(""),
    affiliateUrl: Joi.string().uri().required().messages({
        "string.empty": "validation.affiliate.url_required",
        "any.required": "validation.affiliate.url_required",
        "string.uri": "validation.affiliate.url_valid"
    }),
    price: Joi.number().min(0).allow(null).messages({
        "number.min": "validation.affiliate.price_positive"
    }),
    niche: Joi.alternatives().try(
        Joi.array().items(Joi.string().trim()),
        Joi.string().trim()
    ).allow(null, ""), // Allow array or single string
    partner: Joi.string()
        .valid(...Object.values(AFFILIATE_PARTNERS))
        .default(AFFILIATE_PARTNERS.OTHER),
    relatedPostId: Joi.string().hex().length(24).allow("").optional(), // MongoDB ObjectId
});

exports.updateProductSchema = Joi.object({
    title: Joi.string().trim().min(10).max(200),
    description: Joi.string().trim().max(1000).allow(""),
    image: Joi.string().uri(),
    affiliateUrl: Joi.string().uri(),
    price: Joi.number().min(0),
    niche: Joi.alternatives().try(
        Joi.array().items(Joi.string().trim()),
        Joi.string().trim()
    ),
    partner: Joi.string().valid(...Object.values(AFFILIATE_PARTNERS)),
    relatedPostId: Joi.string().hex().length(24).allow("").optional(),
}).min(1);

// Blog Post Schemas
exports.createPostSchema = Joi.object({
    title: Joi.string().trim().min(10).max(200).required().messages({
        "string.empty": "validation.blog.title_required",
        "any.required": "validation.blog.title_required",
        "string.min": "validation.blog.title_min",
        "string.max": "validation.blog.title_max"
    }),
    content: Joi.string().min(100).required().messages({
        "string.empty": "validation.blog.content_required",
        "any.required": "validation.blog.content_required",
        "string.min": "validation.blog.content_min"
    }),
    excerpt: Joi.string().trim().max(300).allow(""),
    featuredImage: Joi.string().uri().allow(""),
    media: Joi.array().items(
        Joi.object({
            type: Joi.string().valid("image", "video", "infographic").required(),
            url: Joi.string().uri().required(),
            caption: Joi.string().allow(""),
        })
    ),
    tags: Joi.alternatives().try(
        Joi.array().items(Joi.string().trim()),
        Joi.string().trim() // Handle single string tag input
    ),
    category: Joi.string().trim().allow(""),
    status: Joi.string()
        .valid(POST_STATUS.DRAFT, POST_STATUS.IN_REVIEW) // Only allow initial states
        .default(POST_STATUS.DRAFT),
    keywords: Joi.array().items(Joi.string().trim()),
    canonicalUrl: Joi.string().uri().allow(""),
    metaTitle: Joi.string()
        .trim()
        .max(60)
        .optional()
        .allow("")
        .messages({
            'string.max': 'validation.blog.meta_title_max'
        }),
    metaDescription: Joi.string()
        .max(155)
        .optional()
        .allow("")
        .messages({
            'string.max': 'validation.blog.meta_description_max'
        }),
    type: Joi.string().valid("seo", "news", "tutorial"), // For auto-approve check
    mainKeyword: Joi.string().allow(""),
    ctas: Joi.array().items(
        Joi.object({
            type: Joi.string().valid("button", "link", "banner"),
            text: Joi.string().required(),
            url: Joi.string().uri().required(),
            placement: Joi.string(),
            style: Joi.string(),
            affiliateLink: Joi.string().uri()
        })
    ),

});

exports.updatePostSchema = Joi.object({
    title: Joi.string().trim().min(10).max(200).messages({
        "string.empty": "validation.blog.title_required",
        "any.required": "validation.blog.title_required",
        "string.min": "validation.blog.title_min",
        "string.max": "validation.blog.title_max"
    }),
    content: Joi.string().min(100).messages({
        "string.empty": "validation.blog.content_required",
        "any.required": "validation.blog.content_required",
        "string.min": "validation.blog.content_min"
    }),
    excerpt: Joi.string().trim().max(300).messages({
        "string.max": "validation.blog.excerpt_max"
    }),
    featuredImage: Joi.string().uri().messages({
        "string.uri": "validation.blog.featured_image_valid"
    }),
    media: Joi.array().items(
        Joi.object({
            type: Joi.string().valid("image", "video", "infographic").messages({
                "any.only": "validation.blog.media_type_invalid"
            }),
            url: Joi.string().uri().messages({
                "string.uri": "validation.blog.media_url_valid"
            }),
            caption: Joi.string(),
        })
    ),
    ctas: Joi.array().items(
        Joi.object({
            type: Joi.string().valid("button", "link", "banner"),
            text: Joi.string(),
            url: Joi.string().uri(),
            placement: Joi.string(),
            style: Joi.string(),
            affiliateLink: Joi.string().uri()
        })
    ),
    tags: Joi.alternatives().try(Joi.array().items(Joi.string().trim()), Joi.string().trim()).messages({
        "array.base": "validation.blog.tags_invalid",
        "string.base": "validation.blog.tags_invalid"
    }),
    category: Joi.string().trim().messages({
        "string.base": "validation.blog.category_invalid"
    }),
    status: Joi.string().valid(
        POST_STATUS.DRAFT,
        POST_STATUS.IN_REVIEW,
        POST_STATUS.PUBLISHED // Collaborator might re-publish if allowed
    ).messages({
        "string.base": "validation.blog.status_invalid"
    }),
    keywords: Joi.array().items(Joi.string().trim()).messages({
        "array.base": "validation.blog.keywords_invalid"
    }),
    canonicalUrl: Joi.string().uri().messages({
        "string.uri": "validation.blog.canonical_url_valid"
    }),
    metaTitle: Joi.string()
        .trim()
        .max(60)
        .optional()
        .messages({
            'string.max': 'validation.blog.meta_title_max'
        }),
    metaDescription: Joi.string()
        .max(155)
        .optional()
        .messages({
            'string.max': 'validation.blog.meta_description_max'
        }),
    type: Joi.string().valid("seo", "news", "tutorial").messages({
        "string.base": "validation.blog.type_invalid"
    }),
    mainKeyword: Joi.string().messages({
        "string.base": "validation.blog.main_keyword_invalid"
    }),
}).min(1);

// Share Request Schema
exports.submitShareRequestSchema = Joi.object({
    postId: Joi.string()
        .required()
        .messages({
            "string.empty": "validation.share.post_id_required",
            "any.required": "validation.share.post_id_required",
        }),

    platforms: Joi.array()
        .items(
            Joi.string()
                .valid(...Object.values(SOCIAL_PLATFORMS))
                .messages({
                    "any.only": "validation.share.platform_invalid",
                })
        )
        .min(1)
        .required()
        .messages({
            "array.min": "validation.share.platforms_required",
            "any.required": "validation.share.platforms_required",
            "array.base": "validation.share.platforms_invalid",
        }),

    customMessage: Joi.string()
        .max(500)
        .allow("")
        .messages({
            "string.max": "validation.share.custom_message_max",
        }),
});
