const ShareRequest = require("../models/ShareRequest");
const BlogPost = require("../models/BlogPost");
const User = require("../models/User");
const logger = require("../utils/logger");
const { logAudit } = require("../repositories/auditLogRepository");
const { sendEmail } = require("../services/emailService");
const { shareRequestRejectionTemplate } = require("../services/emailTemplates");
const { createNotification } = require("../repositories/notificationRepository");

/**
 * Submit a share request
 * POST /api/share-requests
 * Access: Registered User
 */
exports.submitShareRequest = async (req, res) => {
    try {
        const { postId, requestMessage, platforms } = req.body;
        const userId = req.user._id;

        // Validate required fields
        if (!postId || !platforms || platforms.length === 0) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Post ID and at least one platform are required.",
            });
        }

        // Check if post exists
        const post = await BlogPost.findById(postId).populate("authorId");
        if (!post) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Post not found.",
            });
        }

        // Check if post is published
        if (post.status !== "published") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "You can only request to share published posts.",
            });
        }

        // Check if user already has a pending or approved request
        const existingRequest = await ShareRequest.findOne({
            postId,
            requestedBy: userId,
        });

        if (existingRequest) {
            if (existingRequest.status === "pending") {
                return res.status(400).json({
                    STATUS_CODE: 400,
                    STATUS: false,
                    MESSAGE: "You already have a pending share request for this post.",
                });
            }
            if (existingRequest.status === "approved") {
                return res.status(400).json({
                    STATUS_CODE: 400,
                    STATUS: false,
                    MESSAGE: "You already have permission to share this post.",
                });
            }
        }

        // Create new share request
        const newRequest = new ShareRequest({
            postId,
            requestedBy: userId,
            collaboratorId: post.authorId._id,
            requestMessage,
            platforms,
            status: "pending",
        });

        await newRequest.save();

        logger.info(`Share request submitted by user ${req.user.email} for post ${post.title}`);

        res.status(201).json({
            STATUS_CODE: 201,
            STATUS: true,
            MESSAGE: "Share request submitted successfully.",
            DATA: newRequest,
        });
    } catch (error) {
        logger.error(`Error submitting share request: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get all share requests for a collaborator's posts
 * GET /api/share-requests/my-requests
 * Access: Collaborator, Admin
 */
exports.getMyShareRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const userId = req.user._id;

        const filter = { collaboratorId: userId };
        if (status) {
            filter.status = status;
        }

        const requests = await ShareRequest.find(filter)
            .populate("postId", "title slug")
            .populate("requestedBy", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            DATA: requests,
        });
    } catch (error) {
        logger.error(`Error fetching share requests: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get user's own share requests
 * GET /api/share-requests/my-submissions
 * Access: Registered User
 */
exports.getMySubmissions = async (req, res) => {
    try {
        const userId = req.user._id;

        const requests = await ShareRequest.find({ requestedBy: userId })
            .populate("postId", "title slug")
            .populate("collaboratorId", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            DATA: requests,
        });
    } catch (error) {
        logger.error(`Error fetching user submissions: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get all share requests (Admin analytics/audit only)
 * GET /api/share-requests/all
 * Access: Admin, Super Admin (VIEW ONLY - cannot approve/reject)
 */
exports.getAllShareRequests = async (req, res) => {
    try {
        const { status, collaboratorId, requestedBy } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (collaboratorId) filter.collaboratorId = collaboratorId;
        if (requestedBy) filter.requestedBy = requestedBy;

        const requests = await ShareRequest.find(filter)
            .populate("postId", "title slug")
            .populate("requestedBy", "name email")
            .populate("collaboratorId", "name email")
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Admin view only - Approval/rejection is the sole responsibility of the collaborator.",
            DATA: requests,
        });
    } catch (error) {
        logger.error(`Error fetching all share requests: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Approve a share request
 * PUT /api/share-requests/:id/approve
 * Access: Collaborator (post owner ONLY)
 */
exports.approveShareRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewNotes, expiresInDays } = req.body;
        const userId = req.user._id;

        const request = await ShareRequest.findById(id)
            .populate("postId")
            .populate("requestedBy", "name email");

        if (!request) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Share request not found.",
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: `Request has already been ${request.status}.`,
            });
        }

        // CRITICAL: Only the collaborator who owns the post can approve
        // Admins CANNOT approve - they can only view for analytics/audit
        const isCollaboratorOwner = request.collaboratorId.toString() === userId.toString();

        if (!isCollaboratorOwner) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "Only the collaborator who owns this post can approve share requests. Approval is the sole responsibility of the post owner.",
            });
        }

        // Update request
        request.status = "approved";
        request.reviewedBy = userId;
        request.reviewNotes = reviewNotes || "";

        // Set expiration if provided
        if (expiresInDays) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);
            request.expiresAt = expiresAt;
        }

        await request.save();

        // Log audit
        await logAudit({
            userId,
            action: "APPROVE_SHARE_REQUEST",
            targetUserId: request.requestedBy._id,
            details: `Approved share request for post: ${request.postId.title}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        logger.info(`Share request approved by collaborator ${req.user.email} for post ${request.postId.title}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Share request approved successfully.",
            DATA: request,
        });
    } catch (error) {
        logger.error(`Error approving share request: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Reject a share request
 * PUT /api/share-requests/:id/reject
 * Access: Collaborator (post owner ONLY)
 */
exports.rejectShareRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewNotes } = req.body;
        const userId = req.user._id;

        const request = await ShareRequest.findById(id)
            .populate("postId")
            .populate("requestedBy", "name email");

        if (!request) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Share request not found.",
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: `Request has already been ${request.status}.`,
            });
        }

        // CRITICAL: Only the collaborator who owns the post can reject
        // Admins CANNOT reject - they can only view for analytics/audit
        const isCollaboratorOwner = request.collaboratorId.toString() === userId.toString();

        if (!isCollaboratorOwner) {
            return res.status(403).json({
                STATUS_CODE: 403,
                STATUS: false,
                MESSAGE: "Only the collaborator who owns this post can reject share requests. Approval/rejection is the sole responsibility of the post owner.",
            });
        }

        // Update request
        request.status = "rejected";
        request.reviewedBy = userId;
        request.reviewNotes = reviewNotes || "Request declined.";
        await request.save();

        // Send rejection email notification
        try {
            const emailHtml = shareRequestRejectionTemplate(
                request.requestedBy.name,
                request.postId.title,
                request.reviewNotes
            );
            await sendEmail({
                to: request.requestedBy.email,
                subject: "Share Request Update - ShopInKeys",
                html: emailHtml,
            });
            logger.info(`Rejection email sent to ${request.requestedBy.email}`);
        } catch (emailError) {
            logger.error(`Failed to send rejection email: ${emailError.message}`);
            // Don't fail the rejection if email fails
        }

        // Create in-app notification
        try {
            await createNotification({
                userId: request.requestedBy._id,
                type: "share_request_rejected",
                title: "Share Request Declined",
                message: `Your request to share "${request.postId.title}" has been declined by the content creator. ${reviewNotes ? 'Please check your email for their message.' : ''}`,
                metadata: {
                    requestId: request._id,
                    postId: request.postId._id,
                    postTitle: request.postId.title,
                    reviewNotes: request.reviewNotes,
                },
            });
            logger.info(`In-app notification created for user ${request.requestedBy._id}`);
        } catch (notificationError) {
            logger.error(`Failed to create in-app notification: ${notificationError.message}`);
            // Don't fail the rejection if notification creation fails
        }

        // Log audit
        await logAudit({
            userId,
            action: "REJECT_SHARE_REQUEST",
            targetUserId: request.requestedBy._id,
            details: `Rejected share request for post: ${request.postId.title}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        logger.info(`Share request rejected by collaborator ${req.user.email} for post ${request.postId.title}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Share request rejected.",
            DATA: request,
        });
    } catch (error) {
        logger.error(`Error rejecting share request: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

module.exports = {
    submitShareRequest: exports.submitShareRequest,
    getMyShareRequests: exports.getMyShareRequests,
    getMySubmissions: exports.getMySubmissions,
    getAllShareRequests: exports.getAllShareRequests,
    approveShareRequest: exports.approveShareRequest,
    rejectShareRequest: exports.rejectShareRequest,
};
