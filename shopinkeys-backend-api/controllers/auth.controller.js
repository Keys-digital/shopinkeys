const authService = require("../services/authService");
const logger = require("../utils/logger");
const i18next = require("../config/i18nConfig");
const { blacklistToken } = require("../config/redisConfig");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/envConfig");

// Helper to safely resolve language
const getLang = (req) =>
  req?.language || req?.headers?.["accept-language"]?.split(",")[0] || "en";

// Register a new user
exports.register = async (req, res) => {
  const lang = getLang(req);
  const { name, username, email, password } = req.body;

  logger.info(`Attempting to register user with email: ${email} (role: Registered User)`);

  try {
    const data = await authService.registerUser({ name, username, email, password });

    const message = i18next.t(data.message, { lng: lang });

    if (!data.STATUS) {
      logger.warn(`Registration failed for ${email}: ${message}`);
    } else {
      logger.info(`User registered successfully: ${email}`);
    }

    return res.status(data.STATUS_CODE).json({
      status: data.STATUS,
      message,
    });

  } catch (error) {
    logger.error(`Error during registration: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: i18next.t("errors.internal_server", { lng: lang }),
    });
  }
};




// Verify email
exports.verifyEmail = async (req, res) => {
  const lang = getLang(req);
  const { token } = req.params;

  try {
    logger.info(`Email verification attempt. Token: ${token}`);
    if (!token) {
      logger.warn("Email verification failed: Missing token");
      return res.status(400).json({
        success: false,
        message: i18next.t("auth.missing_verification_token", { lng: lang }),
      });
    }

    const result = await authService.verifyEmail(token);

    if (!result.success) {
      logger.warn(`Email verification failed: ${result.message}`);
      return res.status(400).json({
        success: false,
        message: i18next.t(result.message, { lng: lang }),
      });
    }

    logger.info("Email verification successful");
    return res.status(200).json({
      success: true,
      message: i18next.t(result.message, { lng: lang }),
    });
  } catch (error) {
    logger.error(`Email verification error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: i18next.t("errors.internal_server", { lng: lang }),
    });
  }
};

// Login
exports.login = async (req, res) => {
  const lang = getLang(req);
  try {
    const { email, password } = req.body;
    logger.info(`Attempting login for user with email: ${email}`);

    const data = await authService.login(email, password);

    if (!data.STATUS) {
      logger.warn(`Login failed for ${email}: ${data.MESSAGE}`);
      return res.status(data.STATUS_CODE).json({
        status: data.STATUS,
        message: i18next.t(data.MESSAGE, { lng: lang }),
      });
    }

    logger.info(`User logged in successfully: ${email}`);
    return res.status(200).json({
      status: true,
      message: i18next.t("auth.login_success", { lng: lang }),
      token: data.DATA.token,
      user: data.DATA.user,
    });
  } catch (error) {
    logger.error(`Error during login: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: i18next.t("errors.internal_server", { lng: lang }),
    });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  const lang = getLang(req);
  try {
    const { email } = req.body;
    if (!email) {
      logger.warn("Forgot password request failed: Missing email.");
      return res.status(400).json({
        status: false,
        message: i18next.t("errors.bad_request", { lng: lang }),
      });
    }

    logger.info(`Processing forgot password request for: ${email}`);
    const result = await authService.generatePasswordResetToken(email);

    if (!result.success) {
      logger.warn(`Forgot password failed for ${email}: ${result.message}`);
      return res.status(result.statusCode || 400).json({
        status: false,
        message: i18next.t(result.message, { lng: lang }),
      });
    }

    return res.status(200).json({
      status: true,
      message: i18next.t("auth.password_reset_sent", { lng: lang }),
    });
  } catch (error) {
    logger.error(`Error in forgot password process: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: i18next.t("errors.internal_server", { lng: lang }),
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  const lang = getLang(req);
  try {
    const { token, newPassword, password } = req.body;
    const passwordToUse = newPassword || password;

    if (!token || !passwordToUse) {
      logger.warn("Reset password failed: Missing token or newPassword.");
      return res.status(400).json({
        status: false,
        message: i18next.t("errors.bad_request", { lng: lang }),
      });
    }

    const result = await authService.resetPassword(token, passwordToUse);

    if (!result.success) {
      logger.warn(`Reset password failed: ${result.message}`);
      return res.status(400).json({
        status: false,
        message: i18next.t(result.message, { lng: lang }),
      });
    }

    return res.status(200).json({
      status: true,
      message: i18next.t("auth.password_reset_success", { lng: lang }),
    });
  } catch (error) {
    logger.error(`Error resetting password: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: i18next.t("errors.internal_server", { lng: lang }),
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  const lang = getLang(req);
  try {
    const token = req.token; // Token stored by authMiddleware

    if (token) {
      // Decode token to get expiration
      const decoded = jwt.decode(token);
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000); // Remaining time in seconds

      // Blacklist token in Redis
      await blacklistToken(token, expiresIn > 0 ? expiresIn : 3600); // Default 1 hour if expired
    }

    logger.info(`User logged out: ${req.user?.id}`);
    return res.status(200).json({
      status: true,
      message: i18next.t("auth.logout_success", { lng: lang }),
    });
  } catch (error) {
    logger.error(`Error during logout: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: i18next.t("errors.internal_server", { lng: lang }),
    });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  const lang = getLang(req);
  try {
    logger.info(`Fetching user info for user ID: ${req.user.id}`);

    const data = await authService.getUserById(req.user.id);

    return res.status(data.STATUS_CODE).json({
      status: data.STATUS,
      message: i18next.t(data.MESSAGE, { lng: lang }),
      data: data.DATA,
    });
  } catch (error) {
    logger.error(`Error fetching user info for user ID: ${req.user?.id}: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: i18next.t("errors.internal_server", { lng: lang }),
    });
  }
};

// Resend Verification Email
exports.resendVerification = async (req, res) => {
  const lang = getLang(req);
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: i18next.t("errors.bad_request", { lng: lang }),
      });
    }

    const result = await authService.resendVerificationEmail(email);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: i18next.t(result.message, { lng: lang }),
      });
    }

    return res.status(200).json({
      success: true,
      message: i18next.t(result.message, { lng: lang }),
    });
  } catch (error) {
    logger.error(`Error resending verification email: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: i18next.t("errors.internal_server", { lng: lang }),
    });
  }
};

// OAuth Callback Handler
exports.oauthCallback = async (req, res) => {
  const lang = getLang(req);
  try {
    // req.user is populated by passport
    const data = await authService.loginWithOAuth(req.user);

    if (!data.STATUS) {
      return res.redirect(`/login?error=${data.MESSAGE}`);
    }

    // Redirect to frontend with token
    // In production, use a secure cookie or a temporary code exchange
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    return res.redirect(`${frontendUrl}/auth/callback?token=${data.DATA.token}`);
  } catch (error) {
    logger.error(`OAuth Callback Error: ${error.message}`);
    return res.redirect("/login?error=server_error");
  }
};
