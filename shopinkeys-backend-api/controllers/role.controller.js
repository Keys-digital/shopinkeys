// controllers/role.controller.js
const userRepository = require("../repositories/userRepository");
const logger = require("../utils/logger");
const StatusCodes = require("../utils/statusCodes");
const User = require("../models/User");

const ALLOWED_ROLES = ["Admin", "Collaborator", "Editor", "Registered User"];

/**
 * Assign a role to a registered user
 * - Only an Admin may call this (checked by middleware)
 */
exports.assignRoleToUser = async (req, res) => {
  try {
    const actor = req.user;

    const { userId, roleName } = req.body;
    logger.info(
      `Admin ${actor.id} assigning role '${roleName}' to user ID: ${userId}`
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

    // Prevent removing Admin from the last Admin account
    const currentRole = user.role || user.userroleId;
    if (currentRole === "Admin" && roleName !== "Admin") {
      const adminCount = await User.countDocuments({ role: "Admin" });
      if (adminCount <= 1) {
        logger.warn(
          `Attempt to demote the last Admin (userId: ${userId}) blocked`
        );
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: false,
          message: "Cannot remove Admin role from the last Admin account",
        });
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

    logger.info(
      `Role: ${roleName} assigned to user ID: ${userId} by Admin ${actor.id}`
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
