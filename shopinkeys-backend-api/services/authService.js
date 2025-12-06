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
      return { STATUS_CODE: 409, STATUS: false, message: "auth.email_in_use" };
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

    // // Log verification token for test purposes
    // console.log("=== Verification Token ===");
    // console.log(verificationToken);
    // console.log("==========================");

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
      return { STATUS_CODE: 403, STATUS: false, MESSAGE: "auth.verify_email" };
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
    if (!user) return { success: false, statusCode: 404, message: "auth.user_not_found" };

    const resetToken = crypto.randomBytes(32).toString("hex");

    // Log token for testing
    // console.log("=== Password Reset Token ===");
    // console.log(resetToken);
    // console.log("============================");

    user.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.passwordResetExpires = Date.now() + 1800000; // 30 minutes
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
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return { success: false, message: "auth.invalid_token" };

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
    return { success: false, message: "auth.invalid_token" };
  }
};

/**
 * Resend verification email
 */
const resendVerificationEmail = async (email) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return { success: false, message: "auth.user_not_found" };
    if (user.isEmailVerified) return { success: false, message: "auth.email_already_verified" };

    const verificationToken = generateToken({ id: user._id }, "24h");
    const verificationUrl = `https://yourdomain.com/verify-email/${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: "Verify your ShopInKeys email",
      html: verificationEmailTemplate(user.name, verificationUrl),
    });

    return { success: true, message: "auth.verification_email_sent" };
  } catch (error) {
    console.error("Resend Verification Error:", error);
    return { success: false, message: "errors.internal_server" };
  }
};

/**
 * Login or Register with OAuth
 */
const loginWithOAuth = async (profile) => {
  try {
    let user = await User.findOne({
      $or: [{ googleId: profile.id }, { facebookId: profile.id }, { email: profile.emails[0].value }],
    });

    if (user) {
      // Link account if email matches but ID doesn't (e.g. registered with email, then used Google)
      if (profile.provider === "google" && !user.googleId) {
        user.googleId = profile.id;
        await user.save();
      } else if (profile.provider === "facebook" && !user.facebookId) {
        user.facebookId = profile.id;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        name: profile.displayName || `${profile.name.givenName} ${profile.name.familyName}`,
        username: (profile.emails[0].value.split("@")[0] + Math.floor(Math.random() * 1000)).toLowerCase(),
        email: profile.emails[0].value,
        password: crypto.randomBytes(16).toString("hex"), // Random password for OAuth users
        role: "Registered User",
        isEmailVerified: true, // OAuth emails are trusted
        googleId: profile.provider === "google" ? profile.id : undefined,
        facebookId: profile.provider === "facebook" ? profile.id : undefined,
        avatar: profile.photos ? profile.photos[0].value : undefined,
      });
      await user.save();

      // Send welcome email
      await sendEmail({
        to: user.email,
        subject: "Welcome to ShopInKeys!",
        html: welcomeEmailTemplate(user.name),
      });
    }

    const token = generateToken({ id: user._id, role: user.role });
    return { STATUS: true, DATA: { token, user } };
  } catch (error) {
    console.error("OAuth Login Error:", error);
    return { STATUS: false, MESSAGE: "errors.internal_server" };
  }
};

/**
 * Get user by ID
 */
const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return {
        STATUS_CODE: 404,
        STATUS: false,
        MESSAGE: "auth.user_not_found",
        DATA: null,
      };
    }

    return {
      STATUS_CODE: 200,
      STATUS: true,
      MESSAGE: "auth.access_granted",
      DATA: user,
    };
  } catch (error) {
    console.error("Get User By ID Error:", error);
    return {
      STATUS_CODE: 500,
      STATUS: false,
      MESSAGE: "errors.internal_server",
      DATA: null,
    };
  }
};

module.exports = {
  registerUser,
  login,
  verifyEmail,
  generatePasswordResetToken,
  resetPassword,
  resendVerificationEmail,
  loginWithOAuth,
  getUserById,
};
