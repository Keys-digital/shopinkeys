const request = require("supertest");
const app = require("../app");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const { User } = require("../models");
const StatusCodes = require("../utils/statusCodes");

describe("/api/v1/auth/login", () => {
  it("should return `user account not found` for account not found", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "shopinkeys@gmail.com", password: "12345678" });

    expect([400, 409]).toContain(response.statusCode);
    expect(response.body.msg).toBe("user account not found please signup");
  });

  it("should return `incorrect password` for invalid credentials", async () => {
    const hashedPassword = await bcryptjs.hash("hashedpassword", 10);
    const user = await User.create({
      email: "shopinkeys@gmail.com",
      password: hashedPassword,
    });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrongpassword" });

    expect([400, 409]).toContain(response.statusCode);
    expect(response.body.msg).toBe("incorrect password");
  });

  it("should return `Login successful` for valid credentials", async () => {
    const hashedPassword = await bcryptjs.hash("hashedpassword", 10);
    const user = await User.create({
      email: "shopinkeys@gmail.com",
      password: hashedPassword,
    });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "hashedpassword" });

    expect(response.statusCode).toBe(200);
    expect(response.body.msg).toBe("welcome to Resida");
    expect(response.body.token).toBeDefined();
  });
});

describe("/api/v1/protected-resource", () => {
  it("should allow access to Admin", async () => {
    const user = await User.create({
      role: "Admin",
      email: "admin@example.com",
      password: await bcryptjs.hash("hashedpassword", 10),
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30s" }
    );

    const response = await request(app)
      .get("/api/v1/protected-resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
  });

  it("should deny access to Shipper", async () => {
    const user = await User.create({
      role: "Shipper",
      email: "shipper@example.com",
      password: await bcryptjs.hash("hashedpassword", 10),
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30s" }
    );

    const response = await request(app)
      .get("/api/v1/protected-resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(response.body.message).toBe(
      "You don't have permission to access this resource"
    );
  });

  it("should deny access to Carrier", async () => {
    const user = await User.create({
      role: "Carrier",
      email: "carrier@example.com",
      password: await bcryptjs.hash("hashedpassword", 10),
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30s" }
    );

    const response = await request(app)
      .get("/api/v1/protected-resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(response.body.message).toBe(
      "You don't have permission to access this resource"
    );
  });
});
