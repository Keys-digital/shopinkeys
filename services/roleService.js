const userRepository = require("../repositories/userRepository");
const roleRepository = require("../repositories/roleRepository");
const StatusCodes = require("../utils/statusCodes");

exports.checkRolePermission = async (userId, allowedRoles) => {
  // Validate user existence
  const user = await userRepository.findOne({ _id: userId });

  if (!user) {
    return {
      STATUS_CODE: StatusCodes.BAD_REQUEST,
      STATUS: false,
      MESSAGE: "User not found",
    };
  }

  // Allow Guest users to access public features
  if (user.role === "Guest") {
    return {
      STATUS_CODE: StatusCodes.OK,
      STATUS: true,
      MESSAGE: "Guest user access granted",
    };
  }

  // Validate assigned role
  const role = await roleRepository.findRole({ name: user.role });

  if (!role || !allowedRoles.includes(role.name)) {
    return {
      STATUS_CODE: StatusCodes.FORBIDDEN,
      STATUS: false,
      MESSAGE: "You don't have permission to access this resource",
    };
  }

  return {
    STATUS_CODE: StatusCodes.OK,
    STATUS: true,
    DATA: role,
  };
};
