// controllers/role.controller.js
const userRepository = require("../repositories/userRepository");
const auditLogRepository = require("../repositories/auditLogRepository");
const logger = require("../utils/logger");
const StatusCodes = require("../utils/statusCodes");
const User = require("../models/User");

const ALLOWED_ROLES = ["Super Admin", "Admin", "Collaborator", "Editor", "Registered User", "Guest"];

/**
 * Helper function to get client IP address
 */
const getClientIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown"
  );
};

/**
 * Assign a role to a registered user
 * - Only an Admin or Super Admin may call this (checked by middleware)
 */
exports.assignRoleToUser = async (req, res) => {
  try {
    const actor = req.user;
    const actorRole = actor.role;

    const { userId, roleName } = req.body;
    logger.info(
      `${actorRole} ${actor.id} assigning role '${roleName}' to user ID: ${userId}`
    );

    if (!userId || !roleName) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Missing required fields: userId and roleName",
      });
    }

    if (!ALLOWED_ROLES.includes(roleName)) {
      logger.warn(`Invalid role requested: ${roleName}`);
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "Invalid role",
      });
    }

    // Validate target user exists
    const user = await userRepository.findUser({ id: userId });
    if (!user) {
      logger.warn(`User not found with ID: ${userId}`);
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: "User not found",
      });
    }

    // Super Admin Logic
    if (actorRole === "Super Admin") {
      // Super Admin can do anything, proceed to assignment
    } else if (actorRole === "Admin") {
      // Admin Restrictions

      // 1. Cannot assign Super Admin or Admin role
      if (roleName === "Super Admin" || roleName === "Admin") {
        logger.warn(`Admin ${actor.id} attempted to assign restricted role: ${roleName}`);
        return res.status(StatusCodes.FORBIDDEN).json({
          status: false,
          message: "Admins cannot assign Super Admin or Admin roles",
        });
      }

      // 2. Cannot modify a Super Admin
      if (user.role === "Super Admin") {
        logger.warn(`Admin ${actor.id} attempted to modify a Super Admin`);
        return res.status(StatusCodes.FORBIDDEN).json({
          status: false,
          message: "Admins cannot modify Super Admin accounts",
        });
      }
    } else {
      // Should be caught by middleware, but double check
      return res.status(StatusCodes.FORBIDDEN).json({
        status: false,
        message: "Access Denied",
      });
    }

    // Prevent removing Admin from the last Admin account (Applies to everyone to prevent lockout, though Super Admin can fix it)
    // Actually, let's keep this safety check but maybe relax it for Super Admin if there is another Super Admin? 
    // For now, let's keep the logic simple: Don't let the last Admin be demoted unless by a Super Admin?
    // The requirement says "Super Admin... Can promote/demote Admins."
    // So if Super Admin is doing it, we should probably allow it, assuming the Super Admin exists.
    // But if it's an Admin demoting themselves (if allowed) or another Admin, we need to be careful.
    // Let's stick to the existing safety check for now, but maybe refine it.
    // If target user is Admin and new role is NOT Admin...
    const currentRole = user.role || user.userroleId;
    if (currentRole === "Admin" && roleName !== "Admin") {
      const adminCount = await User.countDocuments({ role: "Admin" });
      // If there is only 1 Admin, and we are demoting them...
      if (adminCount <= 1) {
        // If actor is Super Admin, they can demote the last Admin because Super Admin is higher authority.
        if (actorRole !== "Super Admin") {
          logger.warn(
            `Attempt to demote the last Admin (userId: ${userId}) blocked`
          );
          return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Cannot remove Admin role from the last Admin account",
          });
        }
      }
    }

    // Assign role
    try {
      user.userroleId = roleName;
      user.role = roleName;
      await user.save();
    } catch (saveErr) {
      logger.error(
        `Failed to save role for user ${userId}: ${saveErr.message}`
      );
      return res.status(StatusCodes.SERVER_ERROR).json({
        status: false,
        message: "Failed to assign role",
      });
    }

    // Create audit log entry
    try {
      const auditLogData = {
        actor: {
          userId: actor.id,
          role: actorRole,
          email: actor.email || "unknown",
        },
        action: currentRole ? "ROLE_CHANGED" : "ROLE_ASSIGNED",
        targetUser: {
          userId: user._id,
          email: user.email,
        },
        changes: {
          previousRole: currentRole,
          newRole: roleName,
        },
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || "unknown",
      };

      await auditLogRepository.createAuditLog(auditLogData);
      logger.info(
        `Audit log created: ${actorRole} ${actor.id} changed role of user ${userId} from ${currentRole} to ${roleName}`
      );
    } catch (auditErr) {
      // Log error but don't fail the request
      logger.error(
        `Failed to create audit log for role assignment: ${auditErr.message}`
      );
    }

    logger.info(
      `Role: ${roleName} assigned to user ID: ${userId} by ${actorRole} ${actor.id}`
    );
    return res.status(StatusCodes.OK).json({
      status: true,
      message: `Role '${roleName}' assigned successfully`,
      data: { userId: user._id, role: roleName },
    });
  } catch (error) {
    logger.error(
      `Error assigning role to user ID: ${req.body.userId}: ${error.message}`
    );
    return res.status(StatusCodes.SERVER_ERROR).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
