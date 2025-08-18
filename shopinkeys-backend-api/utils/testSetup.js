const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

/**
 * Sets up an in-memory MongoDB server for testing.
 */
const setupTestDB = () => {
  beforeAll(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();

      await mongoose.connect(mongoUri);
      console.log("Test MongoDB connected successfully.");
    } catch (error) {
      console.error("MongoMemoryServer connection failed:", error);
    }
  });

  afterEach(async () => {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(
      collections.map((collection) => collection.deleteMany({}))
    );
  });

  afterAll(async () => {
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
      await mongoServer.stop();
      console.log("Test MongoDB disconnected successfully.");
    } catch (error) {
      console.error("Error closing test MongoDB:", error);
    }
  });
};

module.exports = { setupTestDB };
