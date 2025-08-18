const winston = require("winston");
const path = require("path");

// Define log file paths
const errorLogPath = path.join(__dirname, "../logs/error.log");
const combinedLogPath = path.join(__dirname, "../logs/combined.log");

// Create Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(), // Console Logging
    new winston.transports.File({ filename: errorLogPath, level: "error" }), // Error Log File
    new winston.transports.File({ filename: combinedLogPath }), // General Log File
  ],
});

// Stream for Morgan to use Winston for logging HTTP requests
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
