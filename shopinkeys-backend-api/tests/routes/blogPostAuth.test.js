const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const BlogPost = require("../../models/BlogPost");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const envConfig = require("../../config/envConfig");

describe("Blog Post Routes - Authorization Tests", () => {
    let collaborator1;
    let collaborator2;
    let editor;
    let collaborator1Token;
    let collaborator2Token;
    let editorToken;
    let collaborator1Post;
    let collaborator2Post;

    beforeAll(async () => {
        // Create test users
        collaborator1 = await User.create({
            name: "Collaborator One",
            email: "collab1@example.com",
            username: "collab1",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });

        collaborator2 = await User.create({
            name: "Collaborator Two",
            email: "collab2@example.com",
            username: "collab2",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });

        editor = await User.create({
            name: "Test Editor",
            email: "editor@example.com",
            username: "editor",
            password: "hashedpassword123",
            role: "Editor",
            isEmailVerified: true,
        });

        // Generate tokens
        collaborator1Token = jwt.sign(
            { id: collaborator1._id },
            envConfig.JWT_SECRET,
            { expiresIn: "1h" }
        );

        collaborator2Token = jwt.sign(
            { id: collaborator2._id },
            envConfig.JWT_SECRET,
            { expiresIn: "1h" }
        );

        editorToken = jwt.sign({ id: editor._id }, envConfig.JWT_SECRET, {
            expiresIn: "1h",
        });

        // Create test posts
        collaborator1Post = await BlogPost.create({
            authorId: collaborator1._id,
            title: "Collaborator 1 Post",
            slug: "collaborator-1-post",
            content: "This is collaborator 1's post content",
            status: "draft",
        });

        collaborator2Post = await BlogPost.create({
            authorId: collaborator2._id,
            title: "Collaborator 2 Post",
            slug: "collaborator-2-post",
            content: "This is collaborator 2's post content",
            status: "draft",
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
        await BlogPost.deleteMany({});
    });

    describe("PUT /api/blog-posts/:id - Ownership Authorization", () => {
        it("should allow collaborator to update their own post", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${collaborator1Post._id}`)
                .set("Authorization", `Bearer ${collaborator1Token}`)
                .send({
                    title: "Updated Title",
                    content: "Updated content for my own post",
                });

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.title).toBe("Updated Title");
        });

        it("should prevent collaborator from updating another collaborator's post", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${collaborator2Post._id}`)
                .set("Authorization", `Bearer ${collaborator1Token}`)
                .send({
                    title: "Trying to update someone else's post",
                    content: "This should fail",
                });

            expect(res.status).toBe(403);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe("You can only update your own posts.");
        });

        it("should prevent editor from directly editing another user's post", async () => {
            const res = await request(app)
                .put(`/api/blog-posts/${collaborator1Post._id}`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({
                    title: "Editor trying to edit",
                    content: "Editors should use approve/reject workflow",
                });

            expect(res.status).toBe(403);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toContain("approve/reject workflow");
        });

        it("should allow editor to update their own post if they are the author", async () => {
            const editorPost = await BlogPost.create({
                authorId: editor._id,
                title: "Editor's Own Post",
                slug: "editor-own-post",
                content: "Editor's content",
                status: "draft",
            });

            const res = await request(app)
                .put(`/api/blog-posts/${editorPost._id}`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({
                    title: "Editor updating own post",
                    content: "This should work",
                });

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
        });
    });

    describe("POST /api/blog-posts - Input Validation", () => {
        it("should return 400 for missing required fields", async () => {
            const res = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaborator1Token}`)
                .send({
                    title: "Short", // Too short
                });

            expect(res.status).toBe(400);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe("Validation failed");
        });

        it("should return 400 for title too short", async () => {
            const res = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaborator1Token}`)
                .send({
                    title: "Short",
                    content: "This is some content that is long enough to pass validation requirements",
                });

            expect(res.status).toBe(400);
            const titleError = res.body.ERRORS?.find((e) => e.field === "title");
            expect(titleError).toBeDefined();
        });

        it("should return 400 for content too short", async () => {
            const res = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaborator1Token}`)
                .send({
                    title: "Valid Title Here",
                    content: "Too short",
                });

            expect(res.status).toBe(400);
            const contentError = res.body.ERRORS?.find(
                (e) => e.field === "content"
            );
            expect(contentError).toBeDefined();
        });
    });
});
