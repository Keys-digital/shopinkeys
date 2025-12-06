/**
 * SEO / KGR (Keyword Golden Ratio) Analysis Utility
 * Supports multiple environments:
 * - Test: Mock implementation (always returns true unless keyword is "badkeyword")
 * - Development/Production: SerpApi integration for real KGR analysis
 * 
 * KGR Formula: allintitle results / monthly search volume
 * - KGR < 0.25: Very low competition (easy to rank)
 * - KGR 0.25-1: Moderate competition
 * - KGR > 1: High competition (avoid for quick ranking)
 */

const axios = require("axios");
const logger = require("./logger");

/**
 * Check KGR score for content.
 * @param {string} content - The content to analyze.
 * @param {string} keyword - The main keyword.
 * @returns {Promise<boolean>} - True if KGR check passes.
 */
exports.checkKGR = async (content, keyword) => {
    const env = process.env.NODE_ENV || "development";

    // Test environment: Use mock implementation
    if (env === "test") {
        return mockKGRCheck(keyword);
    }

    // Production/Development: Use SerpApi for real KGR analysis
    return await checkKGRWithSerpApi(content, keyword);
};

/**
 * Mock KGR check for testing
 * @param {string} keyword - The keyword to check
 * @returns {boolean} - Mock KGR result
 */
function mockKGRCheck(keyword) {
    // Mock logic: Always pass unless keyword is "badkeyword"
    if (keyword === "badkeyword") {
        return false;
    }
    return true;
}

/**
 * Real KGR analysis using SerpApi
 * @param {string} content - The content to analyze
 * @param {string} keyword - The main keyword
 * @returns {Promise<boolean>} - True if KGR is favorable (< 0.25)
 */
async function checkKGRWithSerpApi(content, keyword) {
    try {
        const apiKey = process.env.SERPAPI_KEY;

        if (!apiKey) {
            logger.warn("SerpApi key not configured. Falling back to mock check.");
            return mockKGRCheck(keyword);
        }

        if (!keyword || keyword.trim() === "") {
            logger.warn("No keyword provided for KGR analysis.");
            return true; // Pass by default if no keyword
        }

        // Step 1: Get allintitle count
        const allintitleCount = await getAllintitleCount(keyword, apiKey);

        // Step 2: Get search volume (using Google Trends or keyword planner)
        // For simplicity, we'll estimate based on search results
        // In production, integrate with Google Keyword Planner API or SEMrush
        const searchVolume = await estimateSearchVolume(keyword, apiKey);

        // Step 3: Calculate KGR
        const kgr = calculateKGR(allintitleCount, searchVolume);

        logger.info(`KGR Analysis for "${keyword}": ${kgr.toFixed(3)} (allintitle: ${allintitleCount}, volume: ${searchVolume})`);

        // Return true if KGR < 0.25 (easy to rank)
        return kgr < 0.25;

    } catch (error) {
        logger.error(`KGR analysis error: ${error.message}`);
        // Fallback to mock check
        return mockKGRCheck(keyword);
    }
}

/**
 * Get allintitle count using SerpApi
 * @param {string} keyword - The keyword to search
 * @param {string} apiKey - SerpApi key
 * @returns {Promise<number>} - Number of results with keyword in title
 */
async function getAllintitleCount(keyword, apiKey) {
    try {
        const response = await axios.get("https://serpapi.com/search", {
            params: {
                q: `allintitle:${keyword}`,
                api_key: apiKey,
                engine: "google",
                num: 10, // We only need the count, not the results
            },
        });

        // Extract total results count
        const totalResults = response.data.search_information?.total_results || 0;
        return totalResults;

    } catch (error) {
        logger.error(`SerpApi allintitle error: ${error.message}`);
        return 1000; // Conservative fallback
    }
}

/**
 * Estimate search volume using SerpApi
 * Note: This is a simplified estimation. For production, use:
 * - Google Keyword Planner API
 * - SEMrush API
 * - Ahrefs API
 * @param {string} keyword - The keyword
 * @param {string} apiKey - SerpApi key
 * @returns {Promise<number>} - Estimated monthly search volume
 */
async function estimateSearchVolume(keyword, apiKey) {
    try {
        const response = await axios.get("https://serpapi.com/search", {
            params: {
                q: keyword,
                api_key: apiKey,
                engine: "google",
                num: 10,
            },
        });

        // Estimate based on total results (very rough approximation)
        // In production, replace with actual keyword planner data
        const totalResults = response.data.search_information?.total_results || 0;

        // Rough estimation: More results = higher search volume
        // This is NOT accurate - use real keyword data in production
        if (totalResults > 10000000) return 1000; // High volume
        if (totalResults > 1000000) return 500;
        if (totalResults > 100000) return 250;
        if (totalResults > 10000) return 100;
        return 50; // Low volume

    } catch (error) {
        logger.error(`SerpApi search volume error: ${error.message}`);
        return 250; // Default to threshold value
    }
}

/**
 * Calculate KGR (Keyword Golden Ratio)
 * @param {number} allintitleResults - Number of results with keyword in title
 * @param {number} monthlySearchVolume - Monthly search volume
 * @returns {number} - KGR score
 */
function calculateKGR(allintitleResults, monthlySearchVolume) {
    if (!monthlySearchVolume || monthlySearchVolume === 0) {
        return 999; // Very high KGR (bad)
    }
    return allintitleResults / monthlySearchVolume;
}

/**
 * Comprehensive keyword analysis
 * Returns detailed KGR data for storage and dashboard display
 * @param {string} keyword - The keyword to analyze
 * @returns {Promise<Object>} - Detailed KGR analysis
 */
exports.analyzeKeyword = async (keyword) => {
    const env = process.env.NODE_ENV || "development";

    if (env === "test") {
        return {
            keyword,
            allintitle: 100,
            searchVolume: 500,
            kgr: 0.2,
            difficulty: "Easy",
            recommendation: "Good keyword to target",
        };
    }

    try {
        const apiKey = process.env.SERPAPI_KEY;

        if (!apiKey) {
            logger.warn("SerpApi key not configured.");
            return null;
        }

        const allintitle = await getAllintitleCount(keyword, apiKey);
        const searchVolume = await estimateSearchVolume(keyword, apiKey);
        const kgr = calculateKGR(allintitle, searchVolume);

        // Determine difficulty
        let difficulty, recommendation;
        if (kgr < 0.25) {
            difficulty = "Easy";
            recommendation = "Excellent keyword - very low competition";
        } else if (kgr < 1) {
            difficulty = "Moderate";
            recommendation = "Good keyword - moderate competition";
        } else {
            difficulty = "Hard";
            recommendation = "High competition - consider long-tail variations";
        }

        return {
            keyword,
            allintitle,
            searchVolume,
            kgr: parseFloat(kgr.toFixed(3)),
            difficulty,
            recommendation,
            analyzedAt: new Date(),
        };

    } catch (error) {
        logger.error(`Keyword analysis error: ${error.message}`);
        return null;
    }
};

/**
 * Batch analyze multiple keywords
 * @param {Array<string>} keywords - Array of keywords to analyze
 * @returns {Promise<Array<Object>>} - Array of keyword analysis results
 */
exports.batchAnalyzeKeywords = async (keywords) => {
    const results = [];

    for (const keyword of keywords) {
        const analysis = await exports.analyzeKeyword(keyword);
        if (analysis) {
            results.push(analysis);
        }
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results.sort((a, b) => a.kgr - b.kgr); // Sort by KGR (best first)
};
