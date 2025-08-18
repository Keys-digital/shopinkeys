const roleService = require("../../services/roleService");
const userRepository = require("../../repositories/userRepository");
const roleRepository = require("../../repositories/roleRepository");

jest.mock("../../repositories/userRepository");
jest.mock("../../repositories/roleRepository");

describe("Role Service - Role Validation", () => {
  it("should return error if user is not found", async () => {
    userRepository.findOne.mockResolvedValue(null);

    const response = await roleService.checkRolePermission("invalidUserId", [
      "Admin",
    ]);

    expect(response.STATUS_CODE).toBe(400);
    expect(response.STATUS).toBe(false);
    expect(response.MESSAGE).toBe("User not found");
  });

  it("should return success if user is a Guest", async () => {
    userRepository.findOne.mockResolvedValue({ _id: "123", role: "Guest" });

    const response = await roleService.checkRolePermission("123", ["Admin"]);

    expect(response.STATUS_CODE).toBe(200);
    expect(response.STATUS).toBe(true);
    expect(response.MESSAGE).toBe("Guest user access granted");
  });

  it("should return error if user role is not found", async () => {
    userRepository.findOne.mockResolvedValue({
      _id: "123",
      role: "UnknownRole",
    });
    roleRepository.findRole.mockResolvedValue(null);

    const response = await roleService.checkRolePermission("123", ["Admin"]);

    expect(response.STATUS_CODE).toBe(403);
    expect(response.STATUS).toBe(false);
    expect(response.MESSAGE).toBe(
      "You don't have permission to access this resource"
    );
  });

  it("should return success if user has the correct role", async () => {
    userRepository.findOne.mockResolvedValue({ _id: "123", role: "Admin" });
    roleRepository.findRole.mockResolvedValue({ name: "Admin" });

    const response = await roleService.checkRolePermission("123", ["Admin"]);

    expect(response.STATUS_CODE).toBe(200);
    expect(response.STATUS).toBe(true);
  });
});
