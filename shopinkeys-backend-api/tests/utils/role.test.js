const request = require("supertest");
const app = require("../app");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const User = require("../models/User");
const StatusCodes = require("../utils/statusCodes");

describe("/api/auth/login", () => {
  it("should return `user account not found` for account not found", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "shopinkeys@gmail.com", password: "12345678" });

    expect([400, 409]).toContain(response.statusCode);
    expect(response.body.message).toBe("auth.invalid_credentials");
  });

  it("should return `incorrect password` for invalid credentials", async () => {
    const hashedPassword = await bcryptjs.hash("hashedpassword", 10);
    const user = await User.create({
      name: "Test User",
      username: "testuser",
      email: "shopinkeys@gmail.com",
      password: hashedPassword,
      isEmailVerified: true,
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrongpassword" });

    expect([400, 409]).toContain(response.statusCode);
    expect(response.body.message).toBe("auth.invalid_credentials");
  });

  it("should return `Login successful` for valid credentials", async () => {
    const hashedPassword = await bcryptjs.hash("hashedpassword", 10);
    const user = await User.create({
      name: "Test User",
      username: "testuser",
      email: "shopinkeys@gmail.com",
      password: hashedPassword,
      isEmailVerified: true,
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "hashedpassword" });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("auth.login_success");
    expect(response.body.token).toBeDefined();
  });
});

describe("/api/auth/protected-resource", () => {
  it("should allow access to Admin", async () => {
    const user = await User.create({
      name: "Admin User",
      username: "adminuser",
      role: "Admin",
      email: "admin@example.com",
      password: await bcryptjs.hash("hashedpassword", 10),
      isEmailVerified: true,
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30s" }
    );

    const response = await request(app)
      .get("/api/auth/protected-resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
  });

  it("should deny access to Registered User", async () => {
    const user = await User.create({
      name: "Regular User",
      username: "regularuser",
      role: "Registered User",
      email: "user@example.com",
      password: await bcryptjs.hash("hashedpassword", 10),
      isEmailVerified: true,
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30s" }
    );

    const response = await request(app)
      .get("/api/auth/protected-resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(response.body.message).toBe(
      "You don't have permission to access this resource"
    );
  });

  it("should deny access to Collaborator", async () => {
    const user = await User.create({
      name: "Collaborator User",
      username: "collabuser",
      role: "Collaborator",
      email: "collab@example.com",
      password: await bcryptjs.hash("hashedpassword", 10),
      isEmailVerified: true,
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30s" }
    );

    const response = await request(app)
      .get("/api/auth/protected-resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(response.body.message).toBe(
      "You don't have permission to access this resource"
    );
  });
});
