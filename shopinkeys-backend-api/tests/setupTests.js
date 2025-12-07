const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Mock Logger to prevent console noise during tests
jest.mock("../utils/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    stream: { write: jest.fn() },
}));

// Global changes for Mongoose
mongoose.set("strictQuery", true);

beforeAll(async () => {
    // Increase timeout for slow CI environments
    jest.setTimeout(30000);
});

afterAll(async () => {
    // Clean up
});
