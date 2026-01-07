const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SENDER_NAME,
  ALT_SMTP_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  SENDER_NAME,
} = process.env;

/**
 * Create a transporter that supports both 465 (SSL) and 587 (TLS).
 */
function createTransporter(port, user, pass, senderName) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: port,
    secure: port == 465, // true for 465, false for 587
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false, // prevent handshake issues
    },
  });
}

// Try primary (465) first, fallback to 587
const transporter = createTransporter(
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SENDER_NAME
);
const altTransporter = createTransporter(
  ALT_SMTP_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  SENDER_NAME
);

const sendRawEmail = async (options) => {
  try {
    return await transporter.sendMail(options);
  } catch (error) {
    console.error(
      "Primary SMTP failed. Retrying with alternative port 587...",
      error.message
    );
    try {
      return await altTransporter.sendMail(options);
    } catch (err) {
      console.error("Alternative SMTP also failed:", err.message);
      throw new Error("EMAIL_SEND_FAILED");
    }
  }
};

module.exports = { sendRawEmail, SMTP_SENDER_NAME, SMTP_USER };
