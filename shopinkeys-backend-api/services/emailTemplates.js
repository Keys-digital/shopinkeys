const verificationEmailTemplate = (name, verificationUrl) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Hello ${name},</h2>
    <p>Thank you for registering at ShopInKeys!</p>
    <p>Please verify your email by clicking the button below:</p>
    <a href="${verificationUrl}" style="
      display: inline-block;
      padding: 10px 20px;
      background-color: #1a73e8;
      color: #fff;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 10px;
    ">Verify Email</a>
    <p>If the button doesn’t work, copy this link into your browser:</p>
    <p>${verificationUrl}</p>
    <hr />
    <p>ShopInKeys Team</p>
  </div>
`;

const forgotPasswordEmailTemplate = (name, resetUrl) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Hello ${name},</h2>
    <p>You requested a password reset for your ShopInKeys account.</p>
    <p>Click the button below to reset your password:</p>
    <a href="${resetUrl}" style="
      display: inline-block;
      padding: 10px 20px;
      background-color: #e91e63;
      color: #fff;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 10px;
    ">Reset Password</a>
    <p>If the button doesn’t work, copy this link into your browser:</p>
    <p>${resetUrl}</p>
    <hr />
    <p>ShopInKeys Team</p>
  </div>
`;

const passwordResetConfirmationTemplate = (name) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Hello ${name},</h2>
    <p>Your ShopInKeys password has been successfully reset.</p>
    <p>If you did not perform this action, please contact support immediately.</p>
    <hr />
    <p>ShopInKeys Team</p>
  </div>
`;

const welcomeEmailTemplate = (name) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Welcome ${name}!</h2>
    <p>We’re thrilled to have you join the ShopInKeys community.</p>
    <p>Start exploring the latest tech reviews, wellness tips, and exclusive deals.</p>
    <p>Enjoy your journey with us!</p>
    <hr />
    <p>ShopInKeys Team</p>
  </div>
`;

module.exports = { 
  verificationEmailTemplate, 
  forgotPasswordEmailTemplate, 
  passwordResetConfirmationTemplate,
  welcomeEmailTemplate
};
