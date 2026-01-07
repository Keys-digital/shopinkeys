const CollaboratorRequest = require("../models/CollaboratorRequest");
const CollaboratorProfile = require("../models/CollaboratorProfile");
const User = require("../models/User");
const logger = require("../utils/logger");
const { logAudit } = require("../repositories/auditLogRepository");
const { sendEmail } = require("../services/emailService");
const { collaboratorRequestRejectionTemplate } = require("../services/emailTemplates");
const { createNotification } = require("../repositories/notificationRepository");

/**
 * Submit a collaborator request
 * POST /api/collaborator/request
 * Access: Registered User
 */
exports.submitRequest = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                STATUS_CODE: 401,
                STATUS: false,
                MESSAGE: "You must be a registered user to apply",
            });
        }

        const userId = req.user._id;


        // Check if user already has a pending or approved request
        const existingRequest = await CollaboratorRequest.findOne({ userId });
        if (existingRequest) {
            if (existingRequest.status === "pending") {
                return res.status(400).json({
                    STATUS_CODE: 400,
                    STATUS: false,
                    MESSAGE: "You already have a pending collaborator request.",
                });
            }
            if (existingRequest.status === "approved") {
                return res.status(400).json({
                    STATUS_CODE: 400,
                    STATUS: false,
                    MESSAGE: "You are already a collaborator.",
                });
            }
        }

        // Check if user is already a collaborator
        if (req.user.role === "Collaborator") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "You are already a collaborator.",
            });
        }

        const {
            requestMessage,
            niche,
            affiliateDetails,
            sampleContent,
            socialMediaLinks,
            documents,
        } = req.body;

        // Validate required fields
        if (!requestMessage || !niche) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Request message and niche are required.",
            });
        }

        const newRequest = new CollaboratorRequest({
            userId,
            requestMessage,
            niche,
            affiliateDetails,
            sampleContent,
            socialMediaLinks,
            documents,
            status: "pending",
        });

        await newRequest.save();

        logger.info(`Collaborator request submitted by user: ${req.user.email}`);

        res.status(201).json({
            STATUS_CODE: 201,
            STATUS: true,
            MESSAGE: "Collaborator request submitted successfully.",
            DATA: newRequest,
        });
    } catch (error) {
        logger.error(`Error submitting collaborator request: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get all collaborator requests
 * GET /api/collaborator/requests
 * Access: Admin, Super Admin
 */
exports.getAllRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};

        const requests = await CollaboratorRequest.find(filter)
            .populate("userId", "name email username")
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Collaborator requests retrieved successfully.",
            DATA: requests,
        });
    } catch (error) {
        logger.error(`Error fetching collaborator requests: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Approve a collaborator request
 * PUT /api/collaborator/requests/:id/approve
 * Access: Admin, Super Admin
 */
exports.approveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewNotes } = req.body;

        const request = await CollaboratorRequest.findById(id).populate("userId");
        if (!request) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Collaborator request not found.",
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: `Request has already been ${request.status}.`,
            });
        }

        // Update request status
        request.status = "approved";
        request.reviewedBy = req.user._id;
        request.reviewNotes = reviewNotes || "";
        await request.save();

        // Update user role to Collaborator
        const user = await User.findById(request.userId._id);
        user.role = "Collaborator";
        await user.save();

        // Create collaborator profile
        const username = user.username || user.email.split("@")[0];
        const collaboratorProfile = new CollaboratorProfile({
            userId: user._id,
            username,
            displayName: user.name,
            bio: "",
            niche: request.niche,
            affiliateCategory: request.niche,
            socialLinks: request.socialMediaLinks || {},
            theme: "default",
            isActive: true,
        });

        await collaboratorProfile.save();

        // Log audit
        await logAudit({
            userId: req.user._id,
            action: "APPROVE_COLLABORATOR_REQUEST",
            targetUserId: user._id,
            details: `Approved collaborator request for ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        logger.info(`Collaborator request approved for user: ${user.email}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Collaborator request approved successfully.",
            DATA: {
                request,
                profile: collaboratorProfile,
            },
        });
    } catch (error) {
        logger.error(`Error approving collaborator request: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Reject a collaborator request
 * PUT /api/collaborator/requests/:id/reject
 * Access: Admin, Super Admin
 */
exports.rejectRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewNotes } = req.body;

        const request = await CollaboratorRequest.findById(id).populate("userId");
        if (!request) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Collaborator request not found.",
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: `Request has already been ${request.status}.`,
            });
        }

        // Update request status
        request.status = "rejected";
        request.reviewedBy = req.user._id;
        request.reviewNotes = reviewNotes || "Request declined.";
        await request.save();

        // Send rejection email notification
        try {
            const emailHtml = collaboratorRequestRejectionTemplate(
                request.userId.name,
                request.reviewNotes
            );
            await sendEmail({
                to: request.userId.email,
                subject: "Collaborator Application Update - ShopInKeys",
                html: emailHtml,
            });
            logger.info(`Rejection email sent to ${request.userId.email}`);
        } catch (emailError) {
            logger.error(`Failed to send rejection email: ${emailError.message}`);
            // Don't fail the rejection if email fails
        }

        // Create in-app notification
        try {
            await createNotification({
                userId: request.userId._id,
                type: "collaborator_request_rejected",
                title: "Collaborator Application Declined",
                message: `Your application to become a collaborator has been reviewed and declined. ${reviewNotes ? 'Please check your email for feedback from our team.' : ''}`,
                metadata: {
                    requestId: request._id,
                    reviewNotes: request.reviewNotes,
                },
            });
            logger.info(`In-app notification created for user ${request.userId._id}`);
        } catch (notificationError) {
            logger.error(`Failed to create in-app notification: ${notificationError.message}`);
            // Don't fail the rejection if notification creation fails
        }

        // Log audit
        await logAudit({
            userId: req.user._id,
            action: "REJECT_COLLABORATOR_REQUEST",
            targetUserId: request.userId._id,
            details: `Rejected collaborator request for ${request.userId.email}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        logger.info(`Collaborator request rejected for user: ${request.userId.email}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Collaborator request rejected.",
            DATA: request,
        });
    } catch (error) {
        logger.error(`Error rejecting collaborator request: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get collaborator profile (own)
 * GET /api/collaborator/profile
 * Access: Collaborator
 */
exports.getProfile = async (req, res) => {
    try {
        const profile = await CollaboratorProfile.findOne({ userId: req.user._id });
        if (!profile) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Collaborator profile not found.",
            });
        }

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Profile retrieved successfully.",
            DATA: profile,
        });
    } catch (error) {
        logger.error(`Error fetching collaborator profile: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get public collaborator profile by username
 * GET /api/collaborator/public/:username
 * Access: Public
 */
exports.getPublicProfile = async (req, res) => {
    try {
        const { username } = req.params;
        const profile = await CollaboratorProfile.findOne({ username, isActive: true })
            .select("-__v -createdAt -updatedAt"); // Exclude internal fields

        if (!profile) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Collaborator profile not found.",
            });
        }

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Profile retrieved successfully.",
            DATA: profile,
        });
    } catch (error) {
        logger.error(`Error fetching public profile: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Update collaborator profile
 * PUT /api/collaborator/profile
 * Access: Collaborator
 */
exports.updateProfile = async (req, res) => {
    try {
        const {
            displayName,
            bio,
            niche,
            affiliateCategory,
            avatar,
            banner,
            theme,
            socialLinks,
        } = req.body;

        const profile = await CollaboratorProfile.findOne({ userId: req.user._id });
        if (!profile) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Collaborator profile not found.",
            });
        }

        // Update fields
        if (displayName) profile.displayName = displayName;
        if (bio !== undefined) profile.bio = bio;
        if (niche) profile.niche = niche;
        if (affiliateCategory) profile.affiliateCategory = affiliateCategory;
        if (avatar) profile.avatar = avatar;
        if (banner) profile.banner = banner;
        if (theme) profile.theme = theme;
        if (socialLinks) profile.socialLinks = socialLinks;

        await profile.save();

        logger.info(`Collaborator profile updated for user: ${req.user.email}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Profile updated successfully.",
            DATA: profile,
        });
    } catch (error) {
        logger.error(`Error updating collaborator profile: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get collaborator analytics
 * GET /api/collaborator/analytics
 * Access: Collaborator
 */
exports.getAnalytics = async (req, res) => {
    try {
        const BlogPost = require("../models/BlogPost");
        const PostInteraction = require("../models/PostInteraction");

        const userId = req.user._id;

        // Get all posts by this collaborator
        const posts = await BlogPost.find({ authorId: userId }).select("_id title slug status publishedAt");

        const postIds = posts.map((post) => post._id);

        // Aggregate interactions
        const stats = await PostInteraction.aggregate([
            { $match: { postId: { $in: postIds } } },
            {
                $group: {
                    _id: { type: "$type", source: "$refSource", country: "$country" },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Format stats
        const totalViews = stats.filter((s) => s._id.type === "view").reduce((acc, curr) => acc + curr.count, 0);
        const totalLikes = stats.filter((s) => s._id.type === "like").reduce((acc, curr) => acc + curr.count, 0);
        const totalComments = stats.filter((s) => s._id.type === "comment").reduce((acc, curr) => acc + curr.count, 0);
        const totalShares = stats.filter((s) => s._id.type === "share").reduce((acc, curr) => acc + curr.count, 0);
        const totalClicks = stats.filter((s) => s._id.type === "click").reduce((acc, curr) => acc + curr.count, 0);

        // Traffic Sources
        const trafficSources = stats
            .filter((s) => s._id.type === "view" && s._id.source)
            .reduce((acc, curr) => {
                acc[curr._id.source] = (acc[curr._id.source] || 0) + curr.count;
                return acc;
            }, {});

        // Geo Analytics (Countries)
        const countries = stats
            .filter((s) => s._id.type === "view" && s._id.country)
            .reduce((acc, curr) => {
                acc[curr._id.country] = (acc[curr._id.country] || 0) + curr.count;
                return acc;
            }, {});

        const formattedStats = {
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalClicks,
            trafficSources,
            countries,
            posts: posts,
        };

        // Calculate CTR (Click Through Rate)
        formattedStats.ctr = totalViews > 0
            ? ((totalClicks / totalViews) * 100).toFixed(2) + "%"
            : "0%";

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Analytics retrieved successfully.",
            DATA: formattedStats,
        });
    } catch (error) {
        logger.error(`Error fetching analytics: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Promote collaborator to Editor
 * PUT /api/collaborator/:id/promote
 * Access: Admin, Super Admin
 */
exports.promoteToEditor = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "User not found.",
            });
        }

        if (user.role !== "Collaborator") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "User must be a Collaborator to be promoted to Editor.",
            });
        }

        // Initiate promotion flow instead of immediate promotion
        user.promotionStatus = "pending_promotion";
        user.promotionInitiatedAt = new Date();
        await user.save();

        // Mock Notification (Email/In-App)
        // emailService.sendPromotionInvite(user.email, ...);

        await logAudit({
            userId: req.user._id,
            action: "INITIATE_PROMOTION",
            targetUserId: user._id,
            details: `Initiated promotion for ${user.email} to Editor`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Promotion initiated. User has 5 days to accept.",
            DATA: {
                userId: user._id,
                promotionStatus: user.promotionStatus,
                promotionInitiatedAt: user.promotionInitiatedAt,
            },
        });
    } catch (error) {
        logger.error(`Error promoting user to editor: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Assign category to Collaborator
 * PUT /api/collaborator/:id/assign-category
 * Access: Editor, Admin, Super Admin
 */
exports.assignCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { categories } = req.body; // Array of strings

        if (!categories || !Array.isArray(categories)) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Categories must be an array of strings.",
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "User not found.",
            });
        }

        if (user.role !== "Collaborator") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Can only assign categories to Collaborators.",
            });
        }

        user.assignedCategories = categories;
        await user.save();

        await logAudit({
            userId: req.user._id,
            action: "ASSIGN_CATEGORY",
            targetUserId: user._id,
            details: `Assigned categories [${categories.join(", ")}] to ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Categories assigned successfully.",
            DATA: {
                userId: user._id,
                assignedCategories: user.assignedCategories,
            },
        });
    } catch (error) {
        logger.error(`Error assigning categories: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Accept Promotion
 * PUT /api/collaborator/promotion/accept
 * Access: Collaborator (Self)
 */
exports.acceptPromotion = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user.promotionStatus !== "pending_promotion") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "No pending promotion found.",
            });
        }

        user.role = "Editor";
        user.promotionStatus = "accepted";
        await user.save();

        await logAudit({
            userId: req.user._id,
            action: "ACCEPT_PROMOTION",
            targetUserId: req.user._id,
            details: `User ${user.email} accepted promotion to Editor`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Promotion accepted! You are now an Editor.",
            DATA: { role: user.role },
        });
    } catch (error) {
        logger.error(`Error accepting promotion: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Decline Promotion
 * PUT /api/collaborator/promotion/decline
 * Access: Collaborator (Self)
 */
exports.declinePromotion = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user.promotionStatus !== "pending_promotion") {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "No pending promotion found.",
            });
        }

        user.promotionStatus = "declined";
        await user.save();

        await logAudit({
            userId: req.user._id,
            action: "DECLINE_PROMOTION",
            targetUserId: req.user._id,
            details: `User ${user.email} declined promotion to Editor`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Promotion declined.",
        });
    } catch (error) {
        logger.error(`Error declining promotion: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Check for Auto-Promotions (Cron Job Helper)
 * Checks for pending promotions older than 5 days and auto-promotes them.
 * GET /api/collaborator/promotion/check-auto
 * Access: Admin (or System)
 */
exports.checkAutoPromotions = async (req, res) => {
    try {
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        const pendingUsers = await User.find({
            promotionStatus: "pending_promotion",
            promotionInitiatedAt: { $lte: fiveDaysAgo },
        });

        const results = [];

        for (const user of pendingUsers) {
            user.role = "Editor";
            user.promotionStatus = "accepted"; // Auto-accepted
            await user.save();

            await logAudit({
                userId: req.user ? req.user._id : null, // System action
                action: "AUTO_PROMOTE_EDITOR",
                targetUserId: user._id,
                details: `Auto-promoted ${user.email} to Editor after 5 days`,
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
            });

            results.push(user.email);
        }

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: `Auto-promotion check complete. Promoted ${results.length} users.`,
            DATA: results,
        });
    } catch (error) {
        logger.error(`Error checking auto-promotions: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};
