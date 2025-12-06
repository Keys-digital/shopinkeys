const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Mock emailUtils globally to prevent real emails
jest.mock("../utils/emailUtils", () => ({
  sendRawEmail: jest.fn(() => Promise.resolve(true)),
}));

let mongoServer;

/**
 * Sets up an in-memory MongoDB server for testing.
 */
const setupTestDB = () => {
  beforeAll(async () => {
    try {
      if (process.env.MONGODB_URI) {
        // Use the URI from .env.test (Remote Test DB)
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Test connected to configured MONGODB_URI.");
      } else {
        // Fallback to In-Memory
        mongoServer = await MongoMemoryServer.create({
          instance: {
            dbName: "shopinkeys_test_db",
          },
          binary: {
            version: "6.0.4",
            downloadDir: "./.mongodb-binaries",
          },
          spawn: {
            startupTimeout: 60000,
          },
        });
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
        console.log("Test MongoDB (Memory) connected successfully.");
      }
    } catch (error) {
      console.error("DB connection failed:", error);
    }
  });

  afterEach(async () => {
    if (mongoose.connection.readyState !== 0) {
      const collections = Object.values(mongoose.connection.collections);
      await Promise.all(
        collections.map((collection) => collection.deleteMany({}))
      );
    }
  });

  afterAll(async () => {
    try {
      // If we used Memory Server, stop it.
      // If we used Remote DB, just close connection.
      await mongoose.connection.close();
      if (mongoServer) {
        await mongoServer.stop();
      }
      console.log("Test MongoDB disconnected successfully.");
    } catch (error) {
      console.error("Error closing test MongoDB:", error);
    }
  });
};

module.exports = { setupTestDB };
