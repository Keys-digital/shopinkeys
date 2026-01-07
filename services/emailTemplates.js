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

const collaboratorRequestRejectionTemplate = (name, reviewNotes) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Hello ${name},</h2>
    <p>Thank you for your interest in becoming a collaborator at ShopInKeys.</p>
    <p>After careful review, we regret to inform you that your collaborator application has not been approved at this time.</p>
    ${reviewNotes ? `
    <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #e91e63; margin: 20px 0;">
      <strong>Feedback from our team:</strong>
      <p style="margin-top: 10px;">${reviewNotes}</p>
    </div>
    ` : ''}
    <p>We encourage you to continue engaging with our platform and consider reapplying in the future.</p>
    <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
    <hr />
    <p>ShopInKeys Team</p>
  </div>
`;

const shareRequestRejectionTemplate = (name, postTitle, reviewNotes) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Hello ${name},</h2>
    <p>Thank you for your interest in sharing content from ShopInKeys.</p>
    <p>We regret to inform you that your request to share the post <strong>"${postTitle}"</strong> has been declined by the content creator.</p>
    ${reviewNotes ? `
    <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #e91e63; margin: 20px 0;">
      <strong>Message from the creator:</strong>
      <p style="margin-top: 10px;">${reviewNotes}</p>
    </div>
    ` : ''}
    <p>You may explore other content on our platform or reach out to the creator directly for more information.</p>
    <hr />
    <p>ShopInKeys Team</p>
  </div>
`;

module.exports = {
  verificationEmailTemplate,
  forgotPasswordEmailTemplate,
  passwordResetConfirmationTemplate,
  welcomeEmailTemplate,
  collaboratorRequestRejectionTemplate,
  shareRequestRejectionTemplate,
};
