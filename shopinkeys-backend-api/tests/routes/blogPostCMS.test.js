const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const BlogPost = require("../../models/BlogPost");
const User = require("../../models/User");
const Notification = require("../../models/Notification");
const jwt = require("jsonwebtoken");
const envConfig = require("../../config/envConfig");

/**
 * Comprehensive CMS Tests for User Story #11
 * 
 * NOTE: Super Admins are included in submission notifications due to unrestricted oversight privileges.
 * 
 * Test Coverage:
 * 1. Featured/Trending Toggle Functionality
 * 2. Notification Triggers
 * 3. Editor Self-Review Prevention
 * 4. Review Queue Filtering
 * 5. Get My Posts Endpoint
 */
describe("Blog Post CMS Features - User Story 11", () => {
    let collaborator, editor, admin, superAdmin;
    let collaboratorToken, editorToken, adminToken, superAdminToken;
    let publishedPost, draftPost, inReviewPost;

    // Helper to create test users
    async function createTestUsers() {
        const collab = await User.create({
            name: "Test Collaborator",
            email: "collaborator@example.com",
            username: "collaborator",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });

        const ed = await User.create({
            name: "Test Editor",
            email: "editor@example.com",
            username: "editor",
            password: "hashedpassword123",
            role: "Editor",
            isEmailVerified: true,
        });

        const adm = await User.create({
            name: "Test Admin",
            email: "admin@example.com",
            username: "admin",
            password: "hashedpassword123",
            role: "Admin",
            isEmailVerified: true,
        });

        const superAdm = await User.create({
            name: "Test Super Admin",
            email: "superadmin@example.com",
            username: "superadmin",
            password: "hashedpassword123",
            role: "Super Admin",
            isEmailVerified: true,
        });

        return {
            collab,
            ed,
            adm,
            superAdm,
            collabToken: jwt.sign({ id: collab._id }, envConfig.JWT_SECRET, { expiresIn: "1h" }),
            edToken: jwt.sign({ id: ed._id }, envConfig.JWT_SECRET, { expiresIn: "1h" }),
            admToken: jwt.sign({ id: adm._id }, envConfig.JWT_SECRET, { expiresIn: "1h" }),
            superAdmToken: jwt.sign({ id: superAdm._id }, envConfig.JWT_SECRET, { expiresIn: "1h" }),
        };
    }

    beforeEach(async () => {
        // Clear collections
        await User.deleteMany({});
        await BlogPost.deleteMany({});
        await Notification.deleteMany({});

        // Create test users
        const users = await createTestUsers();
        collaborator = users.collab;
        editor = users.ed;
        admin = users.adm;
        superAdmin = users.superAdm;
        collaboratorToken = users.collabToken;
        editorToken = users.edToken;
        adminToken = users.admToken;
        superAdminToken = users.superAdmToken;

        // Create test posts
        publishedPost = await BlogPost.create({
            authorId: collaborator._id,
            title: "Published Test Post",
            slug: "published-test-post",
            content: "This is a published post content with enough characters to pass validation requirements.",
            status: "published",
            publishedAt: new Date(),
        });

        draftPost = await BlogPost.create({
            authorId: collaborator._id,
            title: "Draft Test Post",
            slug: "draft-test-post",
            content: "This is a draft post content with enough characters to pass validation requirements.",
            status: "draft",
        });

        inReviewPost = await BlogPost.create({
            authorId: collaborator._id,
            title: "In Review Test Post",
            slug: "in-review-test-post",
            content: "This is an in-review post content with enough characters to pass validation requirements.",
            status: "in_review",
        });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // ==========================================
    // 1. FEATURED/TRENDING TOGGLE TESTS
    // ==========================================
    describe("Featured/Trending Toggle Functionality", () => {
        describe("PATCH /api/blog-posts/:id/featured", () => {
            it("should allow Editor to toggle featured status on published post", async () => {
                const res = await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/featured`)
                    .set("Authorization", `Bearer ${editorToken}`);

                expect(res.status).toBe(200);
                expect(res.body.STATUS).toBe(true);
                expect(res.body.DATA.isFeatured).toBe(true);
            });

            it("should toggle featured twice to restore original state (idempotency)", async () => {
                // First toggle
                await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/featured`)
                    .set("Authorization", `Bearer ${editorToken}`);

                // Second toggle
                const res = await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/featured`)
                    .set("Authorization", `Bearer ${editorToken}`);

                expect(res.status).toBe(200);
                expect(res.body.DATA.isFeatured).toBe(false); // Back to original
            });

            it("should prevent toggling featured on non-published posts", async () => {
                const res = await request(app)
                    .patch(`/api/blog-posts/${draftPost._id}/featured`)
                    .set("Authorization", `Bearer ${editorToken}`);

                expect(res.status).toBe(400);
                expect(res.body.STATUS).toBe(false);
                expect(res.body.MESSAGE).toBe("Only published posts can be featured.");
            });

            it("should prevent Collaborator from toggling featured", async () => {
                const res = await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/featured`)
                    .set("Authorization", `Bearer ${collaboratorToken}`);

                expect(res.status).toBe(403);
                expect(res.body.STATUS).toBe(false);
            });

            it("should prevent Admin from toggling featured", async () => {
                const res = await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/featured`)
                    .set("Authorization", `Bearer ${adminToken}`);

                expect(res.status).toBe(403);
                expect(res.body.STATUS).toBe(false);
            });

            it("should allow Super Admin to toggle featured", async () => {
                const res = await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/featured`)
                    .set("Authorization", `Bearer ${superAdminToken}`);

                expect(res.status).toBe(200);
                expect(res.body.STATUS).toBe(true);
                expect(res.body.DATA.isFeatured).toBe(true);
            });
        });

        describe("PATCH /api/blog-posts/:id/trending", () => {
            it("should allow Editor to toggle trending status on published post", async () => {
                const res = await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/trending`)
                    .set("Authorization", `Bearer ${editorToken}`);

                expect(res.status).toBe(200);
                expect(res.body.STATUS).toBe(true);
                expect(res.body.DATA.isTrending).toBe(true);
            });

            it("should toggle trending twice to restore original state (idempotency)", async () => {
                // First toggle
                await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/trending`)
                    .set("Authorization", `Bearer ${editorToken}`);

                // Second toggle
                const res = await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/trending`)
                    .set("Authorization", `Bearer ${editorToken}`);

                expect(res.status).toBe(200);
                expect(res.body.DATA.isTrending).toBe(false); // Back to original
            });

            it("should prevent toggling trending on non-published posts", async () => {
                const res = await request(app)
                    .patch(`/api/blog-posts/${draftPost._id}/trending`)
                    .set("Authorization", `Bearer ${editorToken}`);

                expect(res.status).toBe(400);
                expect(res.body.STATUS).toBe(false);
                expect(res.body.MESSAGE).toBe("Only published posts can be trending.");
            });

            it("should prevent Admin from toggling trending", async () => {
                const res = await request(app)
                    .patch(`/api/blog-posts/${publishedPost._id}/trending`)
                    .set("Authorization", `Bearer ${adminToken}`);

                expect(res.status).toBe(403);
                expect(res.body.STATUS).toBe(false);
            });
        });
    });

    // ==========================================
    // 2. NOTIFICATION TRIGGER TESTS
    // ==========================================
    describe("Notification Triggers", () => {
        it("should notify all Editors and Super Admins when post is submitted for review", async () => {
            // Create a new post with IN_REVIEW status
            const res = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "New Post For Review",
                    content: "This is new post content with enough characters to pass validation requirements and be submitted.",
                    status: "in_review",
                });

            expect(res.status).toBe(201);

            // Check notifications were created for Editor and Super Admin
            const notifications = await Notification.find({ type: "post_submitted" });

            expect(notifications.length).toBeGreaterThanOrEqual(2); // At least Editor + Super Admin

            const editorNotif = notifications.find(n => n.userId.toString() === editor._id.toString());
            const superAdminNotif = notifications.find(n => n.userId.toString() === superAdmin._id.toString());

            expect(editorNotif).toBeDefined();
            expect(superAdminNotif).toBeDefined();
        });

        it("should notify author when post is approved", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${inReviewPost._id}/approve`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({ editorFeedback: "Great work!" });

            expect(res.status).toBe(200);

            // Check notification was created for author
            const notification = await Notification.findOne({
                userId: collaborator._id,
                type: "post_approved",
            });

            expect(notification).toBeDefined();
            expect(notification.metadata.postId.toString()).toBe(inReviewPost._id.toString());
            expect(notification.metadata.postTitle).toBe(inReviewPost.title);
        });

        it("should notify author when post is rejected with feedback", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${inReviewPost._id}/reject`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({ editorFeedback: "Needs improvement" });

            expect(res.status).toBe(200);

            // Check notification was created for author
            const notification = await Notification.findOne({
                userId: collaborator._id,
                type: "post_rejected",
            });

            expect(notification).toBeDefined();
            expect(notification.metadata.postId.toString()).toBe(inReviewPost._id.toString());
            expect(notification.metadata.postTitle).toBe(inReviewPost.title);
            expect(notification.metadata.reviewNotes).toBe("Needs improvement");
        });

        it("should include correct metadata in all notifications", async () => {
            // Approve a post
            await request(app)
                .put(`/api/blog-posts/${inReviewPost._id}/approve`)
                .set("Authorization", `Bearer ${editorToken}`);

            const notification = await Notification.findOne({
                userId: collaborator._id,
                type: "post_approved",
            });

            // Verify metadata structure
            expect(notification.metadata).toHaveProperty("postId");
            expect(notification.metadata).toHaveProperty("postTitle");
            expect(notification.metadata.postId.toString()).toBe(inReviewPost._id.toString());
            expect(notification.metadata.postTitle).toBe(inReviewPost.title);
        });
    });

    // ==========================================
    // 3. EDITOR SELF-REVIEW PREVENTION TESTS
    // ==========================================
    describe("Editor Self-Review Prevention", () => {
        let editorOwnPost;

        beforeEach(async () => {
            // Create a post authored by the editor
            editorOwnPost = await BlogPost.create({
                authorId: editor._id,
                title: "Editor Own Post",
                slug: "editor-own-post",
                content: "This is the editor's own post content with enough characters to pass validation.",
                status: "in_review",
            });
        });

        it("should prevent Editor from approving their own post", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${editorOwnPost._id}/approve`)
                .set("Authorization", `Bearer ${editorToken}`);

            expect(res.status).toBe(403);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe("You cannot approve your own post.");
        });

        it("should prevent Editor from rejecting their own post", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${editorOwnPost._id}/reject`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({ editorFeedback: "Self rejection" });

            expect(res.status).toBe(403);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe("You cannot reject your own post.");
        });

        it("should allow Editor to approve/reject posts by others", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${inReviewPost._id}/approve`)
                .set("Authorization", `Bearer ${editorToken}`);

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
        });

        it("should allow Super Admin to approve/reject any post including their own", async () => {
            // Create a post authored by Super Admin
            const superAdminPost = await BlogPost.create({
                authorId: superAdmin._id,
                title: "Super Admin Post",
                slug: "super-admin-post",
                content: "This is the super admin's post content with enough characters to pass validation.",
                status: "in_review",
            });

            const res = await request(app)
                .put(`/api/blog-posts/${superAdminPost._id}/approve`)
                .set("Authorization", `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
        });
    });

    // ==========================================
    // 4. REVIEW QUEUE FILTERING TESTS
    // ==========================================
    describe("Review Queue Filtering", () => {
        let editorOwnPost;

        beforeEach(async () => {
            // Create a post authored by the editor
            editorOwnPost = await BlogPost.create({
                authorId: editor._id,
                title: "Editor Own Post In Review",
                slug: "editor-own-post-in-review",
                content: "This is the editor's own post in review with enough characters to pass validation.",
                status: "in_review",
            });
        });

        it("should exclude Editor's own posts from their review queue", async () => {
            const res = await request(app)
                .get("/api/blog-posts/queue")
                .set("Authorization", `Bearer ${editorToken}`);

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);

            // Should contain collaborator's post but not editor's own post
            const postIds = res.body.DATA.map(p => p._id.toString());
            expect(postIds).toContain(inReviewPost._id.toString());
            expect(postIds).not.toContain(editorOwnPost._id.toString());
        });

        it("should only show IN_REVIEW status posts in queue", async () => {
            const res = await request(app)
                .get("/api/blog-posts/queue")
                .set("Authorization", `Bearer ${editorToken}`);

            expect(res.status).toBe(200);

            // All posts in queue should have IN_REVIEW status
            res.body.DATA.forEach(post => {
                expect(post.status).toBe("in_review");
            });
        });

        it("should prevent Admin from accessing review queue", async () => {
            const res = await request(app)
                .get("/api/blog-posts/queue")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(403);
            expect(res.body.STATUS).toBe(false);
        });

        it("should allow Super Admin to access review queue", async () => {
            const res = await request(app)
                .get("/api/blog-posts/queue")
                .set("Authorization", `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(Array.isArray(res.body.DATA)).toBe(true);
        });
    });

    // ==========================================
    // 5. GET MY POSTS TESTS
    // ==========================================
    describe("GET /api/blog-posts/my-posts", () => {
        it("should retrieve all posts created by the authenticated user", async () => {
            const res = await request(app)
                .get("/api/blog-posts/my-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`);

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(Array.isArray(res.body.DATA)).toBe(true);
            expect(res.body.DATA.length).toBe(3); // published, draft, inReview
        });

        it("should return posts of all statuses for the user", async () => {
            const res = await request(app)
                .get("/api/blog-posts/my-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`);

            expect(res.status).toBe(200);

            const statuses = res.body.DATA.map(p => p.status);
            expect(statuses).toContain("published");
            expect(statuses).toContain("draft");
            expect(statuses).toContain("in_review");
        });

        it("should not return other users' posts", async () => {
            // Create a post by editor
            await BlogPost.create({
                authorId: editor._id,
                title: "Editor Post",
                slug: "editor-post-unique",
                content: "This is editor's post content with enough characters to pass validation.",
                status: "draft",
            });

            const res = await request(app)
                .get("/api/blog-posts/my-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`);

            expect(res.status).toBe(200);

            // All posts should belong to collaborator
            res.body.DATA.forEach(post => {
                expect(post.authorId.toString()).toBe(collaborator._id.toString());
            });
        });
    });
});
