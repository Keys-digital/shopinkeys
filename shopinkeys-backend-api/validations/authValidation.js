const Joi = require("joi");

// Allowed roles in ShopInKeys
const allowedRoles = ["Admin", "Collaborator", "Editor", "Registered User"];

// Registration validation schema (self-registration)
const registerSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 3 characters",
    "string.max": "Name must be at most 50 characters",
  }),
  username: Joi.string()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9_-]+$/) 
    .required()
    .messages({
      "string.empty": "Username is required",
      "string.min": "Username must be at least 3 characters",
      "string.max": "Username must be at most 30 characters",
      "string.pattern.base":
        "Username can only contain letters, numbers, underscores, or hyphens",
    }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
  password: Joi.string()
    .min(8)
    .max(32)
    .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 8 characters",
      "string.max": "Password must be at most 32 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one number, and one special character",
    }),
});


// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
  password: Joi.string().min(8).max(32).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 8 characters",
    "string.max": "Password must be at most 32 characters",
  }),
});

// Refresh Token validation schema (for session management)
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "string.empty": "Refresh token is required",
  }),
});

// Forgot Password validation schema
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
});

// Reset Password validation schema
const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    "string.empty": "Reset token is required",
  }),
  newPassword: Joi.string()
    .min(8)
    .max(32)
    .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .required()
    .messages({
      "string.empty": "New password is required",
      "string.min": "Password must be at least 8 characters",
      "string.max": "Password must be at most 32 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one number, and one special character",
    }),
});

// Reusable validation middleware
const validateReqBody = (schema) => async (req, res, next) => {
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
  validateRegister: validateReqBody(registerSchema),
  validateLogin: validateReqBody(loginSchema),
  validateRefreshToken: validateReqBody(refreshTokenSchema),
  validateForgotPassword: validateReqBody(forgotPasswordSchema),
  validateResetPassword: validateReqBody(resetPasswordSchema),
};
