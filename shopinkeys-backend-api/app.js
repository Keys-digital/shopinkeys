const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const winston = require("./utils/logger");
const authRoutes = require("./routes/authRoutes");
const roleRoutes = require("./routes/roleRoutes");
const oauthRoutes = require("./routes/oauthRoutes");
const profileRoutes = require("./routes/profileRoutes");
const passport = require("./config/passport");
const { notFound, errorHandler } = require("./middlewares/handler");

//  Import i18next & middleware
const i18next = require("./config/i18nConfig");
const i18nextMiddleware = require("i18next-http-middleware");
const { publicApiLimiter, authApiLimiter } = require("./middlewares/rateLimiter");

const app = express();

//  Apply i18next middleware for language detection
app.use(i18nextMiddleware.handle(i18next));

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Logging middleware
app.use(morgan("combined", { stream: winston.stream }));

// Routes with rate limiting
app.use("/api/auth", authApiLimiter, authRoutes);
app.use("/api/auth", authApiLimiter, oauthRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/collaborator", require("./routes/collaboratorRoutes"));
app.use("/api/blog-posts", require("./routes/blogPostRoutes"));
app.use("/api/share-requests", require("./routes/shareRequestRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/affiliate-products", require("./routes/affiliateProductRoutes"));


app.get("/", (req, res) => {
  res.status(200).send("API is running...");
});

// Apply 404 and error handling last
app.use(notFound);
app.use(errorHandler);

module.exports = app;
