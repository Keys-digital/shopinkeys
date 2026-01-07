const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for public API endpoints
 * Prevents abuse on blog posts, affiliate products, etc.
 */
exports.publicApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        STATUS_CODE: 429,
        STATUS: false,
        MESSAGE: "Too many requests from this IP, please try again later.",
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

/**
 * Stricter rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
exports.authApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        STATUS_CODE: 429,
        STATUS: false,
        MESSAGE: "Too many authentication attempts, please try again later.",
    },
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for click tracking
 * Prevents spam clicks on affiliate products
 */
exports.clickTrackingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 clicks per hour
    message: {
        STATUS_CODE: 429,
        STATUS: false,
        MESSAGE: "Too many clicks, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for content creation
 * Prevents spam submissions
 */
exports.contentCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 submissions per hour
    message: {
        STATUS_CODE: 429,
        STATUS: false,
        MESSAGE: "Too many submissions, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
