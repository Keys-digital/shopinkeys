const affiliateProductRepository = require("../repositories/affiliateProductRepository");
const { PLATFORMS, AFFILIATE_PARTNERS } = require("../constants");
const logger = require("../utils/logger");

/**
 * Get branding platforms for animations (Public)
 * GET /api/public/branding-platforms
 * Access: Public
 */
exports.getBrandingPlatforms = async (req, res) => {
    try {
        // 1. Fetch active product partners from DB (e.g., Amazon, Temu)
        const activePartners = await affiliateProductRepository.getDistinctPartners();

        // 2. Construct Primary List (Affiliates + VoltThread)
        // Ensure VoltThread is always present as the central node, but NOT as an affiliate partner source
        const primary = [
            ...activePartners.filter(p => p !== AFFILIATE_PARTNERS.OTHER), // Filter out 'Other' if desired, or keep it
            PLATFORMS.VOLTTHREAD
        ];

        // Deduplicate primary list just in case
        const uniquePrimary = [...new Set(primary)];

        // 3. Construct Expanded List (Affiliates + Integration Platforms)
        // Represents the full network revealed when VoltThread expands
        const integrationPlatforms = Object.values(PLATFORMS).filter(p => p !== PLATFORMS.VOLTTHREAD && p !== PLATFORMS.OTHER);

        const expanded = [
            ...activePartners.filter(p => p !== AFFILIATE_PARTNERS.OTHER),
            ...integrationPlatforms
        ];

        res.status(200).json({
            STATUS_CODE: 200,
            STATUS: true,
            MESSAGE: "Branding platforms retrieved successfully.",
            DATA: {
                primary: uniquePrimary,
                expanded: expanded,
            },
        });
    } catch (error) {
        logger.error(`Error fetching branding platforms: ${error.message}`);
        res.status(500).json({
            STATUS_CODE: 500,
            STATUS: false,
            MESSAGE: "Internal server error.",
        });
    }
};
