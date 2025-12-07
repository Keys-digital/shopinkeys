const request = require("supertest");
const app = require("../../app");
const BlogPost = require("../../models/BlogPost");
const PostInteraction = require("../../models/PostInteraction");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const envConfig = require("../../config/envConfig");

describe("View Deduplication Tests", () => {
    let testUser;
    let testPost;
    let userToken;

    beforeEach(async () => {
        // Clean up
        await User.deleteMany({});
        await BlogPost.deleteMany({});
        await PostInteraction.deleteMany({});

        // Create test user
        testUser = await User.create({
            name: "View Test User",
            email: "viewtest@example.com",
            username: "viewtest",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });

        userToken = jwt.sign({ id: testUser._id }, envConfig.JWT_SECRET, {
            expiresIn: "1h",
        });

        // Create published post
        testPost = await BlogPost.create({
            authorId: testUser._id,
            title: "View Deduplication Test Post",
            slug: "view-dedup-test",
            content: "This is test content for view deduplication testing.",
            status: "published",
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
        await BlogPost.deleteMany({});
        await PostInteraction.deleteMany({});
    });

    describe("6-Hour View Deduplication Window", () => {
        it("should track first view from IP", async () => {
            const res = await request(app).get(
                `/api/blog-posts/public/${testPost.slug}`
            );

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);

            // Check that view was tracked
            const viewCount = await PostInteraction.countDocuments({
                postId: testPost._id,
                type: "view",
            });
            expect(viewCount).toBe(1);
        });

        it("should not track duplicate view from same IP within 6 hours", async () => {
            // First view
            await request(app).get(`/api/blog-posts/public/${testPost.slug}`);

            // Second view from same IP
            await request(app).get(`/api/blog-posts/public/${testPost.slug}`);

            // Should still only have 1 view
            const viewCount = await PostInteraction.countDocuments({
                postId: testPost._id,
                type: "view",
            });
            expect(viewCount).toBe(1);
        });

        it("should track view from authenticated user only once", async () => {
            // First view (authenticated)
            await request(app)
                .get(`/api/blog-posts/public/${testPost.slug}`)
                .set("Authorization", `Bearer ${userToken}`);

            // Second view (authenticated, same user)
            await request(app)
                .get(`/api/blog-posts/public/${testPost.slug}`)
                .set("Authorization", `Bearer ${userToken}`);

            // Should only have 1 view
            const viewCount = await PostInteraction.countDocuments({
                postId: testPost._id,
                type: "view",
                userId: testUser._id,
            });
            expect(viewCount).toBe(1);
        });

        it("should track view after 6 hours have passed", async () => {
            // Create an old view (7 hours ago)
            const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
            await PostInteraction.create({
                postId: testPost._id,
                type: "view",
                ipAddress: "::ffff:127.0.0.1",
                createdAt: sevenHoursAgo,
            });

            // New view should be tracked
            await request(app).get(`/api/blog-posts/public/${testPost.slug}`);

            // Should have 2 views now
            const viewCount = await PostInteraction.countDocuments({
                postId: testPost._id,
                type: "view",
            });
            expect(viewCount).toBe(2);
        });

        it("should store IP address and user agent in view", async () => {
            await request(app)
                .get(`/api/blog-posts/public/${testPost.slug}`)
                .set("User-Agent", "Test Browser");

            const view = await PostInteraction.findOne({
                postId: testPost._id,
                type: "view",
            });

            expect(view).not.toBeNull();
            expect(view.ipAddress).toBeDefined();
            expect(view.userAgent).toBe("Test Browser");
        });
    });
});
