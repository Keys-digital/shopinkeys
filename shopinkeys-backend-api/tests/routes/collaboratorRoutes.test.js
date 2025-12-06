const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const CollaboratorRequest = require("../../models/CollaboratorRequest");
const CollaboratorProfile = require("../../models/CollaboratorProfile");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const envConfig = require("../../config/envConfig");

describe("Collaborator Routes - Guest Access", () => {
    let testUser;
    let testCollaborator;
    let userToken;
    let collaboratorProfile;

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
            username: "testcollaborator",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });

        // Generate auth token
        userToken = jwt.sign({ id: testUser._id }, envConfig.JWT_SECRET, {
            expiresIn: "1h",
        });

        // Create collaborator profile
        collaboratorProfile = await CollaboratorProfile.create({
            userId: testCollaborator._id,
            username: "testcollaborator",
            displayName: "Test Collaborator",
            bio: "I am a test collaborator",
            niche: "Tech",
            isActive: true,
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
        await CollaboratorRequest.deleteMany({});
        await CollaboratorProfile.deleteMany({});
    });

    describe("GET /api/collaborator/public/:username - Public Access", () => {
        it("should return public collaborator profile for guests", async () => {
            const res = await request(app).get(
                `/api/collaborator/public/${collaboratorProfile.username}`
            );

            expect(res.status).toBe(200);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.DATA.username).toBe("testcollaborator");
            expect(res.body.DATA.displayName).toBe("Test Collaborator");
            expect(res.body.DATA.bio).toBe("I am a test collaborator");
        });

        it("should return 404 for non-existent collaborator", async () => {
            const res = await request(app).get(
                "/api/collaborator/public/nonexistent"
            );

            expect(res.status).toBe(404);
            expect(res.body.STATUS).toBe(false);
        });
    });

    describe("POST /api/collaborator/request - Guest Restriction", () => {
        it("should return 401 for guests trying to apply as collaborator", async () => {
            const res = await request(app)
                .post("/api/collaborator/request")
                .send({
                    requestMessage: "I want to be a collaborator",
                    niche: "Tech",
                });

            expect(res.status).toBe(401);
            expect(res.body.STATUS).toBe(false);
            expect(res.body.MESSAGE).toBe(
                "You must be a registered user to apply"
            );
        });

        it("should allow authenticated users to apply as collaborator", async () => {
            const res = await request(app)
                .post("/api/collaborator/request")
                .set("Authorization", `Bearer ${userToken}`)
                .send({
                    requestMessage: "I want to be a collaborator",
                    niche: "Tech",
                });

            expect(res.status).toBe(201);
            expect(res.body.STATUS).toBe(true);
            expect(res.body.MESSAGE).toBe(
                "Collaborator request submitted successfully."
            );
        });
    });
});
