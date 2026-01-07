const request = require("supertest");
const app = require("../../app"); // Ensure app.js is correctly configured with routes
const userRepository = require("../../repositories/userRepository");

jest.mock("../../repositories/userRepository");

describe("Role Routes API", () => {
  let token;

  beforeAll(async () => {
    // Simulate a logged-in user
    token = "mock-jwt-token"; // Replace with actual JWT generation logic if needed
  });

  it("should deny access to Admin route if user is not an Admin", async () => {
    userRepository.findOne.mockResolvedValue({ role: "Registered User" });

    const res = await request(app)
      .get("/api/roles/admin")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Forbidden: Access denied");
  });

  it("should allow access to Admin route if user is an Admin", async () => {
    userRepository.findOne.mockResolvedValue({ role: "Admin" });

    const res = await request(app)
      .get("/api/roles/admin")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.msg).toBe("Welcome Admin!");
  });
});
