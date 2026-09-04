const dns = require('dns');
const nodemailer = require('nodemailer');

// Force Node.js to resolve IPv4 addresses before IPv6 to resolve ENETUNREACH on Render
dns.setDefaultResultOrder('ipv4first');

/**
 * Helper to construct a configured Nodemailer Gmail transporter.
 */
const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    throw new Error(
      'Missing Gmail SMTP credentials: EMAIL_USER and EMAIL_PASS must be defined in your backend .env file.'
    );
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

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
  const transporter = createTransporter();

  const recipient = recipientEmail || to;
  if (!recipient) {
    throw new Error('Recipient email address is required to send recruiter invitation.');
  }

  const emailUser = process.env.EMAIL_USER;

  // Resolve direct setup link
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const setupToken = token || (inviteLink ? inviteLink.split('token=')[1] : '');
  const directLink = inviteLink || `${clientUrl}/recruiter-setup?token=${setupToken}`;

  // Construct mail payload
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

/**
 * Dispatches an email notification to a student when their application stage changes.
 *
 * @param {string} studentEmail - Student's email address
 * @param {string} studentName - Student's name
 * @param {string} companyName - Target company name
 * @param {string} newStage - The new application stage (e.g., 'aptitude', 'technical', 'offer', 'rejected')
 * @returns {Promise<Object>} Status object
 */
const sendStageUpdateEmail = async (studentEmail, studentName = 'Student', companyName = 'Company', newStage) => {
  if (!studentEmail) {
    console.warn('[Email Service] Cannot send stage update email: studentEmail is missing.');
    return { success: false, message: 'studentEmail is required' };
  }

  const emailUser = process.env.EMAIL_USER;
  const transporter = createTransporter();

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const dashboardLink = `${clientUrl.replace(/\/+$/, '')}/student-dashboard`;

  const stageNormalized = (newStage || '').toLowerCase().trim();
  const stageCapitalized = stageNormalized
    ? stageNormalized.charAt(0).toUpperCase() + stageNormalized.slice(1)
    : 'Updated';

  let subject = '';
  let badgeText = '';
  let badgeColor = '#2563eb';
  let badgeBg = '#eff6ff';
  let htmlBody = '';
  let plainText = '';
  let buttonText = 'Log In to Dashboard →';

  if (stageNormalized === 'offer') {
    subject = `Congratulations! You've received an offer from ${companyName}`;
    badgeText = '🎉 Job Offer Received';
    badgeColor = '#16a34a';
    badgeBg = '#f0fdf4';
    buttonText = 'View Offer Details →';

    htmlBody = `
      <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hi <strong>${studentName}</strong>,
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        We are thrilled to let you know that you have received an official job offer from <strong>${companyName}</strong>!
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Your hard work and exceptional performance throughout the recruitment process have truly paid off. Please log in to your placement dashboard to review full details about your offer and next steps.
      </p>
    `;

    plainText = `Hi ${studentName},\n\nCongratulations! You have received an official offer from ${companyName}. Log in to your dashboard to see full details and next steps: ${dashboardLink}`;
  } else if (stageNormalized === 'rejected') {
    subject = `Update on your application to ${companyName}`;
    badgeText = 'Application Status Update';
    badgeColor = '#475569';
    badgeBg = '#f1f5f9';
    buttonText = 'Check Placement Portal →';

    htmlBody = `
      <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hi <strong>${studentName}</strong>,
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Thank you for your time and efforts in participating in the recruitment process with <strong>${companyName}</strong>.
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        While your application will not be advancing to the next round for this particular role, please know that the competition was strong and every interview is a valuable stepping stone.
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Stay motivated and keep preparing! Many more placement drives are actively lined up on the portal. We encourage you to check your dashboard for upcoming opportunities.
      </p>
    `;

    plainText = `Hi ${studentName},\n\nThank you for participating in the recruitment process with ${companyName}. While your application will not be advancing to the next round for this role, we encourage you to keep striving and check your dashboard for new upcoming placement drives: ${dashboardLink}`;
  } else {
    subject = `Update on your application to ${companyName}`;
    badgeText = `Round: ${stageCapitalized}`;
    badgeColor = '#2563eb';
    badgeBg = '#eff6ff';
    buttonText = 'View Application Status →';

    htmlBody = `
      <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hi <strong>${studentName}</strong>,
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Your application to <strong>${companyName}</strong> has moved to the <strong>${stageCapitalized}</strong> round.
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Log in to your dashboard to see full details regarding scheduling, instructions, and next steps for your upcoming round.
      </p>
    `;

    plainText = `Hi ${studentName},\n\nYour application to ${companyName} has moved to the ${stageCapitalized} round. Log in to your dashboard to see full details: ${dashboardLink}`;
  }

  const mailOptions = {
    from: `"Placement Cell" <${emailUser}>`,
    to: studentEmail,
    subject,
    text: plainText,
    html: `
      <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1e3a8a; margin: 0; font-size: 22px; font-weight: 700;">🎓 Campus Placement Cell</h1>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Training & Placement Office</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; color: ${badgeColor}; background-color: ${badgeBg}; border: 1px solid ${badgeColor}33;">
            ${badgeText}
          </span>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0 20px 0;" />

        ${htmlBody}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">
            ${buttonText}
          </a>
        </div>

        <p style="color: #64748b; font-size: 12px; margin-top: 25px;">
          If the button above does not work, copy and paste this URL into your browser:
        </p>
        <p style="word-break: break-all; font-size: 12px; color: #2563eb;">
          <a href="${dashboardLink}" style="color: #2563eb;">${dashboardLink}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          This is an automated notification from the Campus Placement Analytics & Management System.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Email Service] Stage update email successfully sent to ${studentEmail} for ${companyName} (${newStage}) (Message ID: ${info.messageId})`
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(
      `[Email Service] Gmail SMTP failure while sending stage update to ${studentEmail}:`,
      error.message
    );
    throw error;
  }
};

module.exports = {
  sendRecruiterInviteEmail,
  sendStageUpdateEmail,
};

