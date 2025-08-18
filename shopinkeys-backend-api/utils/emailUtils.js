const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SENDER_NAME,
} = process.env;

// Transporter instance
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false, // TLS over port 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Helper to send emails
const sendRawEmail = async (options) => {
  try {
    return await transporter.sendMail(options);
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error("EMAIL_SEND_FAILED");
  }
};

module.exports = { sendRawEmail, SMTP_SENDER_NAME, SMTP_USER };
