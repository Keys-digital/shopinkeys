const request = require("supertest");
const mongoose = require("mongoose");

// Mock logger to avoid ENOENT errors
jest.mock("../utils/logger", () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    stream: { write: jest.fn() },
}));

const app = require("../app");
const User = require("../models/User");
const BlogPost = require("../models/BlogPost");
const { generateToken } = require("../utils/tokenUtils");
const path = require("path");
const PostInteraction = require(path.resolve(__dirname, "../models/PostInteraction"));


// Mock redis
jest.mock("../config/redisConfig", () => ({
    connectRedis: jest.fn(),
    redisClient: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        quit: jest.fn(),
    },
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
}));

// Mock email utils
jest.mock("../utils/emailUtils", () => ({
    sendEmail: jest.fn().mockResolvedValue(true),
}));

describe("Optional Authentication Verification", () => {
    let testUser;
    let token;
    let testPost;

    beforeAll(async () => {
        // Connect to test DB
        // Assuming DB connection is handled in app or we need to connect explicitly if app doesn't
        // For now, assuming app.js doesn't connect automatically in test mode or we can rely on existing connection
    });

    beforeEach(async () => {
        // Cleanup
        await User.deleteMany({});
        await BlogPost.deleteMany({});
        await PostInteraction.deleteMany({});

        // Create user
        testUser = await User.create({
            name: "Test User",
            email: "test@example.com",
            password: "password123",
            role: "Registered User",
            isEmailVerified: true,
            username: "testuser"
        });

        token = generateToken(testUser._id, testUser.email);

        // Create public post
        testPost = await BlogPost.create({
            title: "Test Public Post",
            slug: "test-public-post",
            content: "Content",
            authorId: testUser._id, // Doesn't matter for this test
            status: "published",
            publishedAt: new Date()
        });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    it("should track view for authenticated user on public route", async () => {
        // 1. Visit with token
        const res = await request(app)
            .get(`/api/blog-posts/public/${testPost.slug}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);

        // 2. Check if view recorded with userId
        const interaction = await PostInteraction.findOne({
            postId: testPost._id,
            type: "view"
        });

        expect(interaction).not.toBeNull();
        // Verify userId is stored! This proves optionalAuth worked
        expect(interaction.userId).toBeDefined();
        expect(interaction.userId.toString()).toBe(testUser._id.toString());
    });

    it("should track view for guest (no token) on public route", async () => {
        const res = await request(app)
            .get(`/api/blog-posts/public/${testPost.slug}`);

        expect(res.status).toBe(200);

        const interaction = await PostInteraction.findOne({
            postId: testPost._id,
            type: "view"
        });

        expect(interaction).not.toBeNull();
        // Verify userId is null/undefined
        expect(interaction.userId).toBeNull();
    });

    it("should tolerate invalid token and treat as guest", async () => {
        const res = await request(app)
            .get(`/api/blog-posts/public/${testPost.slug}`)
            .set("Authorization", "Bearer invalid-token-123");

        expect(res.status).toBe(200); // Should not be 403

        const interaction = await PostInteraction.findOne({
            postId: testPost._id,
            type: "view"
        });

        expect(interaction).not.toBeNull();
        expect(interaction.userId).toBeNull();
    });
});
