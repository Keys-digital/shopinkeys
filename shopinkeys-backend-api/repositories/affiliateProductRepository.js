const AffiliateProduct = require("../models/AffiliateProduct");

exports.findProductById = async (id) => {
    return AffiliateProduct.findById(id).populate("addedBy", "name email username");
};

exports.findProductByIdWithDetails = async (id) => {
    return AffiliateProduct.findOne({ _id: id, approved: true, deleted: false })
        .populate("addedBy", "name username")
        .populate("relatedPostId", "slug title featuredImage media metaDescription")
        .select("-reviewNotes -reviewedBy");
};

exports.createProduct = async (productData) => {
    return AffiliateProduct.create(productData);
};

exports.findProductsByFilter = async (filter, skip, limit, sort = { createdAt: -1 }) => {
    return AffiliateProduct.find(filter)
        .select("title description image affiliateUrl price niche partner clicks createdAt relatedPostId")
        .populate("relatedPostId", "slug title featuredImage media")
        .sort(sort)
        .skip(skip)
        .limit(limit);
};

exports.countProductsByFilter = async (filter) => {
    return AffiliateProduct.countDocuments(filter);
};

exports.findMyProducts = async (userId) => {
    return AffiliateProduct.find({ addedBy: userId }).sort({ createdAt: -1 });
};

exports.saveProduct = async (product) => {
    return product.save();
};

exports.getDistinctNiches = async () => {
    return AffiliateProduct.distinct("niche", { approved: true, deleted: false });
};

exports.getDistinctPartners = async () => {
    return AffiliateProduct.distinct("partner", { approved: true, deleted: false });
};
