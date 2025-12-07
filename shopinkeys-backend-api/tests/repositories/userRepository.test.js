const mongoose = require("mongoose");
const User = require("../../models/User");
const userRepository = require("../../repositories/userRepository");

jest.mock("../../models/User");

describe("User Repository", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findOne", () => {
    it("should find a user by filter", async () => {
      const mockUser = { _id: "123", email: "test@example.com" };
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await userRepository.findOne({
        email: "test@example.com",
      });

      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(result).toEqual(mockUser);
    });

    it("should return null if an error occurs", async () => {
      User.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      await expect(userRepository.findOne({
        email: "fail@example.com",
      })).rejects.toThrow("Database error");
    });
  });

  describe("findUserAndRole", () => {
    it("should find a user and populate role", async () => {
      const mockUser = {
        _id: "123",
        email: "test@example.com",
        role: { name: "Admin" },
      };
      User.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUser)
        }),
      });

      const result = await userRepository.findUserAndRole({
        email: "test@example.com",
      });

      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(result).toEqual(mockUser);
    });

    it("should return null if an error occurs", async () => {
      User.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error("Database error"))
        }),
      });

      await expect(userRepository.findUserAndRole({
        email: "fail@example.com",
      })).rejects.toThrow("Database error");
    });
  });

  describe("createUser", () => {
    it("should create a new user", async () => {
      const mockUserData = {
        email: "test@example.com",
        password: "hashedpassword",
      };
      const mockSavedUser = { _id: "123", ...mockUserData };

      User.prototype.save = jest.fn().mockResolvedValue(mockSavedUser);

      const result = await userRepository.createUser(mockUserData);

      expect(result).toEqual(mockSavedUser);
    });

    it("should return null if an error occurs", async () => {
      User.prototype.save = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await expect(userRepository.createUser({
        email: "fail@example.com",
      })).rejects.toThrow("Database error");
    });
  });

  describe("updateUser", () => {
    it("should update a user and return the new version", async () => {
      const mockUpdatedUser = { _id: "123", email: "updated@example.com" };
      User.findOneAndUpdate.mockResolvedValue(mockUpdatedUser);

      const result = await userRepository.updateUser(
        { email: "test@example.com" },
        { email: "updated@example.com" }
      );

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { email: "test@example.com" },
        { email: "updated@example.com" },
        { new: true, lean: true }
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it("should return null if an error occurs", async () => {
      User.findOneAndUpdate.mockRejectedValue(new Error("Database error"));

      await expect(userRepository.updateUser(
        { email: "fail@example.com" },
        { email: "updated@example.com" }
      )).rejects.toThrow("Database error");
    });
  });
});
