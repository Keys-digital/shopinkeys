const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const PORT = process.env.PORT || 4000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/shopinkeys_affiliate_db";
const JWT_SECRET = process.env.JWT_SECRET || "defaultSecretKey";

if (!MONGODB_URI) {
  console.warn(
    "Warning: MONGODB_URI is not set in .env. Using default local MongoDB."
  );
}

if (process.env.NODE_ENV !== "production") {
  console.log("Loaded MONGODB_URI:", MONGODB_URI);
}

console.log("Loaded PORT:", PORT);

module.exports = {
  PORT,
  MONGODB_URI,
  JWT_SECRET,
};
