const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Role = require("../models/Role");
const authService = require("../services/authService");
const StatusCodes = require("../utils/statusCodes");
const { setupTestDB } = require("../utils/testSetup");

setupTestDB();

describe("Auth Extensions Tests", () => {
    let testUser;

    beforeEach(async () => {
        testUser = await User.create({
            name: "Test User",
            username: "testuser",
            email: "test@example.com",
            password: "password123",
            isEmailVerified: false,
        });
    });

    describe("POST /api/auth/resend-verification", () => {
        it("should resend verification email for unverified user", async () => {
            const response = await request(app)
                .post("/api/auth/resend-verification")
                .send({ email: testUser.email });

            expect(response.statusCode).toBe(StatusCodes.OK);
            expect(response.body.message).toBe("auth.verification_email_sent");
        });

        it("should return 400 if user is already verified", async () => {
            testUser.isEmailVerified = true;
            await testUser.save();

            const response = await request(app)
                .post("/api/auth/resend-verification")
                .send({ email: testUser.email });

            expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body.message).toBe("auth.email_already_verified");
        });

        it("should return 400 for non-existent user", async () => {
            const response = await request(app)
                .post("/api/auth/resend-verification")
                .send({ email: "nonexistent@example.com" });

            expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST); // Service returns success: false, message: user_not_found, controller maps to 400
        });
    });

    describe("AuthService.loginWithOAuth", () => {
        it("should create a new user from OAuth profile", async () => {
            const profile = {
                provider: "google",
                id: "google123",
                displayName: "Google User",
                emails: [{ value: "google@example.com" }],
                photos: [{ value: "photo.jpg" }],
            };

            const result = await authService.loginWithOAuth(profile);

            expect(result.STATUS).toBe(true);
            expect(result.DATA.user.email).toBe("google@example.com");
            expect(result.DATA.user.googleId).toBe("google123");
            expect(result.DATA.user.isEmailVerified).toBe(true);
        });

        it("should link existing user by email", async () => {
            // Create user with email but no googleId
            await User.create({
                name: "Existing User",
                username: "existing",
                email: "existing@example.com",
                password: "password",
            });

            const profile = {
                provider: "google",
                id: "google456",
                displayName: "Existing User",
                emails: [{ value: "existing@example.com" }],
            };

            const result = await authService.loginWithOAuth(profile);

            expect(result.STATUS).toBe(true);
            const updatedUser = await User.findOne({ email: "existing@example.com" }).select("+googleId");
            expect(updatedUser.googleId).toBe("google456");
        });
    });
});
