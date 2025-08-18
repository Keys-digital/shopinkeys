const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const app = require("../app");
const { User } = require("../models");
const StatusCodes = require("../utils/statusCodes");
const { setupTestDB } = require("../utils/testSetup");

setupTestDB();

describe("Authentication API Tests", () => {
  let testUser;
  let testToken;

  beforeEach(async () => {
    const hashedPassword = await bcryptjs.hash("Test@1234", 10);
    testUser = await User.create({
      email: "testuser@example.com",
      password: hashedPassword,
      isVerified: true,
    });

    testToken = jwt.sign({ id: testUser.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  });

  describe("POST /api/auth/signup", () => {
    it("should successfully register a new user", async () => {
      const response = await request(app).post("/api/auth/signup").send({
        email: "newuser@example.com",
        password: "Secure@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.CREATED);
      expect(response.body.message).toBe(
        "User registered successfully. Please verify your email."
      );
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app).post("/api/auth/signup").send({
        email: "invalid-email",
        password: "Secure@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBe("Invalid email format");
    });

    it("should return 409 for duplicate email", async () => {
      const response = await request(app).post("/api/auth/signup").send({
        email: testUser.email,
        password: "Secure@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      expect(response.body.message).toBe("Email already in use");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should log in an existing user", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "Test@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.body.message).toBe("Login successful");
      expect(response.body.token).toBeDefined();
    });

    it("should return 400 for incorrect password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "WrongPassword",
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toBe("Incorrect password");
    });

    it("should return 404 for non-existent user", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "unknown@example.com",
        password: "Test@1234",
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(response.body.message).toBe(
        "User account not found. Please sign up."
      );
    });
  });

  describe("GET /api/auth/protected", () => {
    it("should allow access with a valid token", async () => {
      const response = await request(app)
        .get("/api/auth/protected")
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.body.message).toBe("Access granted");
    });

    it("should return 401 for missing token", async () => {
      const response = await request(app).get("/api/auth/protected");

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.message).toBe("Access denied. No token provided.");
    });

    it("should return 403 for invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/protected")
        .set("Authorization", "Bearer invalid_token");

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.body.message).toBe("Invalid token");
    });
  });

  describe("POST /api/auth/password-reset", () => {
    it("should send a password reset email", async () => {
      const response = await request(app)
        .post("/api/auth/password-reset")
        .send({ email: testUser.email });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.body.message).toBe("Password reset email sent.");
    });

    it("should return 404 for non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/password-reset")
        .send({ email: "unknown@example.com" });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(response.body.message).toBe("User not found");
    });
  });
});
