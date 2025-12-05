const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const StatusCodes = require("../utils/statusCodes");
const { setupTestDB } = require("../utils/testSetup");
const { passwordResetLimiter } = require("../middlewares/rateLimitMiddleware");

setupTestDB();

describe("Authentication API Tests", () => {
  let testUser;
  let testToken;

  beforeEach(async () => {
    const hashedPassword = await bcryptjs.hash("Test@1234", 10);
    testUser = await User.create({
      name: "Test User",
      username: "testuser",
      email: "testuser@example.com",
      password: hashedPassword,
      isEmailVerified: true,
    });

    testToken = jwt.sign({ id: testUser.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  });

  describe("POST /api/auth/register", () => {
    it("should successfully register a new user", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "New User",
        username: "newuser",
        email: "newuser@example.com",
        password: "Secure@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.CREATED);
      expect(response.body.message).toBe("auth.registration_success");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "Invalid User",
        username: "invaliduser",
        email: "invalid-email",
        password: "Secure@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBe("validation.email_invalid");
    });

    it("should return 409 for duplicate email", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "Duplicate User",
        username: "duplicateuser",
        email: testUser.email,
        password: "Secure@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      expect(response.body.message).toBe("auth.email_in_use");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should log in an existing user", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "Test@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.body.message).toBe("auth.login_success");
      expect(response.body.token).toBeDefined();
    });

    it("should return 400 for incorrect password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "WrongPassword",
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBe("auth.invalid_credentials");
    });

    it("should return 400 for non-existent user (security best practice)", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "unknown@example.com",
        password: "Test@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBe("auth.invalid_credentials");
    });

    it("should return 403 for unverified email", async () => {
      const unverifiedUser = await User.create({
        email: "unverified@example.com",
        password: await bcryptjs.hash("Password123", 10),
        isEmailVerified: false,
        name: "Unverified",
        username: "unverified"
      });

      const response = await request(app).post("/api/auth/login").send({
        email: unverifiedUser.email,
        password: "Password123",
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.body.message).toBe("auth.verify_email");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should allow access with a valid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.body.message).toBe("auth.access_granted");
    });

    it("should return 401 for missing token", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.message).toBe("auth.no_token");
    });

    it("should return 403 for invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid_token");

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.body.message).toBe("auth.invalid_token");
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should send a password reset email", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: testUser.email });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.body.message).toBe("auth.password_reset_sent");
    });

    it("should return 404 for non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "unknown@example.com" });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(response.body.message).toBe("auth.user_not_found");
    });
  });

  describe("POST /api/auth/reset-password", () => {
    let validResetToken;

    beforeEach(() => {
      passwordResetLimiter.resetKey("::ffff:127.0.0.1");
      // simulate a reset token using the same user ID and your reset secret
      validResetToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    });

    it("should reset password with a valid token", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: validResetToken,
          password: "NewPass@1234"
        });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.body.message).toBe("auth.password_reset_success");

      // verify password changed
      const updatedUser = await User.findById(testUser._id).select('+password');
      console.log(updatedUser.password);
      const isMatch = await bcryptjs.compare("NewPass@1234", updatedUser.password);
      console.log(isMatch);
      expect(isMatch).toBe(true);
    });

    it("should return 400 for invalid token", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "invalidtoken",
          password: "NewPass@1234"
        });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBe("auth.invalid_token");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should successfully logout", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.body.message).toBe("auth.logout_success");
    });
  });
});
