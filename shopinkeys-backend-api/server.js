require("dotenv").config({ path: "./.env" });
const app = require("./app");
const winston = require("./utils/logger");
const { PORT } = require("./config/envConfig");
const connectDb = require("./operations/dbOperations"); // ⬅️ Import DB connection

// Connect to MongoDB
connectDb();

// Start Server
app.listen(PORT, () => {
  winston.info(`Server running on port ${PORT}`);
});
