const mongoose = require("mongoose");
const winston = require("../utils/logger");
const { MONGODB_URI } = require("../config/envConfig");

const connectDb = async () => {
  if (!MONGODB_URI) {
    winston.error("MONGODB_URI is not defined in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    winston.info(" MongoDB connected successfully.");
  } catch (err) {
    winston.error(` MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

// Handle MongoDB disconnections
mongoose.connection.on("disconnected", () => {
  winston.warn("⚠ MongoDB disconnected. Attempting to reconnect...");
  connectDb();
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  winston.info("MongoDB connection closed due to application termination.");
  process.exit(0);
});

module.exports = connectDb;
