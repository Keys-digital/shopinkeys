const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const roleRepository = require("../../repositories/roleRepository");
const Role = require("../../models/Role");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create(); // ✅ Initialize in correct way
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

beforeEach(async () => {
  await Role.deleteMany(); // Ensure fresh database state before each test
  jest.restoreAllMocks(); // Reset mocks between tests
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

describe("User Repository - Role & Update", () => {
  it("should fetch a user with their role", async () => {
    const user = await User.create({
      email: "user@example.com",
      password: "pass123",
      role: "Admin",
    });

    const fetchedUser = await userRepository.findUserAndRole({
      email: "user@example.com",
    });

    expect(fetchedUser).not.toBeNull();
    expect(fetchedUser.role).toBeDefined();
    expect(fetchedUser.role).toBe("Admin");
  });

  it("should return null if findUserAndRole encounters an error", async () => {
    jest.spyOn(User, "findOne").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const user = await userRepository.findUserAndRole({
      email: "user@example.com",
    });

    expect(user).toBeNull();
  });

  it("should update a user successfully", async () => {
    const user = await User.create({
      email: "test@example.com",
      password: "password",
    });

    const updatedUser = await userRepository.updateUser(
      { email: "test@example.com" },
      { email: "new@example.com" }
    );

    expect(updatedUser).not.toBeNull();
    expect(updatedUser.email).toBe("new@example.com");
  });

  it("should return null if updateUser fails", async () => {
    jest.spyOn(User, "findOneAndUpdate").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const updatedUser = await userRepository.updateUser(
      { email: "fake@example.com" },
      { email: "new@example.com" }
    );

    expect(updatedUser).toBeNull();
  });
});
