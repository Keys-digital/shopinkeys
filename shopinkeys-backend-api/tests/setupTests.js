const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongoServer;

// Increase Jest timeout for all tests
jest.setTimeout(30000);

beforeAll(async () => {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    // Close database connection
    await mongoose.disconnect();

    // Stop MongoDB instance
    if (mongoServer) {
        await mongoServer.stop();
    }
});

afterEach(async () => {
    // Clean up database between tests (optional)
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});
