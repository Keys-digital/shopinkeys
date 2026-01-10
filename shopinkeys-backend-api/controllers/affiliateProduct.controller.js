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
        const { search, categories, partner, sort, page = 1, limit = 20 } = req.query;

        // Build filter for approved, non-deleted products only
        const filter = { approved: true, deleted: false };

        // 1. Text Search
        if (search) {
            filter.$text = { $search: search };
        }

        // 2. Category Filter (Multi-select)
        if (categories) {
            const categoryList = Array.isArray(categories) ? categories : categories.split(",");
            filter.niche = { $in: categoryList.map(c => c.trim()) };
        }

        // 3. Partner Filter
        if (partner) {
            filter.partner = partner;
        }

        // 4. Sorting
        let sortOption = { createdAt: -1 }; // Default: Newest
        if (sort) {
            switch (sort) {
                case "price_asc":
                    sortOption = { price: 1 };
                    break;
                case "price_desc":
                    sortOption = { price: -1 };
                    break;
                case "clicks":
                    sortOption = { clicks: -1 };
                    break;
                case "newest":
                    sortOption = { createdAt: -1 };
                    break;
                case "oldest":
                    sortOption = { createdAt: 1 };
                    break;
                default:
                    sortOption = { createdAt: -1 };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const products = await affiliateProductRepository.findProductsByFilter(filter, skip, parseInt(limit), sortOption);
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
 * Get active product categories (Public)
 * GET /api/affiliate-products/categories
 * Access: Public
 */
exports.getCategories = async (req, res) => {
    try {
        // Find all distinct niches from approved/non-deleted products
        // Note: Repository method for distinct wasn't added, using direct query logic here or could add to repo.
        // For simplicity and since we imported repository only, let's assume we can add a method or require model if strictly needed.
        // But better to implement it via repository pattern if possible.
        // Let's modify repository later if we want strictness, or just assume we can add it here.
        // Actually, to stick to pattern, I should have added `findDistinctNiches` to repo.
        // I will add the repo call here but I need to ensure it exists.
        // Since I can't edit repo again in this single tool call, I will assume I can edit repo in next step OR
        // I can just rely on the repo import I have. Wait, I imported `affiliateProductRepository`.
        // I'll add `findDistinctNiches` to repository in a follow-up step. for now calling it.
        // To avoid runtime error, I will comment this out or use a quick fix if I could import model.
        // But better: I will add `getCategories` implementation assuming `affiliateProductRepository.getDistinctNiches` exists,
        // and then IMMEDIATELY update the repo in the next step.

        const categories = await affiliateProductRepository.getDistinctNiches();

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Categories retrieved successfully.",
            DATA: categories,
        });
    } catch (error) {
        logger.error(`Error fetching categories: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};

/**
 * Get active affiliate partners (Public)
 * GET /api/affiliate-products/partners
 * Access: Public
 */
exports.getPartners = async (req, res) => {
    try {
        const partners = await affiliateProductRepository.getDistinctPartners();
        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Partners retrieved successfully.",
            DATA: partners,
        });
    } catch (error) {
        logger.error(`Error fetching partners: ${error.message}`);
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

        const { title, description, image, affiliateUrl, price, niche, partner, relatedPostId } = value;

        const newProduct = await affiliateProductRepository.createProduct({
            title,
            description,
            image,
            affiliateUrl,
            price,
            niche: Array.isArray(niche) ? niche : (niche ? [niche] : []), // Ensure array
            partner: partner || AFFILIATE_PARTNERS.OTHER,
            relatedPostId: relatedPostId || null,
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
