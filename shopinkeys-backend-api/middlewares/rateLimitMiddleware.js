const { rateLimit, MemoryStore } = require("express-rate-limit");

const resetStore = new MemoryStore();

function createLimiter(options) {
    if (process.env.NODE_ENV === "test") {
        // noop middleware for tests
        return (req, res, next) => next();
    }
    return rateLimit(options);
}

/**
 * Rate limiter for login attempts
 * Prevents brute force attacks
 */
const loginLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        status: false,
        message: "Too many login attempts. Please try again after 15 minutes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});

/**
 * Rate limiter for password reset requests
 * Prevents abuse of password reset functionality
 */
const passwordResetLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: {
        status: false,
        message: "Too many password reset requests. Please try again after 1 hour.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});

// Custom test-only helper
passwordResetLimiter.resetKey = function (key) {
    resetStore.resetKey(key);
};

/**
 * General API rate limiter
 * Prevents API abuse
 */
const apiLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        status: false,
        message: "Too many requests. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});

module.exports = {
    createLimiter,
    loginLimiter,
    passwordResetLimiter,
    apiLimiter,
};
