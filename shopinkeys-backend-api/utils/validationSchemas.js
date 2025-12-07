const Joi = require("joi");
const { ROLES, POST_STATUS, AFFILIATE_PARTNERS, SOCIAL_PLATFORMS } = require("../constants");

// Affiliate Product Schemas
exports.submitProductSchema = Joi.object({
    title: Joi.string().trim().max(200).required(),
    description: Joi.string().trim().max(1000).allow(""),
    image: Joi.string().uri().allow(""),
    affiliateUrl: Joi.string().uri().required(),
    price: Joi.number().min(0).allow(null),
    niche: Joi.string().trim().allow(""),
    partner: Joi.string()
        .valid(...Object.values(AFFILIATE_PARTNERS))
        .default(AFFILIATE_PARTNERS.OTHER),
});

exports.updateProductSchema = Joi.object({
    title: Joi.string().trim().max(200),
    description: Joi.string().trim().max(1000),
    image: Joi.string().uri(),
    affiliateUrl: Joi.string().uri(),
    price: Joi.number().min(0),
    niche: Joi.string().trim(),
    partner: Joi.string().valid(...Object.values(AFFILIATE_PARTNERS)),
}).min(1);

// Blog Post Schemas
exports.createPostSchema = Joi.object({
    title: Joi.string().trim().max(200).required(),
    content: Joi.string().required(),
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
    metaDescription: Joi.string().allow(""),
    type: Joi.string().valid("seo", "news", "tutorial"), // For auto-approve check
    mainKeyword: Joi.string().allow(""),
});

exports.updatePostSchema = Joi.object({
    title: Joi.string().trim().max(200),
    content: Joi.string(),
    excerpt: Joi.string().trim().max(300),
    featuredImage: Joi.string().uri(),
    media: Joi.array().items(
        Joi.object({
            type: Joi.string().valid("image", "video", "infographic"),
            url: Joi.string().uri(),
            caption: Joi.string(),
        })
    ),
    tags: Joi.alternatives().try(Joi.array().items(Joi.string().trim()), Joi.string().trim()),
    category: Joi.string().trim(),
    status: Joi.string().valid(
        POST_STATUS.DRAFT,
        POST_STATUS.IN_REVIEW,
        POST_STATUS.PUBLISHED // Collaborator might re-publish if allowed
    ),
    keywords: Joi.array().items(Joi.string().trim()),
    canonicalUrl: Joi.string().uri(),
    metaDescription: Joi.string(),
    type: Joi.string().valid("seo", "news", "tutorial"),
    mainKeyword: Joi.string(),
}).min(1);

// Share Request Schema
exports.submitShareRequestSchema = Joi.object({
    postId: Joi.string().required(), // ObjectId validation could be added with Joi extension
    platforms: Joi.array()
        .items(Joi.string().valid(...Object.values(SOCIAL_PLATFORMS)))
        .min(1)
        .required(),
    customMessage: Joi.string().max(500).allow(""),
});
