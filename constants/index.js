/**
 * Application Constants
 * Centralized constants for roles, statuses, and other magic strings
 */

module.exports = {
    /**
     * User Roles
     */
    ROLES: {
        SUPER_ADMIN: "Super Admin",
        ADMIN: "Admin",
        EDITOR: "Editor",
        COLLABORATOR: "Collaborator",
        REGISTERED_USER: "Registered User",
        GUEST: "Guest",
    },

    /**
     * Blog Post Statuses
     */
    POST_STATUS: {
        DRAFT: "draft",
        IN_REVIEW: "in_review",
        APPROVED: "approved",
        PUBLISHED: "published",
        REJECTED: "rejected",
        PENDING_UPDATE: "pending_update",
    },

    /**
     * Request Statuses (Collaborator, Share, etc.)
     */
    REQUEST_STATUS: {
        PENDING: "pending",
        APPROVED: "approved",
        REJECTED: "rejected",
        PENDING_PROMOTION: "pending_promotion",
    },

    /**
     * Affiliate Partners
     */
    AFFILIATE_PARTNERS: {
        AMAZON: "Amazon",
        JUMIA: "Jumia",
        TEMU: "Temu",
        CLICKBANK: "ClickBank",
        OTHER: "Other",
    },

    /**
     * Social Media Platforms
     */
    SOCIAL_PLATFORMS: {
        FACEBOOK: "Facebook",
        TWITTER: "Twitter",
        LINKEDIN: "LinkedIn",
        INSTAGRAM: "Instagram",
        PINTEREST: "Pinterest",
        WHATSAPP: "WhatsApp",
        OTHER: "Other",
    },

    /**
     * Post Interaction Types
     */
    INTERACTION_TYPES: {
        VIEW: "view",
        LIKE: "like",
        COMMENT: "comment",
        RATING: "rating",
        SHARE: "share",
    },

    /**
     * Notification Types
     */
    NOTIFICATION_TYPES: {
        COLLABORATOR_REQUEST_APPROVED: "collaborator_request_approved",
        COLLABORATOR_REQUEST_REJECTED: "collaborator_request_rejected",
        SHARE_REQUEST_APPROVED: "share_request_approved",
        SHARE_REQUEST_REJECTED: "share_request_rejected",
        POST_APPROVED: "post_approved",
        POST_REJECTED: "post_rejected",
        PROMOTION_OFFER: "promotion_offer",
    },

    /**
     * Audit Actions
     */
    AUDIT_ACTIONS: {
        APPROVE_COLLABORATOR_REQUEST: "APPROVE_COLLABORATOR_REQUEST",
        REJECT_COLLABORATOR_REQUEST: "REJECT_COLLABORATOR_REQUEST",
        APPROVE_SHARE_REQUEST: "APPROVE_SHARE_REQUEST",
        REJECT_SHARE_REQUEST: "REJECT_SHARE_REQUEST",
        APPROVE_POST: "APPROVE_POST",
        REJECT_POST: "REJECT_POST",
        APPROVE_AFFILIATE_PRODUCT: "APPROVE_AFFILIATE_PRODUCT",
        REJECT_AFFILIATE_PRODUCT: "REJECT_AFFILIATE_PRODUCT",
        DELETE_AFFILIATE_PRODUCT: "DELETE_AFFILIATE_PRODUCT",
        PROMOTE_TO_EDITOR: "PROMOTE_TO_EDITOR",
        ASSIGN_CATEGORY: "ASSIGN_CATEGORY",
    },

    /**
     * Time Constants (in milliseconds)
     */
    TIME: {
        ONE_HOUR: 60 * 60 * 1000,
        SIX_HOURS: 6 * 60 * 60 * 1000,
        ONE_DAY: 24 * 60 * 60 * 1000,
        ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
    },

    /**
     * Pagination Defaults
     */
    PAGINATION: {
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100,
        DEFAULT_PAGE: 1,
    },
};
