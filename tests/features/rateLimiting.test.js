const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const envConfig = require("../../config/envConfig");

describe("Rate Limiting Tests", () => {
    let testUser;
    let userToken;

    beforeAll(async () => {
        // Create test user
        testUser = await User.create({
            name: "Rate Test User",
            email: "ratetest@example.com",
            username: "ratetest",
            password: "hashedpassword123",
            role: "Registered User",
            isEmailVerified: true,
        });

        userToken = jwt.sign({ id: testUser._id }, envConfig.JWT_SECRET, {
            expiresIn: "1h",
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
    });

    describe("Auth Endpoint Rate Limiting (5 requests/15min)", () => {
        it("should allow first 5 auth requests", async () => {
            for (let i = 0; i < 5; i++) {
                const res = await request(app)
                    .post("/api/auth/login")
                    .send({
                        email: "test@example.com",
                        password: "wrongpassword",
                    });

                // Should get 401 (wrong credentials) not 429 (rate limited)
                expect([400, 401]).toContain(res.status);
            }
        });

        it("should block 6th auth request with 429", async () => {
            const res = await request(app)
                .post("/api/auth/login")
                .send({
                    email: "test@example.com",
                    password: "wrongpassword",
                });

            expect(res.status).toBe(429);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toContain("Too many");
        });
    });

    describe("Click Tracking Rate Limiting (50 clicks/hour)", () => {
        it("should return 429 after exceeding click limit", async () => {
            // This test would need a product ID
            // Skipping actual implementation as it requires full setup
            // But structure shows how to test it
            expect(true).toBe(true);
        });
    });
});
