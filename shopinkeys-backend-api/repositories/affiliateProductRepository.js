const AffiliateProduct = require("../models/AffiliateProduct");

exports.findProductById = async (id) => {
    return AffiliateProduct.findById(id).populate("addedBy", "name email name username");
};

exports.findProductByIdWithDetails = async (id) => {
    return AffiliateProduct.findOne({ _id: id, approved: true, deleted: false })
        .populate("addedBy", "name username")
        .select("-reviewNotes -reviewedBy");
};

exports.createProduct = async (productData) => {
    return AffiliateProduct.create(productData);
};

exports.findProductsByFilter = async (filter, skip, limit) => {
    return AffiliateProduct.find(filter)
        .select("title description image affiliateUrl price niche partner clicks createdAt")
        .sort({ createdAt: -1 })
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
