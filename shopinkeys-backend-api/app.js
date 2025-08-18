const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const winston = require("./utils/logger");
const authRoutes = require("./routes/authRoutes");
const roleRoutes = require("./routes/roleRoutes");
const { notFound, errorHandler } = require("./middlewares/handler");

//  Import i18next & middleware
const i18next = require("./config/i18nConfig");
const i18nextMiddleware = require("i18next-http-middleware");

const app = express();

//  Apply i18next middleware for language detection
app.use(i18nextMiddleware.handle(i18next));

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan("combined", { stream: winston.stream }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);

app.get("/", (req, res) => {
  res.status(200).send("API is running...");
});

// Apply 404 and error handling last
app.use(notFound);
app.use(errorHandler);

module.exports = app;
