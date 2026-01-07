const logger = require("../utils/logger");
const envConfig = require("../config/envConfig");

// Define worker processor function explicitly for testing and reuse
const processPostJob = async (job) => {
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
};

let postProcessingQueue;
let postProcessingWorker;

if (process.env.NODE_ENV === 'production') {
    const { Queue, Worker } = require("bullmq");
    const queueRedis = require("../config/queueRedis");

    // Post Processing Queue
    postProcessingQueue = new Queue("post-processing", {
        connection: queueRedis,
        prefix: "shopinkeys", // Use prefix here instead of Redis config
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
    postProcessingWorker = new Worker(
        "post-processing",
        processPostJob, // Use extracted function
        {
            connection: queueRedis,
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
        await queueRedis.quit();
    });

} else {
    // In-memory fallback for dev/test
    const jobs = [];
    postProcessingQueue = {
        add: async (name, data) => {
            const job = { id: jobs.length, name, data };
            jobs.push(job);

            logger.info(`[Dev/Test] Mock job added: ${name}`);

            try {
                await processPostJob(job);
            } catch (err) {
                logger.error(`[Dev/Test] Mock job failed: ${err.message}`);
            }

            return Promise.resolve({ id: job.id });
        },
        getJobs: async () => jobs,
        close: async () => { }
    };

    postProcessingWorker = {
        on: () => { },
        close: async () => { }
    };

    logger.info("Initialized in-memory queue fallback for dev/test environment");
}

module.exports = {
    postProcessingQueue,
    postProcessingWorker,
    processPostJob,
};
