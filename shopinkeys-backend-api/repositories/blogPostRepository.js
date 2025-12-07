const BlogPost = require("../models/BlogPost");
const { POST_STATUS, INTERACTION_TYPES } = require("../constants");

/**
 * Find a post by ID
 * @param {string} id 
 * @returns {Promise<Document>}
 */
exports.findPostById = async (id) => {
    return BlogPost.findById(id);
};

/**
 * Find a post by slug
 * @param {string} slug 
 * @param {object} filter Additional filters
 * @returns {Promise<Document>}
 */
exports.findPostBySlug = async (slug, filter = {}) => {
    return BlogPost.findOne({ slug, ...filter }).populate("authorId", "name email");
};

/**
 * Create a new post
 * @param {object} postData 
 * @returns {Promise<Document>}
 */
exports.createPost = async (postData) => {
    return BlogPost.create(postData);
};

/**
 * Find posts with filters and pagination
 * @param {object} filter 
 * @param {number} skip 
 * @param {number} limit 
 * @returns {Promise<Array<Document>>}
 */
exports.findPosts = async (filter, skip, limit) => {
    return BlogPost.find(filter)
        .select("title slug excerpt featuredImage publishedAt category tags status")
        .populate("authorId", "name username")
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

/**
 * Count posts matching filter
 * @param {object} filter 
 * @returns {Promise<number>}
 */
exports.countPosts = async (filter) => {
    return BlogPost.countDocuments(filter);
};

/**
 * Find posts for review
 * @param {object} query 
 * @returns {Promise<Array<Document>>}
 */
exports.findPostsForReview = async (query) => {
    return BlogPost.find(query)
        .populate("authorId", "name email")
        .sort({ createdAt: 1 });
};

/**
 * Delete a post (hard delete)
 * @param {string} id 
 * @returns {Promise<Document>}
 */
exports.deletePost = async (id) => {
    return BlogPost.findByIdAndDelete(id);
};

/**
 * Find posts for a specific user (My Posts)
 * @param {string} userId 
 * @returns {Promise<Array<Document>>}
 */
exports.findMyPosts = async (userId) => {
    return BlogPost.find({ authorId: userId }).sort({ createdAt: -1 });
};

/**
 * Find related posts
 * @param {string} postId 
 * @param {string} category 
 * @param {Array} tags 
 * @param {number} limit 
 * @returns {Promise<Array<Document>>}
 */
exports.findRelatedPosts = async (postId, category, tags, limit) => {
    return BlogPost.find({
        _id: { $ne: postId },
        status: POST_STATUS.PUBLISHED,
        $or: [
            { category: category },
            { tags: { $in: tags } },
        ],
    })
        .select("title slug featuredImage")
        .limit(limit);
};

/**
 * Save a post document (wrapper for .save())
 * @param {Document} post 
 * @returns {Promise<Document>}
 */
exports.savePost = async (post) => {
    return post.save();
};
