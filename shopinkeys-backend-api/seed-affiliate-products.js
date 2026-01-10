const mongoose = require('mongoose');
const AffiliateProduct = require('./models/AffiliateProduct');
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/shopinkeys");
        console.log("Connected to MongoDB for seeding");

        const dummyProduct = {
            title: "Seed Product",
            description: "Seeding collection to ensure existence.",
            affiliateUrl: "https://example.com/seed",
            price: 10.00,
            niche: ["General"],
            addedBy: new mongoose.Types.ObjectId(),
            approved: true,
            deleted: false
        };

        const result = await AffiliateProduct.create(dummyProduct);
        console.log("Seeding successful. Created product ID:", result._id);

        process.exit(0);
    } catch (error) {
        console.error("Seeding Error:", error);
        process.exit(1);
    }
};

run();
