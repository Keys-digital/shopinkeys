const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const envConfig = require("../config/envConfig");
const logger = require("../utils/logger");

// Redis connection for BullMQ
const connection = new IORedis({
    host: envConfig.REDIS_HOST || "localhost",
    port: envConfig.REDIS_PORT || 6379,
    password: envConfig.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
});

// Post Processing Queue
const postProcessingQueue = new Queue("post-processing", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000,
        },
        removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
    },
});

// Post Processing Worker
const postProcessingWorker = new Worker(
    "post-processing",
    async (job) => {
        const { postId, content, keyword } = job.data;
        logger.info(`Processing post ${postId}...`);

        try {
            const BlogPost = require("../models/BlogPost");
            const { checkPlagiarism } = require("../utils/plagiarism");
            const { checkKGR } = require("../utils/seo");

            // Run plagiarism and KGR checks
            const plagiarismScore = await checkPlagiarism(content);
            const isKeywordsOptimized = await checkKGR(content, keyword);

            const isPlagiarismLow = plagiarismScore < 3.0;

            // Update post status based on results
            const post = await BlogPost.findById(postId);
            if (!post) {
                throw new Error(`Post ${postId} not found`);
            }

            // Auto-approve if checks pass
            if (isPlagiarismLow && isKeywordsOptimized) {
                post.status = "approved";
                post.plagiarismScore = plagiarismScore;
                post.kgrPassed = isKeywordsOptimized;
                await post.save();

                logger.info(`Post ${postId} auto-approved after processing`);
                return {
                    success: true,
                    status: "approved",
                    plagiarismScore,
                    kgrPassed: isKeywordsOptimized,
                };
            } else {
                // Keep in review if checks fail
                post.status = "in_review";
                post.plagiarismScore = plagiarismScore;
                post.kgrPassed = isKeywordsOptimized;
                await post.save();

                logger.info(
                    `Post ${postId} kept in review - plagiarism: ${plagiarismScore}%, KGR: ${isKeywordsOptimized}`
                );
                return {
                    success: true,
                    status: "in_review",
                    plagiarismScore,
                    kgrPassed: isKeywordsOptimized,
                };
            }
        } catch (error) {
            logger.error(`Error processing post ${postId}: ${error.message}`);
            throw error; // Will trigger retry
        }
    },
    {
        connection,
        concurrency: 5, // Process up to 5 jobs concurrently
    }
);

// Worker event listeners
postProcessingWorker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed successfully`);
});

postProcessingWorker.on("failed", (job, err) => {
    logger.error(`Job ${job.id} failed: ${err.message}`);
});

postProcessingWorker.on("error", (err) => {
    logger.error(`Worker error: ${err.message}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, closing queue and worker...");
    await postProcessingQueue.close();
    await postProcessingWorker.close();
    await connection.quit();
});

module.exports = {
    postProcessingQueue,
    postProcessingWorker,
};
