const nodemailer = require('nodemailer');

/**
 * Dispatches an email invitation to a Recruiter / HR using Gmail SMTP.
 *
 * @param {Object} options
 * @param {string} [options.to] - Recruiter's email address
 * @param {string} [options.recipientEmail] - Alternative alias for recipient email
 * @param {string} [options.companyName] - Name of the inviting company
 * @param {string} [options.token] - Signed invitation JWT
 * @param {string} [options.inviteLink] - Complete registration link
 * @throws {Error} If credentials are missing or transporter.sendMail() fails
 */
const sendRecruiterInviteEmail = async ({
  to,
  recipientEmail,
  companyName = 'Partner Company',
  token,
  inviteLink,
}) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  // 1. Verify that Gmail credentials exist in process.env
  if (!emailUser || !emailPass) {
    throw new Error(
      'Missing Gmail SMTP credentials: EMAIL_USER and EMAIL_PASS must be defined in your backend .env file.'
    );
  }

  // 2. Configure dedicated Gmail transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const recipient = recipientEmail || to;
  if (!recipient) {
    throw new Error('Recipient email address is required to send recruiter invitation.');
  }

  // 3. Resolve direct setup link
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const setupToken = token || (inviteLink ? inviteLink.split('token=')[1] : '');
  const directLink = inviteLink || `${clientUrl}/recruiter-setup?token=${setupToken}`;

  // 4. Construct mail payload
  const mailOptions = {
    from: `"Placement Cell" <${emailUser}>`,
    to: recipient,
    subject: 'Invitation to Onboard: Campus Placement Drive',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">🎓 Campus Placement Cell</h1>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Training & Placement Office (TPO)</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <h2 style="color: #0f172a; font-size: 18px;">Invitation to Onboard: Campus Placement Drive</h2>
        <p style="color: #334155; line-height: 1.6;">
          Dear Recruitment Team${companyName ? ` at <strong>${companyName}</strong>` : ''},
        </p>
        <p style="color: #334155; line-height: 1.6;">
          The College Training & Placement Office cordially invites you to participate in our campus placement season. Please set up your recruiter portal to configure your company's eligibility criteria, package details, and view student applications.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${directLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">
            Complete Recruiter Setup →
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; margin-top: 25px;">
          If the button above does not open, copy and paste this link into your browser:
        </p>
        <p style="word-break: break-all; font-size: 12px; color: #2563eb;">
          <a href="${directLink}" style="color: #2563eb;">${directLink}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          ⚠️ This invitation link is unique to ${recipient} and will expire in <strong>48 hours</strong>.
        </p>
      </div>
    `,
  };

  // 5. Send email with strict error propagation
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Email Service] Invitation email successfully sent to ${recipient} (Message ID: ${info.messageId})`
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Service] Gmail SMTP failure for ${recipient}:`, error.message);
    throw new Error(`Gmail SMTP delivery failed: ${error.message}`);
  }
};

module.exports = {
  sendRecruiterInviteEmail,
};
