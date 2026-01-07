const Joi = require("joi");
const mongoose = require("mongoose");

// Allowed roles in ShopInKeys
const allowedRoles = ["Admin", "Collaborator", "Editor", "Registered User"];

// Role assignment validation schema
const roleAssignmentSchema = Joi.object({
  userId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    }, "MongoDB ObjectId Validation")
    .required()
    .messages({
      "any.invalid": "Invalid user ID format",
      "string.empty": "User ID is required",
    }),

  role: Joi.string()
    .valid(...allowedRoles)
    .required()
    .messages({
      "any.only": `Role must be one of: ${allowedRoles.join(", ")}`,
      "string.empty": "Role is required",
    }),
});

// Reusable validation middleware
const validateRoleBody = (schema) => async (req, res, next) => {
  try {
    const validateOptions = {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    };

    const validatedBody = await schema.validateAsync(req.body, validateOptions);

    req.body = validatedBody;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((detail) => detail.message).join(", "),
    });
  }
};

module.exports = {
  validateRoleAssignment: validateRoleBody(roleAssignmentSchema),
};
