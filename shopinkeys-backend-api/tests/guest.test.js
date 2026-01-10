const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const AffiliateProduct = require("../models/AffiliateProduct");
const User = require("../models/User");
const { AFFILIATE_PARTNERS, PLATFORMS } = require("../constants");

// Mock Data
const mockCollaborator = {
    name: "Collaborator User",
    email: "collab@example.com",
    password: "password123",
    role: "Collaborator",
    username: "collabuser",
};

describe("Guest Home Page API (User Story #12)", () => {
    let collaboratorUser;

    beforeAll(async () => {
        // Ensure disconnected before connecting to avoid multiple connection errors
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        await mongoose.connect(process.env.MONGODB_URI);

        await User.deleteMany({});
        await AffiliateProduct.deleteMany({});

        collaboratorUser = await User.create(mockCollaborator);

        // Seed products with different partners
        await Promise.all([
            AffiliateProduct.create({
                title: "Amazon Product",
                affiliateUrl: "https://amazon.com/product",
                addedBy: collaboratorUser._id,
                partner: AFFILIATE_PARTNERS.AMAZON,
                approved: true,
                deleted: false,
                price: 10,
            }),
            AffiliateProduct.create({
                title: "Temu Product",
                affiliateUrl: "https://temu.com/product",
                addedBy: collaboratorUser._id,
                partner: AFFILIATE_PARTNERS.TEMU,
                approved: true,
                deleted: false,
                price: 5,
            }),
            AffiliateProduct.create({
                title: "Unapproved Product",
                affiliateUrl: "https://other.com/product",
                addedBy: collaboratorUser._id,
                partner: AFFILIATE_PARTNERS.OTHER,
                approved: false,
            })
        ]);

    }, 30000);

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe("GET /api/public/branding-platforms", () => {
        it("should return branding platforms with separated primary and expanded lists", async () => {
            const res = await request(app).get("/api/public/branding-platforms");

            expect(res.statusCode).toBe(200);
            expect(res.body.STATUS).toBe(true);

            const { primary, expanded } = res.body.DATA;

            // Verify Primary List (Active Affiliates + VoltThread)
            expect(primary).toContain(AFFILIATE_PARTNERS.AMAZON);
            expect(primary).toContain(AFFILIATE_PARTNERS.TEMU);
            expect(primary).toContain(PLATFORMS.VOLTTHREAD);

            // Verify Expanded List (Affiliates + Integrations)
            expect(expanded).toContain(AFFILIATE_PARTNERS.AMAZON); // Affiliate partner SHOULD be in expanded
            expect(expanded).toContain(PLATFORMS.SHOPIFY);
            expect(expanded).toContain(PLATFORMS.TIKTOK);

            // Negative Assertions (Cross-Contamination Check)
            expect(primary).not.toContain(PLATFORMS.SHOPIFY); // Integration shouldn't be in primary
            expect(expanded).not.toContain(PLATFORMS.VOLTTHREAD); // VoltThread shouldn't be in expanded
        });
    });

    describe("GET /api/affiliate-products/partners", () => {
        it("should return only active affiliate product partners", async () => {
            const res = await request(app).get("/api/affiliate-products/partners");

            expect(res.statusCode).toBe(200);
            expect(res.body.STATUS).toBe(true);

            const partners = res.body.DATA;

            expect(partners).toContain(AFFILIATE_PARTNERS.AMAZON);
            expect(partners).toContain(AFFILIATE_PARTNERS.TEMU);

            // Should NOT contain VoltThread or Integration Platforms
            expect(partners).not.toContain(PLATFORMS.VOLTTHREAD);
            expect(partners).not.toContain(PLATFORMS.SHOPIFY);
        });
    });

    describe("GET /api/affiliate-products (Filtering)", () => {
        it("should filter products by partner", async () => {
            // Filter by Amazon
            const resAmazon = await request(app).get(`/api/affiliate-products?partner=${AFFILIATE_PARTNERS.AMAZON}`);
            expect(resAmazon.statusCode).toBe(200);
            expect(resAmazon.body.DATA.products.length).toBe(1);
            expect(resAmazon.body.DATA.products[0].partner).toBe(AFFILIATE_PARTNERS.AMAZON);

            // Filter by Temu
            const resTemu = await request(app).get(`/api/affiliate-products?partner=${AFFILIATE_PARTNERS.TEMU}`);
            expect(resTemu.statusCode).toBe(200);
            expect(resTemu.body.DATA.products.length).toBe(1);
            expect(resTemu.body.DATA.products[0].partner).toBe(AFFILIATE_PARTNERS.TEMU);
        });

        it("should return all approved products when no partner filter is applied", async () => {
            const res = await request(app).get("/api/affiliate-products");
            expect(res.statusCode).toBe(200);
            // Should match Amazon + Temu (2 total)
            expect(res.body.DATA.products.length).toBe(2);
        });
    });
});
