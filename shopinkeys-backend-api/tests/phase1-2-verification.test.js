const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const BlogPost = require("../models/BlogPost");
const path = require("path");
const { POST_STATUS, ROLES } = require("../constants");

// Mock logger to prevent file writes
jest.mock("../utils/logger", () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    stream: { write: jest.fn() },
}));

describe("Phase 1 & 2 Verification", () => {
    let collaboratorToken;
    let collaboratorId;

    beforeEach(async () => {
        // Fetch seeded Collaborator (seeded by setupTests.js -> seedTestDB.js)
        const collaborator = await User.findOne({ email: "janesmith@example.com" });
        if (!collaborator) {
            throw new Error("Seeded collaborator not found");
        }
        collaboratorId = collaborator._id;
        collaboratorToken = collaborator.getSignedJwtToken();
    });

    describe("Input Validation (Joi)", () => {
        it("should return 400 if required fields are missing in createPost", async () => {
            const res = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    // Missing title and content
                    status: "draft"
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toMatch(/title/); // Should mention missing title
        });

        it("should return 400 if invalid status is provided", async () => {
            const res = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "Valid Title",
                    content: "Valid Content",
                    status: "invalid_status"
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.MESSAGE).toMatch(/status/);
        });

        it("should create post successfully with valid data", async () => {
            const res = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "Valid Title for Creation",
                    content: "Valid Content",
                    status: POST_STATUS.DRAFT,
                    media: [{ type: "image", url: "http://example.com/img.jpg" }]
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.title).toBe("Valid Title for Creation");
        });
    });

    describe("Constants Usage (Model)", () => {
        it("should respect the POST_STATUS constants in Mongoose validation", async () => {
            // Using Mongoose model directly to test schema
            const post = new BlogPost({
                authorId: collaboratorId,
                title: "Enum Test",
                slug: "enum-test",
                content: "Content",
                status: "invalid_enum_value" // Should fail
            });

            let error;
            try {
                await post.validate();
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.errors.status).toBeDefined();
        });
    });

    describe("Rate Limiter Headers", () => {
        it("should return rate limit headers on public endpoints", async () => {
            const res = await request(app).get("/api/blog-posts/public");

            // Note: express-rate-limit headers might vary depending on config (standardHeaders: true)
            // Expect RateLimit-Limit or similar
            expect(res.headers["ratelimit-limit"]).toBeDefined();
            expect(res.headers["ratelimit-remaining"]).toBeDefined();
        });
    });
});
