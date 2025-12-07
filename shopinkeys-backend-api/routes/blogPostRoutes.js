const express = require("express");
const { authenticateUser, optionalAuthenticateUser } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware");
const blogPostController = require("../controllers/blogPost.controller");

const { contentCreationLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

/**
 * @route   POST /api/blog-posts
 * @desc    Create a new blog post
 * @access  Collaborator
 * @rateLimit 10 submissions per hour per IP
 */
router.post(
    "/",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    contentCreationLimiter,
    blogPostController.createPost
);

/**
 * @route   GET /api/blog-posts/my-posts
 * @desc    Get current collaborator's posts
 * @access  Collaborator
 */
router.get(
    "/my-posts",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    blogPostController.getMyPosts
);

/**
 * @route   GET /api/blog-posts/queue
 * @desc    Get review queue
 * @access  Editor, Admin
 */
router.get(
    "/queue",
    authenticateUser,
    roleMiddleware(["Editor", "Admin", "Super Admin"]),
    blogPostController.getReviewQueue
);

/**
 * @route   POST /api/blog-posts/upload
 * @desc    Upload media
 * @access  Collaborator
 */
router.post(
    "/upload",
    authenticateUser,
    roleMiddleware(["Collaborator"]),
    blogPostController.uploadMedia
);

/**
 * @route   PUT /api/blog-posts/:id/approve
 * @desc    Approve a post
 * @access  Editor, Admin
 */
router.put(
    "/:id/approve",
    authenticateUser,
    roleMiddleware(["Editor", "Admin", "Super Admin"]),
    blogPostController.approvePost
);

/**
 * @route   PUT /api/blog-posts/:id/reject
 * @desc    Reject a post
 * @access  Editor, Admin
 */
router.put(
    "/:id/reject",
    authenticateUser,
    roleMiddleware(["Editor", "Admin", "Super Admin"]),
    blogPostController.rejectPost
);

/**
 * @route   PUT /api/blog-posts/:id
 * @desc    Update a blog post
 * @access  Collaborator, Editor, Admin
 */
router.put(
    "/:id",
    authenticateUser,
    roleMiddleware(["Collaborator", "Editor", "Admin", "Super Admin"]),
    blogPostController.updatePost
);

/**
 * @route   GET /api/blog-posts/public
 * @desc    Get all published blog posts
 * @access  Public
 */
router.get(
    "/public",
    optionalAuthenticateUser,
    blogPostController.getAllPublicPosts
);

/**
 * @route   GET /api/blog-posts/public/:slug
 * @desc    Get public post by slug
 * @access  Public
 */

router.get(
    "/public/:slug",
    optionalAuthenticateUser,
    blogPostController.getPostBySlug
);

/**
 * @route   POST /api/blog-posts/:id/like
 * @desc    Like a post
 * @access  Registered User, Collaborator, Admin
 */
router.post(
    "/:id/like",
    authenticateUser,
    blogPostController.likePost
);

/**
 * @route   POST /api/blog-posts/:id/rate
 * @desc    Rate a post
 * @access  Registered User, Collaborator, Admin
 */
router.post(
    "/:id/rate",
    authenticateUser,
    blogPostController.ratePost
);

/**
 * @route   POST /api/blog-posts/:id/comment
 * @desc    Comment on a post
 * @access  Registered User, Collaborator, Admin
 */
router.post(
    "/:id/comment",
    authenticateUser,
    blogPostController.commentOnPost
);

/**
 * @route   POST /api/blog-posts/:id/share
 * @desc    Track post share (requires approved share request)
 * @access  Registered User (with approved share request)
 */
router.post(
    "/:id/share",
    authenticateUser,
    blogPostController.sharePost
);

/**
 * @route   GET /api/blog-posts/:id/related
 * @desc    Get related posts
 * @access  Public
 */
router.get(
    "/:id/related",
    optionalAuthenticateUser,
    blogPostController.getRelatedPosts
);

module.exports = router;
