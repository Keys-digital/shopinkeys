// utils/logger.js
const chalk = require("chalk");

const logger = {
  info: (msg, ...args) => console.log(chalk.cyan(`[INFO] ${msg}`), ...args),
  success: (msg, ...args) => console.log(chalk.green(`[SUCCESS] ${msg}`), ...args),
  warn: (msg, ...args) => console.warn(chalk.yellow(`[WARN] ${msg}`), ...args),
  error: (msg, ...args) => console.error(chalk.red(`[ERROR] ${msg}`), ...args),
  debug: (msg, ...args) => {
    if (process.env.DEBUG === "true") {
      console.log(chalk.gray(`[DEBUG] ${msg}`), ...args);
    }
  },
};

module.exports = logger;
