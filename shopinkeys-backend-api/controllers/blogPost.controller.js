const BlogPost = require("../models/BlogPost");
const PostInteraction = require("../models/PostInteraction");
const logger = require("../utils/logger");
const { logAudit } = require("../repositories/auditLogRepository");
const { postProcessingQueue } = require("../services/postProcessingQueue");

/**
 * Helper: Check for Auto-Approve
 * Criteria:
 * - Word count based on type:
 *   - SEO-focused: >= 1500
 *   - News/Updates: 300-1200
 *   - Tutorials: >= 2000
 * - Featured image OR video present
 * - Plagiarism < 3%
 * - Keyword analysis passed
 */
const checkAutoApprove = async (content, featuredImage, type = "seo", keyword = "", media = []) => {
    if (!content) return false;

    // Basic word count
    const wordCount = content.trim().split(/\s+/).length;
    let isLengthSufficient = false;

    switch (type) {
        case "news":
            isLengthSufficient = wordCount >= 300 && wordCount <= 1200;
            break;
        case "tutorial":
            isLengthSufficient = wordCount >= 2000;
            break;
        case "seo":
        default:
            isLengthSufficient = wordCount >= 1500;
    }

    // Check for featured image OR video content
    const hasImage = !!featuredImage;
    const hasVideo = media && media.some(item => item.type === "video");
    const hasMediaContent = hasImage || hasVideo;

    // Async checks
    const plagiarismScore = await checkPlagiarism(content);
    const isPlagiarismLow = plagiarismScore < 3.0;

    const isKeywordsOptimized = await checkKGR(content, keyword);

    return (
        isLengthSufficient &&
        hasMediaContent &&
        isPlagiarismLow &&
        isKeywordsOptimized
    );
};

/**
 * Create a new blog post
 * POST /api/blog-posts
 * Access: Collaborator
 */
exports.createPost = async (req, res) => {
    try {
        const { title, content, excerpt, featuredImage, media, tags, category, status, keywords, canonicalUrl, metaDescription } = req.body;

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");

        // Check if slug exists
        const existingPost = await BlogPost.findOne({ slug });
        if (existingPost) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "A post with this title already exists.",
            });
        }

        const newPost = new BlogPost({
            authorId: req.user._id,
            title,
            slug,
            content,
            excerpt,
            featuredImage,
            media,
            tags,
            category,
            keywords,
            canonicalUrl,
            metaDescription,
            status: status === "published" ? "draft" : status || "draft", // Force draft or in_review, prevent direct publish
        });

        if (status === "in_review") {
            // Enqueue background job for plagiarism/KGR checks
            const type = req.body.type || "seo";
            const mainKeyword = req.body.mainKeyword || "";

            // Set initial status to processing
            newPost.status = "in_review";
            await newPost.save();

            // Enqueue background job (non-blocking)
            await postProcessingQueue.add("process-post", {
                postId: newPost._id.toString(),
                content,
                keyword: mainKeyword,
            });

            logger.info(`Post ${newPost._id} enqueued for processing`);
        } else {
            await newPost.save();
        }

        logger.info(`Blog post created by user: ${req.user.email}`);

        res.status(201).json({
            STATUS_CODE: 201,
            STATUS: true,
            MESSAGE: newPost.status === "approved" ? "Blog post created and auto-approved!" : "Blog post created successfully.",
            DATA: newPost,
        });
    } catch (error) {
        logger.error(`Error creating blog post: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Update a blog post
 * PUT /api/blog-posts/:id
 * Access: Collaborator (own posts), Editor, Admin
 */
/**
 * Update a blog post
 * PUT /api/blog-posts/:id
 * Access: Collaborator (own posts), Editor, Admin
 */
exports.updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const post = await BlogPost.findById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Blog post not found.",
            });
        }

        // CRITICAL: Collaborators can only update their own posts
        // Editors/Admins should use approve/reject workflow, not direct edits
        if (req.user.role === "Collaborator" && post.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "You can only update your own posts.",
            });
        }

        // Editors and Admins should not directly edit post content
        // They should use the approve/reject workflow
        if ((req.user.role === "Editor" || req.user.role === "Admin" || req.user.role === "Super Admin") &&
            post.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "Editors and Admins cannot directly edit posts. Use the approve/reject workflow instead.",
            });
        }

        // Check ownership: Collaborators AND Editors can only edit their own posts
        // Admins/Super Admins can edit any post (optional, but requirements say Editors cannot edit others)
        if (
            (req.user.role === "Collaborator" || req.user.role === "Editor") &&
            post.authorId.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "You are not authorized to edit this post.",
            });
        }

        // Collaborator updating a published post: allow but keep status published
        if (req.user.role === "Collaborator" && updates.status === "published") {
            // If post is already published → allow update, keep published
            if (post.status === "published") {
                updates.status = "published"; // Ensure no change
            }
            else if (post.status !== "approved") {
                // Prevent publishing from non-approved state
                return res.status(400).json({
                    STATUS_CODE: 400,
                    STATUS: false,
                    MESSAGE: "Approval required to publish posts.",
                });
            } else {
                // Approved → publishing for the first time
                post.publishedAt = new Date();
            }
        }


        // Update fields
        Object.keys(updates).forEach((key) => {
            if (key !== "authorId" && key !== "_id") { // Protect immutable fields
                post[key] = updates[key];
            }
        });

        // If collaborator updates a rejected post, move back to draft or in_review
        if (req.user.role === "Collaborator" && post.status === "rejected") {
            post.status = "draft";
        }

        // Auto-Approve Logic on Update
        if (updates.status === "in_review") {
            const type = updates.type || post.type || "seo";
            const mainKeyword = updates.mainKeyword || post.mainKeyword || "";

            if (await checkAutoApprove(post.content, post.featuredImage, type, mainKeyword, post.media)) {
                post.status = "approved";
                post.editorFeedback = "Auto-approved by system (met quality criteria).";
                post.reviewedBy = null;

                await logAudit({
                    userId: req.user._id,
                    action: "AUTO_APPROVE_POST",
                    targetUserId: req.user._id,
                    details: `Auto-approved post update: ${post.title}`,
                    ipAddress: req.ip,
                    userAgent: req.get("User-Agent"),
                });
            }
        }

        await post.save();

        logger.info(`Blog post updated by user: ${req.user.email}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: post.status === "approved" ? "Blog post updated and auto-approved!" : "Blog post updated successfully.",
            DATA: post,
        });
    } catch (error) {
        logger.error(`Error updating blog post: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get my posts
 * GET /api/blog-posts/my-posts
 * Access: Collaborator
 */
exports.getMyPosts = async (req, res) => {
    try {
        const posts = await BlogPost.find({ authorId: req.user._id }).sort({ createdAt: -1 });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "My posts retrieved successfully.",
            DATA: posts,
        });
    } catch (error) {
        logger.error(`Error fetching my posts: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get review queue
 * GET /api/blog-posts/queue
 * Access: Editor, Admin
 */
exports.getReviewQueue = async (req, res) => {
    try {
        // Editors cannot see their own posts in the review queue
        const query = { status: "in_review" };
        if (req.user.role === "Editor") {
            query.authorId = { $ne: req.user._id };
        }

        const posts = await BlogPost.find(query)
            .populate("authorId", "name email")
            .sort({ createdAt: 1 });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Review queue retrieved successfully.",
            DATA: posts,
        });
    } catch (error) {
        logger.error(`Error fetching review queue: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Approve post
 * PUT /api/blog-posts/:id/approve
 * Access: Editor, Admin
 */
exports.approvePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { editorFeedback } = req.body;

        const post = await BlogPost.findById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Prevent self-approval
        if (post.authorId.toString() === req.user._id.toString()) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "You cannot approve your own post.",
            });
        }

        post.status = "approved"; // Changed from published to approved
        post.reviewedBy = req.user._id;
        // post.publishedAt = new Date(); // Removed, publishedAt is set when collaborator publishes
        if (editorFeedback) post.editorFeedback = editorFeedback;

        await post.save();

        await logAudit({
            userId: req.user._id,
            action: "APPROVE_POST",
            targetUserId: post.authorId,
            details: `Approved post: ${post.title}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Post approved. Collaborator can now publish it.",
            DATA: post,
        });
    } catch (error) {
        logger.error(`Error approving post: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Reject post
 * PUT /api/blog-posts/:id/reject
 * Access: Editor, Admin
 */
exports.rejectPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { editorFeedback } = req.body;

        const post = await BlogPost.findById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Prevent self-rejection (though less critical, good for consistency)
        if (post.authorId.toString() === req.user._id.toString()) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "You cannot reject your own post.",
            });
        }

        post.status = "rejected";
        post.reviewedBy = req.user._id;
        post.editorFeedback = editorFeedback || "Post rejected.";

        await post.save();

        await logAudit({
            userId: req.user._id,
            action: "REJECT_POST",
            targetUserId: post.authorId,
            details: `Rejected post: ${post.title}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Post rejected.",
            DATA: post,
        });
    } catch (error) {
        logger.error(`Error rejecting post: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get all public posts (published)
 * GET /api/blog-posts/public
 * Access: Public
 */
exports.getAllPublicPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10, category, tag } = req.query;

        // Build filter for published posts only
        const filter = { status: "published" };
        if (category) filter.category = category;
        if (tag) filter.tags = tag;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const posts = await BlogPost.find(filter)
            .select("title slug excerpt featuredImage publishedAt category tags")
            .populate("authorId", "name username")
            .sort({ publishedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await BlogPost.countDocuments(filter);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Public posts retrieved successfully.",
            DATA: {
                posts,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalPosts: total,
                    limit: parseInt(limit),
                },
            },
        });
    } catch (error) {
        logger.error(`Error fetching public posts: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get public post by slug
 * GET /api/blog-posts/public/:slug
 * Access: Public
 */

exports.getPostBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const post = await BlogPost.findOne({ slug, status: "published" })
            .populate("authorId", "name email"); // Should populate collaborator profile ideally

        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Track view with deduplication (6-hour window)
        // Ideally this should be async or handled by a separate service to not block response
        // For MVP, we'll do it here but catch errors so it doesn't fail the request
        try {
            const PostInteraction = require("../models/PostInteraction");
            const userId = req.user ? req.user._id : null;
            const ipAddress = req.ip;

            // Check for recent view from same IP or user (6-hour deduplication window)
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
            const query = {
                postId: post._id,
                type: "view",
                createdAt: { $gte: sixHoursAgo },
            };

            // Check by IP address or userId (whichever is available)
            if (userId) {
                query.userId = userId;
            } else {
                query.ipAddress = ipAddress;
            }

            const existingView = await PostInteraction.findOne(query);

            // Only track if no recent view found
            if (!existingView) {
                const refSource = req.query.ref || req.get("Referer") || "direct";
                const country = req.get("CF-IPCountry") || "Unknown"; // Cloudflare header or similar

                const newView = new PostInteraction({
                    postId: post._id,
                    userId: userId,
                    type: "view",
                    ipAddress: ipAddress,
                    userAgent: req.get("User-Agent"),
                    refSource: refSource,
                    country: country,
                });
                await newView.save();
            }
        } catch (viewError) {
            logger.error(`Error tracking view: ${viewError.message}`);
        }

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Post retrieved successfully.",
            DATA: post,
        });
    } catch (error) {
        logger.error(`Error fetching public post: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Upload media
 * POST /api/blog-posts/upload
 * Access: Collaborator
 */
exports.uploadMedia = async (req, res) => {
    // Placeholder for S3 upload
    // In a real implementation, middleware would handle the upload and req.file would be available
    // or we would generate a presigned URL.
    try {
        if (!req.file) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "No file uploaded.",
            });
        }

        // Validate file type and size (if not done in middleware)
        // Assuming middleware handles it, just return the location

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "File uploaded successfully.",
            DATA: {
                url: req.file.location || "https://placeholder-s3-url.com/image.jpg", // Mock
            },
        });
    } catch (error) {
        logger.error(`Error uploading media: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Like a post
 * POST /api/blog-posts/:id/like
 * Access: Registered User, Collaborator, Admin
 */
exports.likePost = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                STATUS_CODE: 401,
                STATUS: false,
                MESSAGE: "You must be logged in to like posts",
            });
        }

        const { id } = req.params;

        const post = await BlogPost.findById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        const existingLike = await PostInteraction.findOne({
            postId: id,
            userId: req.user._id,
            type: "like",
        });

        if (existingLike) {
            await PostInteraction.findByIdAndDelete(existingLike._id);
            return res.status(200).json({
                STATUS_CODE: 200,
                STATUS: true,
                MESSAGE: "Post unliked.",
            });
        }

        const newLike = new PostInteraction({
            postId: id,
            userId: req.user._id,
            type: "like",
        });

        await newLike.save();

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Post liked.",
        });
    } catch (error) {
        logger.error(`Error liking post: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Rate a post
 * POST /api/blog-posts/:id/rate
 * Access: Registered User, Collaborator, Admin
 */
exports.ratePost = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                STATUS_CODE: 401,
                STATUS: false,
                MESSAGE: "You must be logged in to rate posts",
            });
        }

        const { id } = req.params;
        const { rating } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Rating must be between 1 and 5.",
            });
        }

        const post = await BlogPost.findById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        const existingRating = await PostInteraction.findOne({
            postId: id,
            userId: req.user._id,
            type: "rating",
        });

        if (existingRating) {
            existingRating.ratingValue = rating;
            await existingRating.save();
        } else {
            const newRating = new PostInteraction({
                postId: id,
                userId: req.user._id,
                type: "rating",
                ratingValue: rating,
            });
            await newRating.save();
        }

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Post rated successfully.",
        });
    } catch (error) {
        logger.error(`Error rating post: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Comment on a post
 * POST /api/blog-posts/:id/comment
 * Access: Registered User, Collaborator, Admin
 */
exports.commentOnPost = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                STATUS_CODE: 401,
                STATUS: false,
                MESSAGE: "You must be logged in to comment on posts",
            });
        }

        const { id } = req.params;
        const { comment } = req.body;

        if (!comment) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Comment cannot be empty.",
            });
        }

        const post = await BlogPost.findById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        if (!post.isCommentsEnabled) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "Comments are disabled for this post.",
            });
        }

        const newComment = new PostInteraction({
            postId: id,
            userId: req.user._id,
            type: "comment",
            content: comment,
        });

        await newComment.save();

        res.status(201).json({
            STATUS_CODE: 201,
            STATUS: true,
            MESSAGE: "Comment added successfully.",
            DATA: newComment,
        });
    } catch (error) {
        logger.error(`Error commenting on post: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Share a post (with permission check)
 * POST /api/blog-posts/:id/share
 * Access: Registered User (with approved share request)
 */
exports.sharePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { platform } = req.body;
        const userId = req.user._id;

        const post = await BlogPost.findById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Check if user has permission to share
        const ShareRequest = require("../models/ShareRequest");
        const shareRequest = await ShareRequest.findOne({
            postId: id,
            requestedBy: userId,
            status: "approved",
        });

        if (!shareRequest) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "You do not have permission to share this post. Please submit a share request first.",
            });
        }

        // Check if permission has expired
        if (shareRequest.expiresAt && new Date() > shareRequest.expiresAt) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "Your share permission has expired. Please submit a new request.",
            });
        }

        // Check if platform is in approved platforms
        if (platform && !shareRequest.platforms.includes(platform)) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: `You are not approved to share on ${platform}. Approved platforms: ${shareRequest.platforms.join(", ")}`,
            });
        }

        // Track the share
        const newShare = new PostInteraction({
            postId: id,
            userId,
            type: "share",
            refSource: platform || "other",
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        await newShare.save();

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Share tracked successfully.",
            DATA: {
                shareUrl: `https://shopinkeys.com/posts/${post.slug}`,
                platform,
            },
        });
    } catch (error) {
        logger.error(`Error tracking share: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get related posts
 * GET /api/blog-posts/:id/related
 * Access: Public
 */
exports.getRelatedPosts = async (req, res) => {
    try {
        const { id } = req.params;

        const post = await BlogPost.findById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Find posts with same category or tags, excluding current post
        const relatedPosts = await BlogPost.find({
            _id: { $ne: id },
            status: "published",
            $or: [
                { category: post.category },
                { tags: { $in: post.tags } }
            ]
        })
            .limit(3)
            .select("title slug featuredImage excerpt publishedAt");

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Related posts retrieved successfully.",
            DATA: relatedPosts,
        });
    } catch (error) {
        logger.error(`Error fetching related posts: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};
