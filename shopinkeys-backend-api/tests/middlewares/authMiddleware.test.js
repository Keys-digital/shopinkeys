const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const authMiddleware = require("../../middlewares/authMiddleware");
const User = require("../../models/User");

jest.mock("../../models/User");
jest.mock("jsonwebtoken");

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = { header: jest.fn(), user: null, body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("authenticateUser", () => {
    it("should return 401 if no token is provided", async () => {
      req.header.mockReturnValue(null);
      await authMiddleware.authenticateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        STATUS_CODE: 401,
        STATUS: false,
        MESSAGE: "Unauthorized: No token provided",
      });
    });

    it("should return 401 if token is invalid", async () => {
      req.header.mockReturnValue("Bearer invalidtoken");
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authMiddleware.authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        STATUS_CODE: 401,
        STATUS: false,
        MESSAGE: "Unauthorized: Invalid token",
      });
    });

    it("should return 403 if user is not verified", async () => {
      req.header.mockReturnValue("Bearer validtoken");
      jwt.verify.mockReturnValue({ id: "123" });

      User.findById.mockResolvedValue({
        _id: "123",
        isVerified: false,
        email: "test@example.com",
      });

      await authMiddleware.authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        STATUS_CODE: 403,
        STATUS: false,
        MESSAGE:
          "Forbidden: Please verify your email before accessing this resource.",
      });
    });

    it("should call next() if user is verified", async () => {
      req.header.mockReturnValue("Bearer validtoken");
      jwt.verify.mockReturnValue({ id: "123" });

      User.findById.mockResolvedValue({
        _id: "123",
        isVerified: true,
        email: "test@example.com",
      });

      await authMiddleware.authenticateUser(req, res, next);

      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe("authorizeRoles", () => {
    it("should return 403 if user has no required role", () => {
      req.user = { role: "user" };
      const middleware = authMiddleware.authorizeRoles("admin");
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        STATUS_CODE: 403,
        STATUS: false,
        MESSAGE: "Forbidden: Insufficient permissions",
      });
    });

    it("should call next() if user has the required role", () => {
      req.user = { role: "admin" };
      const middleware = authMiddleware.authorizeRoles("admin");
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("validateRefreshToken", () => {
    it("should return 401 if no refresh token is provided", async () => {
      req.body.refreshToken = null;
      await authMiddleware.validateRefreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        STATUS_CODE: 401,
        STATUS: false,
        MESSAGE: "Unauthorized: No refresh token provided",
      });
    });

    it("should return 403 if refresh token is invalid", async () => {
      req.body.refreshToken = "invalidtoken";
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid refresh token");
      });

      await authMiddleware.validateRefreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        STATUS_CODE: 401,
        STATUS: false,
        MESSAGE: "Unauthorized: Invalid refresh token",
      });
    });

    it("should call next() if refresh token is valid", async () => {
      req.body.refreshToken = "validtoken";
      jwt.verify.mockReturnValue({ id: "123" });

      User.findById.mockResolvedValue({
        _id: "123",
        refreshToken: "validtoken",
      });

      await authMiddleware.validateRefreshToken(req, res, next);

      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
