const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const envConfig = require("../config/envConfig");
const User = require("../models/User");
const { isTokenBlacklisted } = require("../config/redisConfig");

// Middleware to authenticate user via JWT
exports.authenticateUser = async (req, res, next) => {
  let token = req.header("Authorization");

  if (!token || !token.startsWith("Bearer ")) {
    logger.warn("Unauthorized access attempt: No token provided");
    return res.status(401).json({
      status: false,
      message: "auth.no_token",
    });
  }

  try {
    token = token.split(" ")[1].trim();
    const decoded = jwt.verify(token, envConfig.JWT_SECRET);

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      logger.warn("Access denied: Token has been revoked (logged out)");
      return res.status(401).json({
        status: false,
        message: "auth.invalid_token",
      });
    }

    // Fetch user from DB to check if they are still active and verified
    console.log(`DEBUG: Middleware checking user ID: ${decoded.id}`);
    const user = await User.findById(decoded.id).select("+role");
    if (!user) {
      console.log("DEBUG: User not found in DB");
    } else if (!user.isEmailVerified) {
      console.log("DEBUG: User found but not verified");
    }

    if (!user || !user.isEmailVerified) {
      logger.warn(
        `Access denied: Unverified or non-existent user ${decoded.email}`
      );
      return res.status(403).json({
        status: false,
        message: "auth.verify_email",
      });
    }

    console.log(`DEBUG: Auth User found: ${user.email}, Role: ${user.role}`);

    req.user = user;
    req.token = token; // Store token for logout
    logger.info(`User authenticated: ${user.email}`);
    next();
  } catch (error) {
    logger.error(`JWT Verification Failed: ${error.message}`);

    // Invalid token returns 403 per test expectations
    return res.status(403).json({
      status: false,
      message: "auth.invalid_token",
    });
  }
};

// Middleware for Role-Based Access Control (RBAC)
exports.authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      logger.warn(
        `Access Denied: User ${req.user?.email || "Unknown"
        } attempted unauthorized access`
      );
      return res.status(403).json({
        status: false,
        message: "You don't have permission to access this resource",
      });
    }

    logger.info(
      `Access Granted: User ${req.user.email} accessed ${req.originalUrl}`
    );
    next();
  };
};

// Middleware to validate refresh token (for session management)
exports.validateRefreshToken = async (req, res, next) => {
  const refreshToken = req.body.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({
      STATUS_CODE: 401,
      STATUS: false,
      MESSAGE: "Unauthorized: No refresh token provided",
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, envConfig.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({
        STATUS_CODE: 403,
        STATUS: false,
        MESSAGE: "Forbidden: Invalid or expired refresh token",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      STATUS_CODE: 401,
      STATUS: false,
      MESSAGE: "Unauthorized: Invalid refresh token",
    });
  }
};

// Optional authentication middleware - populates req.user if valid token exists, otherwise proceeds as guest
exports.optionalAuthenticateUser = async (req, res, next) => {
  let token = req.header("Authorization");

  if (!token || !token.startsWith("Bearer ")) {
    // No token, proceed as guest
    return next();
  }

  try {
    token = token.split(" ")[1].trim();
    const decoded = jwt.verify(token, envConfig.JWT_SECRET);

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      // Token revoked - treat as guest
      return next();
    }

    const start = Date.now();
    const user = await User.findById(decoded.id).select("+role");

    if (user && user.isEmailVerified) {
      req.user = user;
      req.token = token;
      req.authenticatedUserId = user._id; // Fallback helper
    }

    next();
  } catch (error) {
    // Token validaton failed - proceed as guest
    next();
  }
};
