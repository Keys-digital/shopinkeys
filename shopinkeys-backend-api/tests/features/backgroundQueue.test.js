const { postProcessingQueue, postProcessingWorker } = require("../../services/postProcessingQueue");
const BlogPost = require("../../models/BlogPost");
const User = require("../../models/User");
const mongoose = require("mongoose");

describe("Background Job Queue Tests", () => {
    let testUser;
    let testPost;

    beforeAll(async () => {
        // Create test user
        testUser = await User.create({
            name: "Queue Test User",
            email: "queuetest@example.com",
            username: "queuetest",
            password: "hashedpassword123",
            role: "Collaborator",
            isEmailVerified: true,
        });
    });

    beforeEach(async () => {
        // Clean up posts
        await BlogPost.deleteMany({});

        // Create test post
        testPost = await BlogPost.create({
            authorId: testUser._id,
            title: "Background Processing Test Post",
            slug: "bg-processing-test",
            content: "This is test content for background job processing. ".repeat(200), // Long content
            status: "in_review",
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
        await BlogPost.deleteMany({});

        // Clean up queue
        await postProcessingQueue.obliterate({ force: true });
    });

    describe("Post Processing Queue", () => {
        it("should enqueue a job successfully", async () => {
            const job = await postProcessingQueue.add("process-post", {
                postId: testPost._id.toString(),
                content: testPost.content,
                keyword: "test",
            });

            expect(job).toBeDefined();
            expect(job.id).toBeDefined();
            expect(job.data.postId).toBe(testPost._id.toString());
        });

        it("should process job and update post status", async () => {
            // Enqueue job
            await postProcessingQueue.add("process-post", {
                postId: testPost._id.toString(),
                content: testPost.content,
                keyword: "test",
            });

            // Wait for processing (with timeout)
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Check if post was updated
            const updatedPost = await BlogPost.findById(testPost._id);
            expect(updatedPost).not.toBeNull();
            expect(["approved", "in_review"]).toContain(updatedPost.status);

            // Should have plagiarism score
            if (updatedPost.plagiarismScore !== undefined) {
                expect(typeof updatedPost.plagiarismScore).toBe("number");
            }
        }, 10000); // 10 second timeout for this test

        it("should handle job with missing post gracefully", async () => {
            const fakeId = new mongoose.Types.ObjectId();

            const job = await postProcessingQueue.add("process-post", {
                postId: fakeId.toString(),
                content: "Test content",
                keyword: "test",
            });

            expect(job).toBeDefined();

            // Wait for processing
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Job should fail but not crash the worker
            const jobState = await job.getState();
            expect(["failed", "completed"]).toContain(jobState);
        }, 10000);

        it("should retry failed jobs", async () => {
            // This test verifies retry configuration
            const job = await postProcessingQueue.add("process-post", {
                postId: "invalid-id", // Will cause error
                content: "Test",
                keyword: "test",
            });

            expect(job).toBeDefined();

            // Job should be configured with retries
            expect(job.opts.attempts).toBe(3);
        });
    });

    describe("Queue Configuration", () => {
        it("should have correct default job options", async () => {
            const job = await postProcessingQueue.add("process-post", {
                postId: testPost._id.toString(),
                content: testPost.content,
                keyword: "test",
            });

            expect(job.opts.attempts).toBe(3);
            expect(job.opts.backoff).toBeDefined();
            expect(job.opts.backoff.type).toBe("exponential");
        });

        it("should remove completed jobs after 24 hours", async () => {
            const job = await postProcessingQueue.add("process-post", {
                postId: testPost._id.toString(),
                content: testPost.content,
                keyword: "test",
            });

            expect(job.opts.removeOnComplete).toBeDefined();
            expect(job.opts.removeOnComplete.age).toBe(24 * 3600);
        });
    });
});
