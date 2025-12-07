const affiliateProductRepository = require("../repositories/affiliateProductRepository");
const logger = require("../utils/logger");
const { logAudit } = require("../repositories/auditLogRepository");
const { submitProductSchema, updateProductSchema } = require("../utils/validationSchemas");
const { AUDIT_ACTIONS, AFFILIATE_PARTNERS } = require("../constants");

/**
 * Get all approved affiliate products (Public)
 * GET /api/affiliate-products
 * Access: Public
 */
exports.getAllProducts = async (req, res) => {
    try {
        const { niche, partner, page = 1, limit = 20 } = req.query;

        // Build filter for approved, non-deleted products only
        const filter = { approved: true, deleted: false };
        if (niche) filter.niche = niche;
        if (partner) filter.partner = partner;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const products = await affiliateProductRepository.findProductsByFilter(filter, skip, parseInt(limit));
        const total = await affiliateProductRepository.countProductsByFilter(filter);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Affiliate products retrieved successfully.",
            DATA: {
                products,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalProducts: total,
                    limit: parseInt(limit),
                },
            },
        });
    } catch (error) {
        logger.error(`Error fetching affiliate products: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get single affiliate product by ID (Public)
 * GET /api/affiliate-products/:id
 * Access: Public
 */
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await affiliateProductRepository.findProductByIdWithDetails(id);

        if (!product) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Product not found.",
            });
        }

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Product retrieved successfully.",
            DATA: product,
        });
    } catch (error) {
        logger.error(`Error fetching product: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Track affiliate link click (Public)
 * POST /api/affiliate-products/:id/click
 * Access: Public
 */
exports.trackClick = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user._id : null;
        const ipAddress = req.ip;
        const userAgent = req.get("User-Agent");

        // Check for duplicate clicks within 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const product = await affiliateProductRepository.findProductById(id);

        if (!product || product.deleted) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Product not found.",
            });
        }

        // Check for recent click from same IP or user
        const recentClick = product.clicksDetail.find((click) => {
            const isSameUser = userId && click.userId && click.userId.toString() === userId.toString();
            const isSameIP = click.ipAddress === ipAddress;
            const isRecent = click.timestamp >= oneHourAgo;
            return (isSameUser || isSameIP) && isRecent;
        });

        if (recentClick) {
            return res.status(429).json({
                STATUS_CODE: 429,
                STATUS: false,
                MESSAGE: "Click already tracked recently. Please try again later.",
            });
        }

        // Add click detail and increment counter
        product.clicks += 1;
        product.clicksDetail.push({
            userId,
            ipAddress,
            userAgent,
            timestamp: new Date(),
        });

        await affiliateProductRepository.saveProduct(product);

        logger.info(`Affiliate click tracked for product: ${id}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Click tracked successfully.",
            DATA: {
                clicks: product.clicks,
                affiliateUrl: product.affiliateUrl,
            },
        });
    } catch (error) {
        logger.error(`Error tracking click: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Submit new affiliate product (Collaborator)
 * POST /api/affiliate-products
 * Access: Collaborator
 */
exports.submitProduct = async (req, res) => {
    try {
        // Validation using Joi
        const { error, value } = submitProductSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: error.details[0].message,
            });
        }

        const { title, description, image, affiliateUrl, price, niche, partner } = value;

        const newProduct = await affiliateProductRepository.createProduct({
            title,
            description,
            image,
            affiliateUrl,
            price,
            niche,
            partner: partner || AFFILIATE_PARTNERS.OTHER,
            addedBy: req.user._id,
            approved: false, // Pending approval
        });

        logger.info(`Affiliate product submitted by user: ${req.user.email}`);

        res.status(201).json({
            STATUS_CODE: 201,
            STATUS: true,
            MESSAGE: "Affiliate product submitted successfully. Pending approval.",
            DATA: newProduct,
        });
    } catch (error) {
        logger.error(`Error submitting affiliate product: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get my submitted products (Collaborator)
 * GET /api/affiliate-products/my-products
 * Access: Collaborator
 */
exports.getMyProducts = async (req, res) => {
    try {
        const products = await affiliateProductRepository.findMyProducts(req.user._id);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Your products retrieved successfully.",
            DATA: products,
        });
    } catch (error) {
        logger.error(`Error fetching my products: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Approve affiliate product (Admin, Editor)
 * PUT /api/affiliate-products/:id/approve
 * Access: Admin, Editor, Super Admin
 */
exports.approveProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewNotes } = req.body;

        const product = await affiliateProductRepository.findProductById(id);
        if (!product) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Product not found.",
            });
        }

        if (product.approved) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Product is already approved.",
            });
        }

        product.approved = true;
        product.reviewedBy = req.user._id;
        if (reviewNotes) product.reviewNotes = reviewNotes;

        await affiliateProductRepository.saveProduct(product);

        await logAudit({
            userId: req.user._id,
            action: AUDIT_ACTIONS.APPROVE_AFFILIATE_PRODUCT,
            targetUserId: product.addedBy._id,
            details: `Approved affiliate product: ${product.title}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        logger.info(`Affiliate product approved: ${product.title}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Product approved successfully.",
            DATA: product,
        });
    } catch (error) {
        logger.error(`Error approving product: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Reject affiliate product (Admin, Editor)
 * PUT /api/affiliate-products/:id/reject
 * Access: Admin, Editor, Super Admin
 */
exports.rejectProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewNotes } = req.body;

        const product = await affiliateProductRepository.findProductById(id);
        if (!product) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Product not found.",
            });
        }

        if (product.rejected) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Product is already rejected.",
            });
        }

        // Soft delete: Mark as rejected instead of deleting
        product.approved = false;
        product.rejected = true;
        product.rejectedAt = new Date();
        product.reviewedBy = req.user._id;
        product.reviewNotes = reviewNotes || "No reason provided";
        await affiliateProductRepository.saveProduct(product);

        await logAudit({
            userId: req.user._id,
            action: AUDIT_ACTIONS.REJECT_AFFILIATE_PRODUCT,
            targetUserId: product.addedBy._id,
            details: `Rejected affiliate product: ${product.title}. Reason: ${reviewNotes || "No reason provided"}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        logger.info(`Affiliate product rejected: ${product.title}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Product rejected. Collaborator can view rejection reason and resubmit.",
            DATA: {
                productId: product._id,
                rejected: true,
                reviewNotes: product.reviewNotes,
            },
        });
    } catch (error) {
        logger.error(`Error rejecting product: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Update affiliate product (Admin, Editor)
 * PUT /api/affiliate-products/:id
 * Access: Admin, Editor, Super Admin
 */
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        // Joi validation for updates
        const { error, value } = updateProductSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: error.details[0].message,
            });
        }

        const product = await affiliateProductRepository.findProductById(id);
        if (!product) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Product not found.",
            });
        }

        // Allow updates to Joi filtered fields
        Object.keys(value).forEach((key) => {
            product[key] = value[key];
        });

        await affiliateProductRepository.saveProduct(product);

        logger.info(`Affiliate product updated: ${product.title}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Product updated successfully.",
            DATA: product,
        });
    } catch (error) {
        logger.error(`Error updating product: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Delete affiliate product (Admin)
 * DELETE /api/affiliate-products/:id
 * Access: Admin, Super Admin
 */
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await affiliateProductRepository.findProductById(id);
        if (!product) {
            return res.status(404).json({
                STATUS_CODE: 404,
                STATUS: false,
                MESSAGE: "Product not found.",
            });
        }

        if (product.deleted) {
            return res.status(400).json({
                STATUS_CODE: 400,
                STATUS: false,
                MESSAGE: "Product is already deleted.",
            });
        }

        // Soft delete: Mark as deleted instead of removing
        product.deleted = true;
        product.deletedAt = new Date();
        await affiliateProductRepository.saveProduct(product);

        await logAudit({
            userId: req.user._id,
            action: AUDIT_ACTIONS.DELETE_AFFILIATE_PRODUCT,
            details: `Deleted affiliate product: ${product.title}`,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });

        logger.info(`Affiliate product deleted: ${product.title}`);

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Product deleted successfully.",
        });
    } catch (error) {
        logger.error(`Error deleting product: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};
