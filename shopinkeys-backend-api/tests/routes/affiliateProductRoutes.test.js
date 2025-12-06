const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const AffiliateProduct = require("../../models/AffiliateProduct");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const envConfig = require("../../config/envConfig");

describe("Affiliate Product Routes - Guest Access", () => {
    let testCollaborator;
    let testAdmin;
    let approvedProduct;
    let pendingProduct;
    let collaboratorToken;
    let adminToken;

    // Helper function to create test users and products
    async function createTestUsersAndProducts() {
        const collaborator = await User.create({
            name: "Test Collaborator",
            email: "collaborator@example.com",
            username: "collaborator",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });

        const admin = await User.create({
            name: "Test Admin",
            email: "admin@example.com",
            username: "admin",
            password: "hashedpassword123",
            role: "Admin",
            isEmailVerified: true,
        });

        const approved = await AffiliateProduct.create({
            title: "Approved Product",
            description: "This is an approved product",
            image: "https://example.com/image.jpg",
            affiliateUrl: "https://example.com/product",
            price: 29.99,
            niche: "Tech",
            partner: "Amazon",
            addedBy: collaborator._id,
            approved: true,
            clicks: 0,
        });

        const pending = await AffiliateProduct.create({
            title: "Pending Product",
            description: "This is a pending product",
            affiliateUrl: "https://example.com/pending",
            addedBy: collaborator._id,
            approved: false,
        });

        const collabToken = jwt.sign(
            { id: collaborator._id },
            envConfig.JWT_SECRET,
            { expiresIn: "1h" }
        );

        const adminTok = jwt.sign(
            { id: admin._id },
            envConfig.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return {
            collaborator,
            admin,
            approved,
            pending,
            collaboratorToken: collabToken,
            adminToken: adminTok,
        };
    }

    beforeEach(async () => {
        // Clear collections before each test for complete isolation
        await User.deleteMany({});
        await AffiliateProduct.deleteMany({});

        // Create fresh test data
        const seed = await createTestUsersAndProducts();
        testCollaborator = seed.collaborator;
        testAdmin = seed.admin;
        approvedProduct = seed.approved;
        pendingProduct = seed.pending;
        collaboratorToken = seed.collaboratorToken;
        adminToken = seed.adminToken;
    });

    afterAll(async () => {
        // Final cleanup
        await User.deleteMany({});
        await AffiliateProduct.deleteMany({});
    });

    describe("GET /api/affiliate-products - Public Access", () => {
        it("should return all approved products for guests", async () => {
            const res = await request(app).get("/api/affiliate-products");

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.products).toBeInstanceOf(Array);
            expect(res.body.DATA.products.length).toBe(1);
            expect(res.body.DATA.products[0].title).toBe("Approved Product");
        });

        it("should not return pending products", async () => {
            const res = await request(app).get("/api/affiliate-products");

            expect(res.status).toBe(200);
            const titles = res.body.DATA.products.map((p) => p.title);
            expect(titles).not.toContain("Pending Product");
        });

        it("should support filtering by niche", async () => {
            const res = await request(app)
                .get("/api/affiliate-products")
                .query({ niche: "Tech" });

            expect(res.status).toBe(200);
            expect(res.body.DATA.products.length).toBe(1);
            expect(res.body.DATA.products[0].niche).toBe("Tech");
        });

        it("should support pagination", async () => {
            const res = await request(app)
                .get("/api/affiliate-products")
                .query({ page: 1, limit: 10 });

            expect(res.status).toBe(200);
            expect(res.body.DATA.pagination.currentPage).toBe(1);
            expect(res.body.DATA.pagination.limit).toBe(10);
        });
    });

    describe("GET /api/affiliate-products/:id - Public Access", () => {
        it("should return an approved product by ID for guests", async () => {
            const res = await request(app).get(
                `/api/affiliate-products/${approvedProduct._id}`
            );

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.title).toBe("Approved Product");
        });

        it("should return 404 for pending products", async () => {
            const res = await request(app).get(
                `/api/affiliate-products/${pendingProduct._id}`
            );

            expect(res.status).toBe(404);
            expect(res.body.STATUS).toBe(false);
        });
    });

    describe("POST /api/affiliate-products/:id/click - Public Access", () => {
        it("should track clicks for guests", async () => {
            const res = await request(app).post(
                `/api/affiliate-products/${approvedProduct._id}/click`
            );

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.MESSAGE).toBe("Click tracked successfully.");
            expect(res.body.DATA.clicks).toBe(1);
        });
    });

    describe("POST /api/affiliate-products - Collaborator Access", () => {
        it("should allow collaborators to submit products", async () => {
            const res = await request(app)
                .post("/api/affiliate-products")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "New Product",
                    description: "A new product",
                    affiliateUrl: "https://temu.com/product3",
                    price: 29.99,
                    niche: "Home",
                    partner: "Temu",
                });

            expect(res.status).toBe(201);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.MESSAGE).toContain("Pending approval");
            expect(res.body.DATA.approved).toBe(false);
        });

        it("should require authentication for product submission", async () => {
            const res = await request(app)
                .post("/api/affiliate-products")
                .send({
                    title: "New Product",
                    affiliateUrl: "https://temu.com/product3",
                });

            expect(res.status).toBe(401);
        });
    });

    describe("PUT /api/affiliate-products/:id/approve - Admin Access", () => {
        it("should allow admins to approve products", async () => {
            const res = await request(app)
                .put(`/api/affiliate-products/${pendingProduct._id}/approve`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reviewNotes: "Looks good!" });

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.MESSAGE).toBe("Product approved successfully.");
            expect(res.body.DATA.approved).toBe(true);
        });

        it("should require authentication for approval", async () => {
            const res = await request(app).put(
                `/api/affiliate-products/${pendingProduct._id}/approve`
            );

            expect(res.status).toBe(401);
        });
    });

    describe("PUT /api/affiliate-products/:id/reject - Admin Access", () => {
        it("should allow admins to reject products with soft delete", async () => {
            const res = await request(app)
                .put(`/api/affiliate-products/${pendingProduct._id}/reject`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reviewNotes: "Not suitable" });

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.MESSAGE).toContain("rejected");
            expect(res.body.DATA.rejected).toBe(true);

            // Verify product was NOT deleted, just marked as rejected
            const rejectedProduct = await AffiliateProduct.findById(
                pendingProduct._id
            );
            expect(rejectedProduct).not.toBeNull();
            expect(rejectedProduct.rejected).toBe(true);
            expect(rejectedProduct.approved).toBe(false);
            expect(rejectedProduct.reviewNotes).toBe("Not suitable");
        });

        it("should not return rejected products in public listing", async () => {
            // First reject a product
            await request(app)
                .put(`/api/affiliate-products/${pendingProduct._id}/reject`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reviewNotes: "Not suitable" });

            // Then verify it's not in public listing
            const res = await request(app).get("/api/affiliate-products");

            expect(res.status).toBe(200);
            const titles = res.body.DATA.products.map((p) => p.title);
            expect(titles).not.toContain("Pending Product");
        });
    });

    describe("DELETE /api/affiliate-products/:id - Admin Access", () => {
        it("should soft delete products instead of hard delete", async () => {
            const res = await request(app)
                .delete(`/api/affiliate-products/${approvedProduct._id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);

            // Verify product still exists but is marked as deleted
            const deletedProduct = await AffiliateProduct.findById(
                approvedProduct._id
            );
            expect(deletedProduct).not.toBeNull();
            expect(deletedProduct.deleted).toBe(true);
            expect(deletedProduct.deletedAt).toBeDefined();
        });

        it("should not return deleted products in public listing", async () => {
            // First delete a product
            await request(app)
                .delete(`/api/affiliate-products/${approvedProduct._id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            // Then verify it's not in public listing
            const res = await request(app).get("/api/affiliate-products");

            expect(res.status).toBe(200);
            expect(res.body.DATA.products.length).toBe(0);
        });
    });

    describe("POST /api/affiliate-products/:id/click - Click Deduplication", () => {
        it("should track first click successfully", async () => {
            const res = await request(app).post(
                `/api/affiliate-products/${approvedProduct._id}/click`
            );

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.clicks).toBe(1);
        });

        it("should prevent duplicate clicks within 1 hour (same IP)", async () => {
            // First click
            await request(app).post(
                `/api/affiliate-products/${approvedProduct._id}/click`
            );

            // Second click from same IP within 1 hour
            const res = await request(app).post(
                `/api/affiliate-products/${approvedProduct._id}/click`
            );

            expect(res.status).toBe(429);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toContain("already tracked recently");
        });

        it("should store click details (IP, userAgent, timestamp)", async () => {
            await request(app)
                .post(`/api/affiliate-products/${approvedProduct._id}/click`)
                .set("User-Agent", "Test Browser");

            const product = await AffiliateProduct.findById(approvedProduct._id);
            expect(product.clicksDetail.length).toBe(1);
            expect(product.clicksDetail[0].ipAddress).toBeDefined();
            expect(product.clicksDetail[0].userAgent).toBe("Test Browser");
            expect(product.clicksDetail[0].timestamp).toBeDefined();
        });
    });

    describe("POST /api/affiliate-products - Input Validation", () => {
        it("should return 400 for missing required fields", async () => {
            const res = await request(app)
                .post("/api/affiliate-products")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    description: "Missing title and URL",
                });

            expect(res.status).toBe(400);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe("Validation failed");
            expect(res.body.ERRORS).toBeDefined();
        });

        it("should return 400 for invalid URL format", async () => {
            const res = await request(app)
                .post("/api/affiliate-products")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "Invalid URL Product",
                    affiliateUrl: "not-a-valid-url",
                });

            expect(res.status).toBe(400);
            expect(res.body.ERRORS).toBeDefined();
            const urlError = res.body.ERRORS.find(
                (e) => e.field === "affiliateUrl"
            );
            expect(urlError).toBeDefined();
        });

        it("should return 400 for negative price", async () => {
            const res = await request(app)
                .post("/api/affiliate-products")
                .set("Authorization", `Bearer ${collaboratorToken}`)
                .send({
                    title: "Negative Price Product",
                    affiliateUrl: "https://example.com/product",
                    price: -10,
                });

            expect(res.status).toBe(400);
            expect(res.body.ERRORS).toBeDefined();
        });
    });
});
