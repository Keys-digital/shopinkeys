const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const BlogPost = require("../../models/BlogPost");
const User = require("../../models/User");
const PostInteraction = require("../../models/PostInteraction");
const jwt = require("jsonwebtoken");
const envConfig = require("../../config/envConfig");

describe("Blog Post Routes - Guest Access", () => {
    let testUser;
    let testCollaborator;
    let publishedPost;
    let draftPost;
    let authToken;

    beforeAll(async () => {
        // Create test users
        testUser = await User.create({
            name: "Test User",
            email: "testuser@example.com",
            username: "testuser",
            password: "hashedpassword123",
            role: "Registered User",
            isEmailVerified: true,
        });

        testCollaborator = await User.create({
            name: "Test Collaborator",
            email: "collaborator@example.com",
            username: "collaborator",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });

        // Generate auth token for authenticated tests
        authToken = jwt.sign({ id: testUser._id }, envConfig.JWT_SECRET, {
            expiresIn: "1h",
        });

        // Create test posts
        publishedPost = await BlogPost.create({
            authorId: testCollaborator._id,
            title: "Published Test Post",
            slug: "published-test-post",
            content: "This is a published post content",
            excerpt: "Published excerpt",
            status: "published",
            publishedAt: new Date(),
        });

        draftPost = await BlogPost.create({
            authorId: testCollaborator._id,
            title: "Draft Test Post",
            slug: "draft-test-post",
            content: "This is a draft post content",
            excerpt: "Draft excerpt",
            status: "draft",
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
        await BlogPost.deleteMany({});
        await PostInteraction.deleteMany({});
    });

    describe("GET /api/blog-posts/public", () => {
        it("should return all published posts for guests", async () => {
            const res = await request(app).get("/api/blog-posts/public");

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.posts).toBeInstanceOf(Array);
            expect(res.body.DATA.posts.length).toBe(1);
            expect(res.body.DATA.posts[0].slug).toBe("published-test-post");
            expect(res.body.DATA.pagination).toBeDefined();
        });

        it("should not return draft posts", async () => {
            const res = await request(app).get("/api/blog-posts/public");

            expect(res.status).toBe(200);
            const slugs = res.body.DATA.posts.map((p) => p.slug);
            expect(slugs).not.toContain("draft-test-post");
        });

        it("should support pagination", async () => {
            const res = await request(app)
                .get("/api/blog-posts/public")
                .query({ page: 1, limit: 5 });

            expect(res.status).toBe(200);
            expect(res.body.DATA.pagination.currentPage).toBe(1);
            expect(res.body.DATA.pagination.limit).toBe(5);
        });
    });

    describe("GET /api/blog-posts/public/:slug", () => {
        it("should return a published post by slug for guests", async () => {
            const res = await request(app).get(
                `/api/blog-posts/public/${publishedPost.slug}`
            );

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.slug).toBe("published-test-post");
            expect(res.body.DATA.title).toBe("Published Test Post");
        });

        it("should return 404 for draft posts", async () => {
            const res = await request(app).get(
                `/api/blog-posts/public/${draftPost.slug}`
            );

            expect(res.status).toBe(404);
            expect(res.body.STATUS).toBe(false);
        });
    });

    describe("POST /api/blog-posts/:id/like - Guest Restriction", () => {
        it("should return 401 for guests trying to like a post", async () => {
            const res = await request(app).post(
                `/api/blog-posts/${publishedPost._id}/like`
            );

            expect(res.status).toBe(401);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe("You must be logged in to like posts");
        });

        it("should allow authenticated users to like a post", async () => {
            const res = await request(app)
                .post(`/api/blog-posts/${publishedPost._id}/like`)
                .set("Authorization", `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.MESSAGE).toBe("Post liked.");
        });
    });

    describe("POST /api/blog-posts/:id/rate - Guest Restriction", () => {
        it("should return 401 for guests trying to rate a post", async () => {
            const res = await request(app)
                .post(`/api/blog-posts/${publishedPost._id}/rate`)
                .send({ rating: 5 });

            expect(res.status).toBe(401);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe("You must be logged in to rate posts");
        });

        it("should allow authenticated users to rate a post", async () => {
            const res = await request(app)
                .post(`/api/blog-posts/${publishedPost._id}/rate`)
                .set("Authorization", `Bearer ${authToken}`)
                .send({ rating: 5 });

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.MESSAGE).toBe("Post rated successfully.");
        });
    });

    describe("POST /api/blog-posts/:id/comment - Guest Restriction", () => {
        it("should return 401 for guests trying to comment on a post", async () => {
            const res = await request(app)
                .post(`/api/blog-posts/${publishedPost._id}/comment`)
                .send({ comment: "Great post!" });

            expect(res.status).toBe(401);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe(
                "You must be logged in to comment on posts"
            );
        });

        it("should allow authenticated users to comment on a post", async () => {
            const res = await request(app)
                .post(`/api/blog-posts/${publishedPost._id}/comment`)
                .set("Authorization", `Bearer ${authToken}`)
                .send({ comment: "Great post!" });

            expect(res.status).toBe(201);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.MESSAGE).toBe("Comment added successfully.");
        });
    });
});
