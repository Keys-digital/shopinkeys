const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const roleRepository = require("../../repositories/roleRepository");
const Role = require("../../models/Role");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

beforeEach(async () => {
  await Role.deleteMany();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

describe("Role Repository", () => {
  describe("createRole", () => {
    it("should create a new role", async () => {
      const roleData = { name: "TestRole", permissions: ["read"] };
      const role = await roleRepository.createRole(roleData);

      expect(role).toBeDefined();
      expect(role.name).toBe("TestRole");
      expect(role.permissions).toContain("read");
    });

    it("should throw error if role creation fails", async () => {
      jest.spyOn(Role.prototype, "save").mockImplementationOnce(() => {
        throw new Error("Database error");
      });

      await expect(roleRepository.createRole({ name: "FailRole" }))
        .rejects.toThrow("Database error");
    });
  });

  describe("findRole", () => {
    it("should find a role by filter", async () => {
      await Role.create({ name: "FindMe" });
      const role = await roleRepository.findRole({ name: "FindMe" });

      expect(role).toBeDefined();
      expect(role.name).toBe("FindMe");
    });

    it("should return null if role not found", async () => {
      const role = await roleRepository.findRole({ name: "NonExistent" });
      expect(role).toBeNull();
    });
  });

  describe("updateRole", () => {
    it("should update a role", async () => {
      await Role.create({ name: "OldName" });
      const updatedRole = await roleRepository.updateRole(
        { name: "OldName" },
        { name: "NewName" }
      );

      expect(updatedRole).toBeDefined();
      expect(updatedRole.name).toBe("NewName");
    });
  });

  describe("deleteRole", () => {
    it("should delete a role", async () => {
      await Role.create({ name: "DeleteMe" });
      const deletedRole = await roleRepository.deleteRole({ name: "DeleteMe" });

      expect(deletedRole).toBeDefined();
      expect(deletedRole.name).toBe("DeleteMe");

      const check = await roleRepository.findRole({ name: "DeleteMe" });
      expect(check).toBeNull();
    });
  });
});
