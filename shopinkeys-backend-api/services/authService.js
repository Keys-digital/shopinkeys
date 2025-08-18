const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { JWT_SECRET } = require("../config/envConfig");
const { generateToken } = require("../utils/jwtUtils");
const { sendEmail } = require("./emailService");
const {
  verificationEmailTemplate,
  forgotPasswordEmailTemplate,
  passwordResetConfirmationTemplate,
  welcomeEmailTemplate
} = require("./emailTemplates");

// Allowed roles
const ALLOWED_ROLES = ["Admin", "Collaborator", "Editor", "Registered User"];

/**
 * Register a new user and send verification email
 */
const registerUser = async ({ name, username, email, password }) => { 
  try {
    const normalizedUsername = username.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    if (await User.findOne({ email: normalizedEmail })) {
      return { status: false, message: "auth.email_in_use" };
    }

    if (await User.findOne({ username: normalizedUsername })) {
      return { status: false, message: "auth.username_taken" };
    }

    // Create user (password hashed by pre-save hook)
    const user = new User({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      password, 
      role: "Registered User",
      isEmailVerified: false,
    });
    await user.save();

    const verificationToken = generateToken({ id: user._id }, "24h");
    const verificationUrl = `https://yourdomain.com/verify-email/${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: "Verify your ShopInKeys email",
      html: verificationEmailTemplate(user.name, verificationUrl),
    });

    // Log verification token for test purposes
    console.log("=== Verification Token ===");
    console.log(verificationToken);
    console.log("==========================");

    // Return friendly message
    return {
  STATUS_CODE: 201,
  status: true,
  message: "auth.registration_success",
};

  } catch (error) {
    console.error("Register User Error:", error);
    return { status: false, message: "An internal server error occurred." };
  }
};



/**
 * Login user and send welcome email if first login
 */
const login = async (email, password) => {
  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) return { STATUS_CODE: 400, STATUS: false, MESSAGE: "auth.invalid_credentials" };

    if (!password) return { STATUS_CODE: 400, STATUS: false, MESSAGE: "auth.password_required" };

    const isMatch = user.comparePassword(password);
    if (!isMatch) return { STATUS_CODE: 400, STATUS: false, MESSAGE: "auth.invalid_credentials" };

    if (!user.isEmailVerified) {
      return { STATUS_CODE: 403, STATUS: false, MESSAGE: "auth.verify_email_first" };
    }

    const token = generateToken({ id: user._id, role: user.role });

    // Send welcome email if first login
    if (!user.lastLoginAt) {
      await sendEmail({
        to: user.email,
        subject: "Welcome to ShopInKeys!",
        html: welcomeEmailTemplate(user.name),
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    return { STATUS_CODE: 200, STATUS: true, MESSAGE: "auth.login_success", DATA: { token, user } };
  } catch (error) {
    console.error("Login User Error:", error);
    return { STATUS_CODE: 500, STATUS: false, MESSAGE: "errors.internal_server" };
  }
};

/**
 * Verify user email
 */
const verifyEmail = async (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return { success: false, message: "auth.invalid_or_expired_token" };
    if (user.isEmailVerified) return { success: false, message: "auth.email_already_verified" };

    user.isEmailVerified = true;
    await user.save();

    return { success: true, message: "auth.email_verified_success" };
  } catch (error) {
    console.error("Verify Email Error:", error);
    return { success: false, message: "auth.invalid_or_expired_token" };
  }
};

/**
 * Generate forgot password token and send email
 */
const generatePasswordResetToken = async (email) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return { success: false, message: "auth.user_not_found" };

    const resetToken = crypto.randomBytes(32).toString("hex");

     // Log token for testing
    console.log("=== Password Reset Token ===");
    console.log(resetToken);
    console.log("============================");

    user.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `https://yourdomain.com/reset-password/${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: "ShopInKeys Password Reset",
      html: forgotPasswordEmailTemplate(user.name, resetUrl),
    });

    return { success: true, message: "auth.password_reset_sent" };
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return { success: false, message: "errors.internal_server" };
  }
};

/**
 * Reset password using token
 */
const resetPassword = async (token, newPassword) => {
  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) return { success: false, message: "auth.invalid_or_expired_token" };

    user.password = newPassword; // hashed automatically by schema
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: "ShopInKeys Password Reset Successful",
      html: passwordResetConfirmationTemplate(user.name),
    });

    return { success: true, message: "auth.password_reset_success" };
  } catch (error) {
    console.error("Reset Password Error:", error);
    return { success: false, message: "errors.internal_server" };
  }
};

module.exports = {
  registerUser,
  login,
  verifyEmail,
  generatePasswordResetToken,
  resetPassword,
};
