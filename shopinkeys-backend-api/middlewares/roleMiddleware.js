// middleware/roleMiddleware.js
const i18next = require("../config/i18nConfig");
const logger = require("../utils/logger");
const Role = require("../models/Role");
const User = require("../models/User");
const roleRepository = require("../repositories/roleRepository");
const userRepository = require("../repositories/userRepository");
const StatusCodes = require("../utils/statusCodes");

/**
 * Require Admin middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      status: false,
      message: "Authentication required",
    });
  }
  const role = req.user.role || req.user.userroleId;
  if (role !== "Admin") {
    return res.status(StatusCodes.FORBIDDEN).json({
      status: false,
      message: "Admin role required",
    });
  }
  next();
};

/**
 * Require specific roles middleware
 */
const requireRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return next();
    if (!req.user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: false,
        message: "Authentication required",
      });
    }
    const role = req.user.role || req.user.userroleId;
    if (!allowedRoles.includes(role)) {
      logger.warn(`Access denied for user ${req.user.id}, role: ${role}`);
      return res.status(StatusCodes.FORBIDDEN).json({
        status: false,
        message: "You don't have permission to access this resource",
      });
    }
    next();
  };
};

/**
 * Check role permissions (backwards-compatible)
 */
const checkRolePermission = async (req, res, next) => {
  try {
    const allowedRoles = req.allowedRoles || [];
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      return next();
    }

    if (!req.user) {
      logger.warn("Unauthenticated access to restricted resource");
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: false,
        message: "Authentication required",
      });
    }

    const user = await userRepository.findUser({ id: req.user.id });
    if (!user) {
      logger.warn(`User not found during permission check: ${req.user.id}`);
      return res.status(StatusCodes.FORBIDDEN).json({
        status: false,
        message: "User not found or invalid role",
      });
    }

    const roleName = user.role || user.userroleId;
    const role = await roleRepository.findRole({ name: roleName });
    if (!role || !role.name) {
      logger.warn(`Role not found for user ID: ${req.user.id}`);
      return res.status(StatusCodes.FORBIDDEN).json({
        status: false,
        message: "Role not found or invalid role",
      });
    }

    if (!allowedRoles.includes(role.name)) {
      logger.warn(
        `Access denied for user ID: ${req.user.id}, role: ${role.name}`
      );
      return res.status(StatusCodes.FORBIDDEN).json({
        status: false,
        message: "You don't have permission to access this resource",
      });
    }

    logger.info(`User ID: ${req.user.id} has valid role: ${role.name}`);
    next();
  } catch (error) {
    logger.error(
      `Error checking role permission for user ID: ${req.user?.id}: ${error.message}`
    );
    return res.status(StatusCodes.SERVER_ERROR).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

/**
 * i18n-friendly role middleware (case-insensitive check)
 */
const roleMiddleware = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const lang =
        req.language || req.headers["accept-language"]?.split(",")[0] || "en";
      const username = user?.username || "Unknown User";
      const userEmail = user?.email || "No Email Provided";

      if (!user?.email) {
        logger.warn(`Access Denied: No user found in request.`);
        return res
          .status(403)
          .json({ message: i18next.t("errors.forbidden", { lng: lang }) });
      }

      const dbUser = await User.findOne({ email: userEmail }).populate("role");
      if (!dbUser || !dbUser.role) {
        logger.warn(`Access Denied: User ${userEmail} has no assigned role.`);
        return res
          .status(403)
          .json({ message: i18next.t("errors.forbidden", { lng: lang }) });
      }

      const userRole = dbUser.role.name.toLowerCase();

      const validRoles = await Role.find({}, "name");
      const roleNames = validRoles.map((r) => r.name.toLowerCase());

      if (!roleNames.includes(userRole)) {
        logger.warn(
          `Access Denied: User ${username} (${userEmail}) has an invalid role: ${userRole}`
        );
        return res
          .status(403)
          .json({ message: i18next.t("errors.forbidden", { lng: lang }) });
      }

      const formattedAllowedRoles = allowedRoles.map((r) =>
        r.trim().toLowerCase()
      );

      if (!formattedAllowedRoles.includes(userRole)) {
        logger.warn(
          `Access Denied: User ${username} (${userEmail}) with role '${userRole}' attempted unauthorized access.`
        );
        return res
          .status(403)
          .json({ message: i18next.t("errors.forbidden", { lng: lang }) });
      }

      logger.info(
        `Access Granted: User ${username} (${userEmail}) with role '${userRole}' accessed ${req.originalUrl}`
      );
      next();
    } catch (error) {
      logger.error(`Role Middleware Error: ${error.message}`);
      return res.status(500).json({
        message: i18next.t("errors.server_error", { lng: req.language }),
      });
    }
  };
};

module.exports = {
  requireAdmin,
  requireRoles,
  checkRolePermission,
  roleMiddleware,
};
