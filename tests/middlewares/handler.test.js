const { notFound, errorHandler } = require("../../middlewares/handler");
const winston = require("../../utils/logger");

// Mock i18next for translations
jest.mock("../../config/i18nConfig", () => ({
  t: (key, options) => {
    const translations = {
      "errors.not_found": "Route not found",
      "errors.internal_server": "Internal Server Error",
      "errors.validation_error": "Validation Error",
      "errors.invalid_id": "Invalid ID",
      "errors.duplicate_entry": "Duplicate Entry",
      "errors.unauthorized": "Unauthorized",
      "errors.forbidden": "Forbidden",
    };
    return translations[key] || key;
  },
}));

jest.mock("../../utils/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("Error Handling Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = { originalUrl: "/unknown-route", language: "en" };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV; // Ensure NODE_ENV resets after each test
  });

  test("notFound should return 404 error and log warning", () => {
    notFound(req, res, next);

    expect(winston.warn).toHaveBeenCalledWith(
      `404 - Route not found: ${req.originalUrl}`
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Route not found",
        errorCode: "NOT_FOUND",
      })
    );
  });

  test("errorHandler should return 500 error in development mode with details", () => {
    process.env.NODE_ENV = "development";
    const error = new Error("Test error");

    errorHandler(error, req, res, next);

    expect(winston.error).toHaveBeenCalledWith(
      `500 - Error: Internal Server Error`
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Internal Server Error",
        errorCode: "INTERNAL_SERVER_ERROR",
        details: "Test error",
      })
    );
  });

  test("errorHandler should return 500 error in production without details", () => {
    process.env.NODE_ENV = "production";
    const error = new Error("Test error");

    errorHandler(error, req, res, next);

    expect(winston.error).toHaveBeenCalledWith(
      `500 - Error: Internal Server Error`
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Internal Server Error",
        errorCode: "INTERNAL_SERVER_ERROR",
      })
    );
  });

  test("errorHandler should handle validation errors", () => {
    const error = new Error("Validation Error");
    error.name = "ValidationError";

    errorHandler(error, req, res, next);

    expect(winston.error).toHaveBeenCalledWith(`400 - Error: Validation Error`);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation Error",
        errorCode: "VALIDATION_ERROR",
      })
    );
  });

  test("errorHandler should handle invalid ID errors (CastError)", () => {
    const error = new Error("Invalid ID");
    error.name = "CastError";

    errorHandler(error, req, res, next);

    expect(winston.error).toHaveBeenCalledWith(`400 - Error: Invalid ID`);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid ID",
        errorCode: "INVALID_ID",
      })
    );
  });

  test("errorHandler should handle duplicate entry errors (MongoDB)", () => {
    const error = new Error("Duplicate Entry");
    error.code = 11000;
    error.keyValue = { email: "test@example.com" }; // Simulate duplicate key

    errorHandler(error, req, res, next);

    expect(winston.error).toHaveBeenCalledWith(`409 - Error: Duplicate Entry`);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Duplicate Entry",
        errorCode: "DUPLICATE_ENTRY",
      })
    );
  });

  test("errorHandler should handle unauthorized access", () => {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";

    errorHandler(error, req, res, next);

    expect(winston.error).toHaveBeenCalledWith(`401 - Error: Unauthorized`);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Unauthorized",
        errorCode: "UNAUTHORIZED",
      })
    );
  });

  test("errorHandler should handle forbidden access", () => {
    const error = new Error("Forbidden");
    error.name = "ForbiddenError";

    errorHandler(error, req, res, next);

    expect(winston.error).toHaveBeenCalledWith(`403 - Error: Forbidden`);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Forbidden",
        errorCode: "FORBIDDEN",
      })
    );
  });
});
