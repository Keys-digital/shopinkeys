const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, `../.env${process.env.NODE_ENV === 'test' ? '.test' : ''}`)
});

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

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = process.env.REDIS_DB ? Number(process.env.REDIS_DB) : 0;

module.exports = {
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  REDIS_DB,
};
