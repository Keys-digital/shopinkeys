const request = require("supertest");
const express = require("express");
const { roleMiddleware } = require("../../middlewares/roleMiddleware");
const i18n = require("../../config/i18nConfig");
const User = require("../../models/User");
const Role = require("../../models/Role");

jest.mock("../../models/User", () => ({
  findOne: jest.fn(() => ({
    populate: jest.fn(),
  })),
}));

jest.mock("../../models/Role");

const app = express();
app.use(express.json());

// Middleware to mock authentication and language detection
app.use((req, res, next) => {
  req.user = { email: "test@example.com" }; // Only email, role will be fetched from DB
  req.language = req.headers["accept-language"]?.split(",")[0] || "en";
  next();
});

// Protected route for Admin, Collaborator, Editor
app.get(
  "/api/protected",
  roleMiddleware(["Admin", "Collaborator", "Editor"]),
  (req, res) => {
    res.status(200).json({ message: "Access granted" });
  }
);

describe("Role Middleware - Multi-Language & Role Validation", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { email: "test@example.com" },
      headers: { "accept-language": "en" },
      originalUrl: "/api/protected",
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  const mockRole = (roleName) => ({ name: roleName });

  const roleCases = [
    { role: "Admin", expectedStatus: 200 },
    { role: "Collaborator", expectedStatus: 200 },
    { role: "Editor", expectedStatus: 200 },
    { role: "Registered User", expectedStatus: 403 }, // Restricted
    { role: "RandomRole", expectedStatus: 403 }, // Invalid role
    { role: " admin ", expectedStatus: 200 }, // Whitespace and case check
    { role: "COLLABORATOR", expectedStatus: 200 }, // Uppercase check
    { role: null, expectedStatus: 403 }, // No role
    { role: undefined, expectedStatus: 403 }, // Undefined role
  ];

  roleCases.forEach(({ role, expectedStatus }) => {
    it(`should return ${expectedStatus} for user role: '${role}'`, async () => {
      // Mocking User.findOne().populate()
      User.findOne.mockReturnValue({
        populate: jest
          .fn()
          .mockResolvedValue(role ? { role: mockRole(role.trim()) } : null),
      });

      Role.find.mockResolvedValue([
        { name: "Admin" },
        { name: "Collaborator" },
        { name: "Editor" },
        { name: "Registered User" },
      ]);

      await roleMiddleware(["Admin", "Collaborator", "Editor"])(req, res, next);

      if (expectedStatus === 403) {
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          message: i18n.t("errors.forbidden", { lng: req.language }),
        });
      } else {
        expect(next).toHaveBeenCalled();
      }
    });
  });

  it("should allow Admin, Collaborator, and Editor but restrict Registered User", async () => {
    const allowedRoles = ["Admin", "Collaborator", "Editor"];
    for (let role of allowedRoles) {
      User.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({ role: mockRole(role) }),
      });
      await roleMiddleware(allowedRoles)(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    User.findOne.mockReturnValue({
      populate: jest
        .fn()
        .mockResolvedValue({ role: mockRole("Registered User") }),
    });
    await roleMiddleware(allowedRoles)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("should handle missing user object in request", async () => {
    req.user = undefined;
    await roleMiddleware(["Admin"])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("should return 403 if no role is assigned to user", async () => {
    User.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue({ role: null }),
    });
    await roleMiddleware(["Admin"])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("should respect language settings for error messages", async () => {
    req.headers["accept-language"] = "fr"; // French
    User.findOne.mockReturnValue({
      populate: jest
        .fn()
        .mockResolvedValue({ role: mockRole("Registered User") }),
    });

    await roleMiddleware(["Admin"])(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      message: i18n.t("errors.forbidden", { lng: "fr" }),
    });
  });

  it("should return 500 on database error", async () => {
    User.findOne.mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error("Database error")),
    });

    await roleMiddleware(["Admin"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: i18n.t("errors.server_error", { lng: req.language }),
    });
  });
});
