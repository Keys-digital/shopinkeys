const blogPostRepository = require("../repositories/blogPostRepository");
const PostInteraction = require("../models/PostInteraction");
const logger = require("../utils/logger");
const { logAudit } = require("../repositories/auditLogRepository");
const { postProcessingQueue } = require("../services/postProcessingQueue");
const { createPostSchema, updatePostSchema } = require("../utils/validationSchemas");
const { POST_STATUS, AUDIT_ACTIONS, INTERACTION_TYPES, ROLES } = require("../constants");

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

    // Async checks (mocked for now or handled by implementation)
    // const plagiarismScore = await checkPlagiarism(content);
    // const isPlagiarismLow = plagiarismScore < 3.0;
    const isPlagiarismLow = true; // Placeholder

    // const isKeywordsOptimized = await checkKGR(content, keyword);
    const isKeywordsOptimized = true; // Placeholder

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
        const { error, value } = createPostSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: error.details[0].message,
            });
        }

        const { title, content, excerpt, featuredImage, media, tags, category, status, keywords, canonicalUrl, metaDescription, type, mainKeyword } = value;

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");

        // Check if slug exists
        const existingPost = await blogPostRepository.findPostBySlug(slug);
        if (existingPost) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "A post with this title already exists.",
            });
        }

        const newPost = await blogPostRepository.createPost({
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
            status: status === POST_STATUS.PUBLISHED ? POST_STATUS.DRAFT : status || POST_STATUS.DRAFT,
        });

        if (status === POST_STATUS.IN_REVIEW) {
            // Ensure status is set (though createPost likely handled it if passed correctly)
            if (newPost.status !== POST_STATUS.IN_REVIEW) {
                newPost.status = POST_STATUS.IN_REVIEW;
                await blogPostRepository.savePost(newPost);
            }

            // Enqueue background job (non-blocking)
            await postProcessingQueue.add("process-post", {
                postId: newPost._id.toString(),
                content,
                keyword: mainKeyword || "",
            });

            logger.info(`Post ${newPost._id} enqueued for processing`);
        }

        logger.info(`Blog post created by user: ${req.user.email}`);

        res.status(201).json({
            STATUS_CODE: 201,
            STATUS: true,
            MESSAGE: newPost.status === POST_STATUS.APPROVED ? "Blog post created and auto-approved!" : "Blog post created successfully.",
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
exports.updatePost = async (req, res) => {
    try {
        const { id } = req.params;

        const { error, value } = updatePostSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: error.details[0].message,
            });
        }

        const post = await blogPostRepository.findPostById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Blog post not found.",
            });
        }

        // Check ownership & Authorization
        const isAuthor = post.authorId.toString() === req.user._id.toString();
        const isCollaborator = req.user.role === ROLES.COLLABORATOR;
        const isEditorOrAdmin = [ROLES.EDITOR, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role);

        if (isCollaborator && !isAuthor) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "You can only update your own posts.",
            });
        }

        if (isEditorOrAdmin && !isAuthor) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "Editors and Admins cannot directly edit posts. Use the approve/reject workflow instead.",
            });
        }

        // Collaborator updating a published post
        if (isCollaborator && value.status === POST_STATUS.PUBLISHED) {
            if (post.status === POST_STATUS.PUBLISHED) {
                // No change needed
            } else if (post.status !== POST_STATUS.APPROVED) {
                return res.status(400).json({
                    STATUS_CODE: 400,
                    STATUS: false,
                    MESSAGE: "Approval required to publish posts.",
                });
            } else {
                post.publishedAt = new Date();
            }
        }

        // Update fields
        Object.keys(value).forEach((key) => {
            post[key] = value[key];
        });

        // If collaborator updates a rejected post, move back to draft or in_review based on input, or default to draft
        if (isCollaborator && post.status === POST_STATUS.REJECTED) {
            post.status = value.status || POST_STATUS.DRAFT;
        }

        // Auto-Approve Logic on Update
        if (value.status === POST_STATUS.IN_REVIEW) {
            const type = value.type || post.type || "seo";
            const mainKeyword = value.mainKeyword || post.mainKeyword || "";

            if (await checkAutoApprove(post.content, post.featuredImage, type, mainKeyword, post.media)) {
                post.status = POST_STATUS.APPROVED;
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

        await blogPostRepository.savePost(post);

        logger.info(`Blog post updated by user: ${req.user.email}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: post.status === POST_STATUS.APPROVED ? "Blog post updated and auto-approved!" : "Blog post updated successfully.",
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
        const posts = await blogPostRepository.findMyPosts(req.user._id);

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
        const query = { status: POST_STATUS.IN_REVIEW };
        if (req.user.role === ROLES.EDITOR) {
            query.authorId = { $ne: req.user._id };
        }

        const posts = await blogPostRepository.findPostsForReview(query);

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

        const post = await blogPostRepository.findPostById(id);
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

        post.status = POST_STATUS.APPROVED;
        post.reviewedBy = req.user._id;
        if (editorFeedback) post.editorFeedback = editorFeedback;

        await blogPostRepository.savePost(post);

        await logAudit({
            userId: req.user._id,
            action: AUDIT_ACTIONS.APPROVE_POST,
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

        const post = await blogPostRepository.findPostById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Prevent self-rejection
        if (post.authorId.toString() === req.user._id.toString()) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "You cannot reject your own post.",
            });
        }

        post.status = POST_STATUS.REJECTED;
        post.reviewedBy = req.user._id;
        post.editorFeedback = editorFeedback || "Post rejected.";

        await blogPostRepository.savePost(post);

        await logAudit({
            userId: req.user._id,
            action: AUDIT_ACTIONS.REJECT_POST,
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
        const filter = { status: POST_STATUS.PUBLISHED };
        if (category) filter.category = category;
        if (tag) filter.tags = tag;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const posts = await blogPostRepository.findPosts(filter, skip, parseInt(limit));
        const total = await blogPostRepository.countPosts(filter);

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
        const post = await blogPostRepository.findPostBySlug(slug, { status: POST_STATUS.PUBLISHED });

        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Track view with deduplication (6-hour window)
        try {
            const userId = req.user?._id ?? req.authenticatedUserId ?? null;
            const ipAddress = req.ip;

            // Check for recent view from same IP or user (6-hour deduplication window)
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
            const query = {
                postId: post._id,
                type: INTERACTION_TYPES.VIEW,
                createdAt: { $gte: sixHoursAgo },
            };

            // Check by IP address or userId
            if (userId) {
                query.userId = userId;
            } else {
                query.ipAddress = ipAddress;
            }

            const existingView = await PostInteraction.findOne(query);

            if (!existingView) {
                const refSource = req.query.ref || req.get("Referer") || "direct";
                const country = req.get("CF-IPCountry") || "Unknown";

                const newView = new PostInteraction({
                    postId: post._id,
                    userId: userId,
                    type: INTERACTION_TYPES.VIEW,
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
    try {
        if (!req.file) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "No file uploaded.",
            });
        }

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
        if (!req.user) {
            return res.status(401).json({
                STATUS_CODE: 401,
                STATUS: false,
                MESSAGE: "You must be logged in to like posts",
            });
        }

        const { id } = req.params;

        const post = await blogPostRepository.findPostById(id);
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
            type: INTERACTION_TYPES.LIKE,
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
            type: INTERACTION_TYPES.LIKE,
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

        const post = await blogPostRepository.findPostById(id);
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
            type: INTERACTION_TYPES.RATING,
        });

        if (existingRating) {
            existingRating.ratingValue = rating;
            await existingRating.save();
        } else {
            const newRating = new PostInteraction({
                postId: id,
                userId: req.user._id,
                type: INTERACTION_TYPES.RATING,
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

        const post = await blogPostRepository.findPostById(id);
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
            type: INTERACTION_TYPES.COMMENT,
            content: comment,
        });

        await newComment.save();

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Comment added successfully.",
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
 * Share a post
 * POST /api/blog-posts/:id/share
 * Access: Registered User (with approved share request)
 */
exports.sharePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { platform } = req.body;

        const post = await blogPostRepository.findPostById(id);
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Logic check: User must have approved share request
        // For now, simpler implementation mainly for tracking the share action

        const newShare = new PostInteraction({
            postId: id,
            userId: req.user._id,
            type: INTERACTION_TYPES.SHARE,
            refSource: platform || "unknown",
        });

        await newShare.save();

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Share tracked successfully.",
        });
    } catch (error) {
        logger.error(`Error sharing post: ${error.message}`);
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
        const post = await blogPostRepository.findPostById(id);

        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Find posts with matching tags or category
        const relatedPosts = await blogPostRepository.findRelatedPosts(id, post.category, post.tags, 3);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Related posts retrieved.",
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
