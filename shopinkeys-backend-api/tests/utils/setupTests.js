// Mock emailUtils BEFORE any imports
jest.mock("../utils/emailUtils", () => ({
  sendRawEmail: jest.fn().mockResolvedValue(true),
}));

require("../config/envConfig");
const mongoose = require("mongoose");
const seedTestDB = require("./seedTestDB");
const User = require("../models/User");
const Role = require("../models/Role");

jest.setTimeout(70000);

// Connect to test DB once before all tests
beforeAll(async () => {
  console.log("Test environment starting...");
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Seed baseline roles & users once
  await seedTestDB();
  console.log("Test DB seeded with default roles and users.");
});

// Optionally, clean and reseed before each test to avoid duplicates
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  await seedTestDB();
});

// Disconnect from DB after all tests
afterAll(async () => {
  await mongoose.connection.close();
  console.log("Database connection closed.");
});
