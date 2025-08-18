const express = require("express");
const authHandlers = require("../controllers/auth.controller");
const authValidation = require("../validations/authValidation");
const { authenticateUser } = require("../middlewares/authMiddleware");

const router = express.Router();

// User Registration with Email Verification
router.post(
  "/register",
  authValidation.validateRegister,
  authHandlers.register
);

// Email Verification
router.get("/verify/:token", authHandlers.verifyEmail);

// User Login
router.post(
  "/login",
  authValidation.validateLogin,
  authHandlers.login
);

// Forgot Password - Generate Reset Token
router.post(
  "/forgot-password",
  authValidation.validateForgotPassword,
  authHandlers.forgotPassword
);

// Reset Password - Update password using token
router.post(
  "/reset-password",
  authValidation.validateResetPassword,
  authHandlers.resetPassword
);

// Get Current Authenticated User
router.get("/me", authenticateUser, authHandlers.getCurrentUser);

// Logout
router.post("/logout", authenticateUser, authHandlers.logout);

module.exports = router;
