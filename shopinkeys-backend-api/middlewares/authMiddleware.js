const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const envConfig = require("../config/envConfig");
const User = require("../models/User");

// Middleware to authenticate user via JWT
exports.authenticateUser = async (req, res, next) => {
  let token = req.header("Authorization");

  if (!token || !token.startsWith("Bearer ")) {
    logger.warn("Unauthorized access attempt: No token provided");
    return res.status(401).json({
      STATUS_CODE: 401,
      STATUS: false,
      MESSAGE: "Unauthorized: No token provided",
    });
  }

  try {
    token = token.split(" ")[1].trim();
    const decoded = jwt.verify(token, envConfig.JWT_SECRET);

    // Fetch user from DB to check if they are still active and verified
const user = await User.findById(decoded.id);
if (!user || !user.isEmailVerified) {
  logger.warn(
    `Access denied: Unverified or non-existent user ${decoded.email}`
  );
  return res.status(403).json({
    STATUS_CODE: 403,
    STATUS: false,
    MESSAGE:
      "Forbidden: Please verify your email before accessing this resource.",
  });
}


    req.user = user;
    logger.info(`User authenticated: ${user.email}`);
    next();
  } catch (error) {
    logger.error(`JWT Verification Failed: ${error.message}`);

    const errorMessage =
      error.name === "TokenExpiredError"
        ? "Unauthorized: Token has expired"
        : "Unauthorized: Invalid token";

    return res.status(401).json({
      STATUS_CODE: 401,
      STATUS: false,
      MESSAGE: errorMessage,
    });
  }
};

// Middleware for Role-Based Access Control (RBAC)
exports.authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      logger.warn(
        `Access Denied: User ${
          req.user?.email || "Unknown"
        } attempted unauthorized access`
      );
      return res.status(403).json({
        STATUS_CODE: 403,
        STATUS: false,
        MESSAGE: "Forbidden: Insufficient permissions",
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
