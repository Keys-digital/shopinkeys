const express = require("express");
const authHandlers = require("../controllers/auth.controller");
const authValidation = require("../validations/authValidation");
const { authenticateUser, authorizeRoles } = require("../middlewares/authMiddleware");
const { loginLimiter, passwordResetLimiter } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

// User Registration with Email Verification
router.post(
  "/register",
  authValidation.validateRegister,
  authHandlers.register
);

// Email Verification
router.get("/verify/:token", authHandlers.verifyEmail);

// Resend Verification Email
router.post("/resend-verification", authHandlers.resendVerification);

// User Login
router.post(
  "/login",
  loginLimiter,
  authValidation.validateLogin,
  authHandlers.login
);

// Forgot Password - Generate Reset Token
router.post(
  "/forgot-password",
  passwordResetLimiter,
  authValidation.validateForgotPassword,
  authHandlers.forgotPassword
);

// Reset Password - Update password using token
router.post(
  "/reset-password",
  passwordResetLimiter,
  authValidation.validateResetPassword,
  authHandlers.resetPassword
);

// Get Current Authenticated User
router.get("/me", authenticateUser, authHandlers.getCurrentUser);

// Protected Resource for Testing RBAC
router.get(
  "/protected-resource",
  authenticateUser,
  authorizeRoles("Admin"),
  (req, res) => {
    res.status(200).json({
      status: true,
      message: "Access granted to protected resource",
      user: req.user,
    });
  }
);

// Logout
router.post("/logout", authenticateUser, authHandlers.logout);

module.exports = router;
