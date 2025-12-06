const { createClient } = require("redis");
const winston = require("../utils/logger");

const isDevelopment = process.env.NODE_ENV !== "production";

// In-memory store for development
const inMemoryStore = new Map();

let redisClient = null;

// Initialize Redis client only in production
if (!isDevelopment) {
    redisClient = createClient({
        socket: {
            host: process.env.REDIS_HOST || "localhost",
            port: process.env.REDIS_PORT || 6379,
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: process.env.REDIS_DB || 0,
    });

    // Error handling
    redisClient.on("error", (err) => {
        winston.error(`Redis Client Error: ${err.message}`);
    });

    redisClient.on("connect", () => {
        winston.info("✅ Redis connected successfully (Production)");
    });

    // Connect to Redis
    (async () => {
        try {
            await redisClient.connect();
        } catch (error) {
            winston.error(`Failed to connect to Redis: ${error.message}`);
        }
    })();
} else {
    winston.info("✅ Using in-memory store for token blacklisting (Development)");
}

/**
 * Add token to blacklist
 * @param {string} token - JWT token
 * @param {number} expiresIn - Token expiration time in seconds
 */
const blacklistToken = async (token, expiresIn) => {
    try {
        if (isDevelopment) {
            // In-memory store for development
            const expiryTime = Date.now() + expiresIn * 1000;
            inMemoryStore.set(token, expiryTime);

            // Auto-cleanup expired tokens
            setTimeout(() => {
                inMemoryStore.delete(token);
            }, expiresIn * 1000);

            return true;
        } else {
            // Redis for production
            await redisClient.setEx(`blacklist:${token}`, expiresIn, "revoked");
            return true;
        }
    } catch (error) {
        winston.error(`Error blacklisting token: ${error.message}`);
        return false;
    }
};

/**
 * Check if token is blacklisted
 * @param {string} token - JWT token
 * @returns {Promise<boolean>}
 */
const isTokenBlacklisted = async (token) => {
    try {
        if (isDevelopment) {
            // In-memory store for development
            const expiryTime = inMemoryStore.get(token);
            if (!expiryTime) return false;

            // Check if expired
            if (Date.now() > expiryTime) {
                inMemoryStore.delete(token);
                return false;
            }

            return true;
        } else {
            // Redis for production
            const result = await redisClient.get(`blacklist:${token}`);
            return result !== null;
        }
    } catch (error) {
        winston.error(`Error checking token blacklist: ${error.message}`);
        return false;
    }
};

module.exports = {
    redisClient,
    blacklistToken,
    isTokenBlacklisted,
};
