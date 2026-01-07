const i18next = require("../config/i18nConfig");
const winston = require("../utils/logger");

// 404 Not Found Handler
const notFound = (req, res, next) => {
  winston.warn(`404 - Route not found: ${req.originalUrl}`);

  res.status(404).json({
    error: i18next.t("errors.not_found", { lng: req.language || "en" }),
    errorCode: "NOT_FOUND",
  });
};

// Global Error Handler
const errorHandler = (err, req, res, next) => {
  const lang = req.language || "en";

  // Ensure statusCode is always set
  let statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let errorMessage = i18next.t("errors.internal_server", { lng: lang });
  let errorCode = "INTERNAL_SERVER_ERROR";

  // Handle Validation Errors (Joi, Express-validator)
  if (err.name === "ValidationError") {
    statusCode = 400;
    errorMessage = i18next.t("errors.validation_error", { lng: lang });
    errorCode = "VALIDATION_ERROR";
  }
  // Handle Mongoose Errors (CastError, Duplicate Key, etc.)
  else if (err.name === "CastError") {
    statusCode = 400;
    errorMessage = i18next.t("errors.invalid_id", { lng: lang });
    errorCode = "INVALID_ID";
  } else if (err.code === 11000) {
    statusCode = 409;
    errorMessage = i18next.t("errors.duplicate_entry", { lng: lang });
    errorCode = "DUPLICATE_ENTRY";
  }
  // Handle Unauthorized & Forbidden Access
  else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    errorMessage = i18next.t("errors.unauthorized", { lng: lang });
    errorCode = "UNAUTHORIZED";
  } else if (err.name === "ForbiddenError") {
    statusCode = 403;
    errorMessage = i18next.t("errors.forbidden", { lng: lang });
    errorCode = "FORBIDDEN";
  }

  //  **Move Logging Here (After Setting the Correct Status)**
  winston.error(`${statusCode} - Error: ${errorMessage}`);

  // Response Object
  const response = {
    error: errorMessage,
    errorCode,
    ...(process.env.NODE_ENV === "development" && { details: err.message }),
  };

  res.status(statusCode).json(response);
};

module.exports = { notFound, errorHandler };
