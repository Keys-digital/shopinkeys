const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const BlogPost = require("../../models/BlogPost");
const StatusCodes = require("../../utils/statusCodes");
const { setupTestDB } = require("../../utils/testSetup");
const jwt = require("jsonwebtoken");

const seedTestDB = require("./seedTestDB");

jest.mock("../utils/logger", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

jest.mock("../repositories/auditLogRepository", () => ({
    logAudit: jest.fn().mockResolvedValue({}),
}));

jest.mock("../utils/plagiarism", () => ({
    checkPlagiarism: jest.fn(),
}));

jest.mock("../utils/seo", () => ({
    checkKGR: jest.fn(),
}));

setupTestDB();

// ✅ SEED DATABASE BEFORE ALL TESTS RUN
beforeAll(async () => {
    console.log("⚡ Seeding DB for editor_review tests...");
    await seedTestDB();
});

// 🔥 From here downward, NOTHING is changed — your original code remains
describe("Editor Review Workflow", () => {
    let editorUser, editorToken;
    let collaboratorUser, collaboratorToken;
    let otherCollaboratorUser, otherCollaboratorToken;

    beforeEach(async () => {
        // Create Editor
        editorUser = await User.create({
            name: "Editor User",
            username: "editor",
            email: "editor@example.com",
            password: "Password123!",
            role: "Editor",
            isEmailVerified: true,
        });
        editorToken = jwt.sign({ id: editorUser._id, role: "Editor" }, process.env.JWT_SECRET);

        // Create Collaborator
        collaboratorUser = await User.create({
            name: "Collaborator User",
            username: "collaborator",
            email: "collab@example.com",
            password: "Password123!",
            role: "Collaborator",
            isEmailVerified: true,
        });
        collaboratorToken = jwt.sign({ id: collaboratorUser._id, role: "Collaborator" }, process.env.JWT_SECRET);

        // Create Other Collaborator
        otherCollaboratorUser = await User.create({
            name: "Other Collaborator",
            username: "othercollab",
            email: "other@example.com",
            password: "Password123!",
            role: "Collaborator",
            isEmailVerified: true,
        });
        otherCollaboratorToken = jwt.sign({ id: otherCollaboratorUser._id, role: "Collaborator" }, process.env.JWT_SECRET);

        console.log(`DEBUG: Test Created Collaborator ID: ${collaboratorUser._id}`);
        console.log(`DEBUG: Collab Verified: ${collaboratorUser.isEmailVerified}`);
        console.log(`DEBUG: Editor ID: ${editorUser._id}`);
        console.log(`DEBUG: Editor Verified: ${editorUser.isEmailVerified}`);

        const decodedCollab = jwt.decode(collaboratorToken);
        console.log(`DEBUG: Decoded Collab Token ID: ${decodedCollab.id}`);

        const checkUser = await User.findById(collaboratorUser._id);
        console.log(`DEBUG: Test Verify User in DB: ${checkUser ? "Found" : "Not Found"}`);
        console.log(`DEBUG: DB User Verified: ${checkUser.isEmailVerified}`);
    });

    describe("Auto-Approve Logic", () => {
        const { checkPlagiarism } = require("../../utils/plagiarism");
        const { checkKGR } = require("../../utils/seo");

        beforeEach(() => {
            checkPlagiarism.mockResolvedValue(1.5); // Safe score
            checkKGR.mockResolvedValue(true); // Pass KGR
        });

        it("should auto-approve post with >1500 words and image (SEO type)", async () => {
            const longContent = "word ".repeat(1500);
            const response = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "High Quality Post",
                    content: longContent,
                    featuredImage: "https://example.com/image.jpg",
                    status: "in_review",
                    type: "seo"
                });

            expect(response.statusCode).toBe(StatusCodes.CREATED);
            expect(response.body.DATA.status).toBe("approved");
            expect(response.body.MESSAGE).toContain("auto-approved");
        });

        it("should auto-approve post with >300 words (News type)", async () => {
            const newsContent = "word ".repeat(350);
            const response = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "News Post",
                    content: newsContent,
                    featuredImage: "https://example.com/image.jpg",
                    status: "in_review",
                    type: "news"
                });

            expect(response.statusCode).toBe(StatusCodes.CREATED);
            expect(response.body.DATA.status).toBe("approved");
        });

        it("should NOT auto-approve if plagiarism is high", async () => {
            checkPlagiarism.mockResolvedValue(85.0); // High plagiarism
            const longContent = "word ".repeat(1500);

            const response = await request(app)
                .post("/api/blog-posts")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "Plagiarized Post",
                    content: longContent,
                    featuredImage: "https://example.com/image.jpg",
                    status: "in_review"
                });

            expect(response.statusCode).toBe(StatusCodes.CREATED);
            expect(response.body.DATA.status).toBe("in_review");
        });
    });

    describe("Review Queue Filtering", () => {
        it("should exclude editor's own posts from review queue", async () => {
            // Editor creates a post in review
            await BlogPost.create({
                authorId: editorUser._id,
                title: "Editor Post",
                slug: "editor-post",
                content: "Content",
                status: "in_review"
            });

            // Collaborator creates a post in review
            await BlogPost.create({
                authorId: collaboratorUser._id,
                title: "Collab Post",
                slug: "collab-post",
                content: "Content",
                status: "in_review"
            });

            const response = await request(app)
                .get("/api/blog-posts/queue")
                .set("Authorization", `Bearer ${editorToken}`);

            expect(response.statusCode).toBe(StatusCodes.OK);
            const posts = response.body.DATA;
            expect(posts.length).toBe(1);
            expect(posts[0].title).toBe("Collab Post");
        });
    });

    describe("Editor Permissions", () => {
        let collabPost;

        beforeEach(async () => {
            collabPost = await BlogPost.create({
                authorId: collaboratorUser._id,
                title: "Collab Post",
                slug: "collab-post",
                content: "Content",
                status: "in_review"
            });
        });

        it("should prevent editor from editing another user's post", async () => {
            const response = await request(app)
                .put(`/api/blog-posts/${collabPost._id}`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({
                    title: "Edited Title"
                });

            expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
            expect(response.body.MESSAGE).toBe("You are not authorized to edit this post.");
        });

        it("should prevent editor from approving their own post", async () => {
            const editorPost = await BlogPost.create({
                authorId: editorUser._id,
                title: "Editor Own Post",
                slug: "editor-own-post",
                content: "Content",
                status: "in_review"
            });

            const response = await request(app)
                .put(`/api/blog-posts/${editorPost._id}/approve`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({});

            expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
            expect(response.body.MESSAGE).toBe("You cannot approve your own post.");
        });
    });

    describe("Editor Promotion & Assignment", () => {
        let adminUser, adminToken;

        beforeEach(async () => {
            adminUser = await User.create({
                name: "Admin User",
                username: "admin",
                email: "admin@example.com",
                password: "Password123!",
                role: "Admin",
                isEmailVerified: true,
            });
            adminToken = jwt.sign({ id: adminUser._id, role: "Admin" }, process.env.JWT_SECRET);
        });

        it("should initiate promotion flow for Collaborator", async () => {
            const response = await request(app)
                .put(`/api/collaborator/${collaboratorUser._id}/promote`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(StatusCodes.OK);
            expect(response.body.MESSAGE).toContain("Promotion initiated");

            const updatedUser = await User.findById(collaboratorUser._id);
            expect(updatedUser.promotionStatus).toBe("pending_promotion");
            expect(updatedUser.role).toBe("Collaborator"); // Role shouldn't change yet
        });

        it("should allow Collaborator to accept promotion", async () => {
            // First initiate
            await User.findByIdAndUpdate(collaboratorUser._id, {
                promotionStatus: "pending_promotion",
                promotionInitiatedAt: new Date()
            });

            const response = await request(app)
                .put(`/api/collaborator/promotion/accept`)
                .set("Authorization", `Bearer ${collaboratorToken}`);

            expect(response.statusCode).toBe(StatusCodes.OK);
            expect(response.body.MESSAGE).toContain("Promotion accepted");

            const updatedUser = await User.findById(collaboratorUser._id);
            expect(updatedUser.role).toBe("Editor");
            expect(updatedUser.promotionStatus).toBe("accepted");
        });

        it("should allow Editor to assign categories to Collaborator", async () => {
            const categories = ["Tech", "Lifestyle"];
            const response = await request(app)
                .put(`/api/collaborator/${collaboratorUser._id}/assign-category`)
                .set("Authorization", `Bearer ${editorToken}`)
                .send({ categories });

            expect(response.statusCode).toBe(StatusCodes.OK);
            expect(response.body.MESSAGE).toBe("Categories assigned successfully.");

            const updatedUser = await User.findById(collaboratorUser._id);
            expect(updatedUser.assignedCategories).toEqual(expect.arrayContaining(categories));
        });

        describe("Post Publishing & Updates", () => {
            let approvedPost;

            beforeEach(async () => {
                approvedPost = await BlogPost.create({
                    authorId: collaboratorUser._id,
                    title: "Approved Post",
                    slug: "approved-post",
                    content: "Content",
                    status: "approved",
                    featuredImage: "https://example.com/image.jpg"
                });
            });

            it("should allow collaborator to publish an approved post", async () => {
                const response = await request(app)
                    .put(`/api/blog-posts/${approvedPost._id}`)
                    .set("Authorization", `Bearer ${collaboratorToken}`)
                    .send({ status: "published" });

                expect(response.statusCode).toBe(StatusCodes.OK);
                expect(response.body.DATA.status).toBe("published");
                expect(response.body.DATA.publishedAt).toBeDefined();
            });

            it("should allow collaborator to update a published post without re-approval", async () => {
                // First publish it
                await BlogPost.findByIdAndUpdate(approvedPost._id, { status: "published", publishedAt: new Date() });

                const response = await request(app)
                    .put(`/api/blog-posts/${approvedPost._id}`)
                    .set("Authorization", `Bearer ${collaboratorToken}`)
                    .send({
                        content: "Updated Content",
                        status: "published" // Explicitly keeping it published
                    });

                expect(response.statusCode).toBe(StatusCodes.OK);
                expect(response.body.DATA.content).toBe("Updated Content");
                expect(response.body.DATA.status).toBe("published");
            });
        });
    });
});
