const { sendRawEmail, SMTP_SENDER_NAME, SMTP_USER } = require("../utils/emailUtils");

// Wrap app-specific emails
const sendEmail = async ({ to, subject, html }) => {
  return sendRawEmail({
    from: `"${SMTP_SENDER_NAME}" <${SMTP_USER}>`,
   to,
  subject,
  html,
  });
};

// Example: password reset email
const sendPasswordResetEmail = async (to, resetLink) => {
  const subject = "Reset your ShopInKeys password";
  const html = `
    <p>Click the link below to reset your password:</p>
    <a href="${resetLink}">Reset Password</a>
  `;
  return sendEmail({ to, subject, html });
};

// Example: welcome email
const sendWelcomeEmail = async (to, name) => {
  const subject = "Welcome to ShopInKeys";
  const html = `<h1>Hello ${name},</h1><p>Thanks for joining ShopInKeys!</p>`;
  return sendEmail({ to, subject, html });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
