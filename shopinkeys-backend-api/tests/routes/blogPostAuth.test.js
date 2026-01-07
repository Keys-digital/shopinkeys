const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const BlogPost = require("../../models/BlogPost");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const envConfig = require("../../config/envConfig");
const i18n = require("../../config/i18nConfig");

describe("Blog Post Routes - Authorization Tests", () => {
    let collaborator1, collaborator2, editor;
    let collaborator1Token, collaborator2Token, editorToken;
    let collaborator1Post, collaborator2Post;

    // Helper to create users and posts
    async function createTestData() {
        const collab1 = await User.create({
            name: "Collaborator One",
            email: "collab1@example.com",
            username: "collab1",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });

        const collab2 = await User.create({
            name: "Collaborator Two",
            email: "collab2@example.com",
            username: "collab2",
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

        const collab1Token = jwt.sign({ id: collab1._id }, envConfig.JWT_SECRET, { expiresIn: "1h" });
        const collab2Token = jwt.sign({ id: collab2._id }, envConfig.JWT_SECRET, { expiresIn: "1h" });
        const editorToken = jwt.sign({ id: ed._id }, envConfig.JWT_SECRET, { expiresIn: "1h" });

        const collab1Post = await BlogPost.create({
            authorId: collab1._id,
            title: "Collaborator 1 Post",
            slug: "collaborator-1-post",
            content: "This is collaborator 1's post content",
            status: "draft",
        });

        const collab2Post = await BlogPost.create({
            authorId: collab2._id,
            title: "Collaborator 2 Post",
            slug: "collaborator-2-post",
            content: "This is collaborator 2's post content",
            status: "draft",
        });

        return {
            collab1, collab2, ed,
            collab1Token, collab2Token, editorToken,
            collab1Post, collab2Post
        };
    }

    beforeEach(async () => {
        // Clear collections
        await User.deleteMany({});
        await BlogPost.deleteMany({});

        // Create fresh data
        const data = await createTestData();
        collaborator1 = data.collab1;
        collaborator2 = data.collab2;
        editor = data.ed;
        collaborator1Token = data.collab1Token;
        collaborator2Token = data.collab2Token;
        editorToken = data.editorToken;
        collaborator1Post = data.collab1Post;
        collaborator2Post = data.collab2Post;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe("PUT /api/blog-posts/:id - Ownership Authorization", () => {
        it("should allow collaborator to update their own post", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${collaborator1Post._id}`)
                .set("Authorization", `Bearer ${collaborator1Token}`)
                .send({ title: "Updated Title", content: "Updated content ".repeat(10) });

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.title).toBe("Updated Title");
        });

        it("should prevent collaborator from updating another collaborator's post", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${collaborator2Post._id}`)
                .set("Authorization", `Bearer ${collaborator1Token}`)
                .send({ title: "Fail Update", content: "Should fail" });

            expect(res.status).toBe(403);
            expect(res.body.STATUS).toBe(false);
        });

        it("should prevent editor from editing another user's post", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${collaborator1Post._id}`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({ title: "Editor Try", content: "Should fail" });

            expect(res.status).toBe(403);
            expect(res.body.STATUS).toBe(false);
        });

        it("should reject editor update when content is below minimum length", async () => {
            const editorPost = await BlogPost.create({
                authorId: editor._id,
                title: "Editor Post",
                slug: "editor-post",
                content: "Editor content",
                status: "draft",
            });

            const res = await request(app)
                .put(`/api/blog-posts/${editorPost._id}`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({ title: "Updated Editor Post", content: "Updated" });

            expect(res.status).toBe(400);
            expect(res.body.ERRORS).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: "content",
                        message: "validation.blog.content_min",
                    }),
                ])
            );
        });

        describe("POST /api/blog-posts - Input Validation", () => {
            it("should return 400 for missing required fields", async () => {
                const res = await request(app)
                    .post("/api/blog-posts")
                    .set("Authorization", `Bearer ${collaborator1Token}`)
                    .send({ title: "Short" }); // missing content

                expect(res.status).toBe(400);
                expect(res.body.STATUS).toBe(false);
                expect(res.status).toBe(400);
                expect(res.body.STATUS).toBe(false);
                expect(res.body.MESSAGE).toBe(i18n.t("validation.failed"));
                expect(res.body.ERRORS).toBeDefined();
                expect(res.body.ERRORS).toBeDefined();
                expect(res.body.ERRORS.length).toBeGreaterThan(0);
            });

            it("should return 400 for title too short", async () => {
                const res = await request(app)
                    .post("/api/blog-posts")
                    .set("Authorization", `Bearer ${collaborator1Token}`)
                    .send({
                        title: "Short",  // <10 chars
                        content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit." // >100 chars
                    });

                expect(res.status).toBe(400);
                expect(res.body.STATUS).toBe(false);
                expect(res.status).toBe(400);
                expect(res.body.STATUS).toBe(false);
                expect(res.body.MESSAGE).toBe(i18n.t("validation.failed"));
                expect(res.body.ERRORS).toBeDefined();
                expect(res.body.ERRORS).toBeDefined();
                expect(res.body.ERRORS.length).toBeGreaterThan(0);
            });

            it("should return 400 for content too short", async () => {
                const res = await request(app)
                    .post("/api/blog-posts")
                    .set("Authorization", `Bearer ${collaborator1Token}`)
                    .send({
                        title: "Valid Title Here", // >=10 chars
                        content: "Too short"       // <100 chars
                    })

                expect(res.status).toBe(400);
                expect(res.body.STATUS).toBe(false);
                expect(res.status).toBe(400);
                expect(res.body.STATUS).toBe(false);
                expect(res.body.MESSAGE).toBe(i18n.t("validation.failed"));
                expect(res.body.ERRORS).toBeDefined();
                expect(res.body.ERRORS).toBeDefined();
                expect(res.body.ERRORS.length).toBeGreaterThan(0);
            });
        });
    });
});
