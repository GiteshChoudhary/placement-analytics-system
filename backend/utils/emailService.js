let Resend;
try {
  Resend = require('resend').Resend;
} catch (_) {
  // Fallback to fetch if resend package is not present
}

const { cleanBaseUrl, buildRecruiterInviteLink } = require('./urlHelper');

/**
 * Core email dispatcher using Resend API (HTTPS / Port 443).
 * Replaces Nodemailer SMTP to prevent Render firewall connection timeouts (ports 25, 465, 587).
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @param {string} [options.text] - Plain text fallback
 * @returns {Promise<{id: string}>} Result object with message ID
 */
const sendEmailViaResend = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing Resend API Key: RESEND_API_KEY must be defined in your backend .env file or Render environment variables. Get your free API key at https://resend.com'
    );
  }

  // Resend requires a verified domain or 'onboarding@resend.dev' for free testing
  const fromAddress =
    process.env.RESEND_FROM || 'Placement Cell <onboarding@resend.dev>';

  const recipients = Array.isArray(to) ? to : [to];

  // 1. Try official Resend SDK if available
  if (Resend) {
    try {
      const resendClient = new Resend(apiKey);
      const { data, error } = await resendClient.emails.send({
        from: fromAddress,
        to: recipients,
        subject,
        html,
        text: text || undefined,
      });

      if (error) {
        console.error('[Resend SDK Error]:', error);
        throw new Error(`Resend delivery failed: ${error.message || JSON.stringify(error)}`);
      }

      return { id: data?.id || 'resend_ok' };
    } catch (err) {
      if (err.message && err.message.startsWith('Resend delivery failed')) {
        throw err;
      }
      console.warn('[Email Service] Resend SDK failed, trying HTTPS fetch fallback:', err.message);
    }
  }

  // 2. Direct HTTPS fetch fallback (zero-dependency, Node 18+)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: recipients,
      subject,
      html,
      text: text || undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[Resend HTTPS API Error]:', data);
    throw new Error(`Resend delivery failed: ${data.message || response.statusText}`);
  }

  return { id: data.id };
};

/**
 * Dispatches an email invitation to a Recruiter / HR using Resend HTTPS API.
 *
 * @param {Object} options
 * @param {string} [options.to] - Recruiter's email address
 * @param {string} [options.recipientEmail] - Alternative alias for recipient email
 * @param {string} [options.companyName] - Name of the inviting company
 * @param {string} [options.token] - Signed invitation JWT
 * @param {string} [options.inviteLink] - Complete registration link
 * @throws {Error} If credentials are missing or Resend API call fails
 */
const sendRecruiterInviteEmail = async ({
  to,
  recipientEmail,
  companyName = 'Partner Company',
  token,
  inviteLink,
}) => {
  const recipient = recipientEmail || to;
  if (!recipient) {
    throw new Error('Recipient email address is required to send recruiter invitation.');
  }

  // Ensure direct setup link is completely clean, valid, and unbroken
  let directLink = '';
  if (inviteLink && typeof inviteLink === 'string' && inviteLink.trim() !== '') {
    // Strip accidental quotes, spaces, tabs, or newlines
    let clean = inviteLink.replace(/[\r\n\t\s"']/g, '').trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    directLink = clean;
  } else {
    directLink = buildRecruiterInviteLink(
      process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
      token
    );
  }

  console.log(`[Email Service] Preparing recruiter invitation for ${recipient} with link: ${directLink}`);

  const htmlContent = `
    <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700;">🎓 Campus Placement Cell</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Training & Placement Office (TPO)</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <h2 style="color: #0f172a; font-size: 18px; margin-bottom: 12px;">Invitation to Onboard: Campus Placement Drive</h2>
      <p style="color: #334155; line-height: 1.6; font-size: 15px;">
        Dear Recruitment Team${companyName ? ` at <strong>${companyName}</strong>` : ''},
      </p>
      <p style="color: #334155; line-height: 1.6; font-size: 15px;">
        The College Training & Placement Office cordially invites you to participate in our campus placement season. Please set up your recruiter portal to configure your company's eligibility criteria, package details, and view student applications.
      </p>

      <!-- Primary CTA Button (Bulletproof mobile-friendly table button) -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px auto; width: auto;">
        <tr>
          <td align="center" style="border-radius: 6px; background-color: #2563eb;">
            <a href="${directLink}" target="_blank" rel="noopener noreferrer" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px; display: inline-block; border: 1px solid #2563eb; -webkit-text-size-adjust: none;">
              Complete Recruiter Setup →
            </a>
          </td>
        </tr>
      </table>

      <!-- Text fallback link: explicitly structured to avoid mobile link breakage -->
      <p style="color: #64748b; font-size: 13px; margin-top: 25px; margin-bottom: 6px; line-height: 1.5;">
        If the button above does not open, tap the direct portal link below:
      </p>
      <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5;">
        <a href="${directLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: 600; text-decoration: underline;">
          👉 Open Recruiter Setup Portal
        </a>
      </p>
      <div style="margin: 0; color: #94a3b8; font-size: 11px; font-family: Consolas, 'Courier New', monospace; word-break: break-all; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; line-height: 1.4;">
        <a href="${directLink}" target="_blank" rel="noopener noreferrer" style="color: #475569; text-decoration: none; word-break: break-all;">
          ${directLink}
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
        ⚠️ This invitation link is unique to ${recipient} and will expire in <strong>48 hours</strong>.
      </p>
    </div>
  `;

  // Plain-text alternative: Enclose in angle brackets <...> per RFC 3986 so email clients don't fold/split URLs across lines
  const plainText = `Dear Recruitment Team at ${companyName},\n\nThe College Training & Placement Office cordially invites you to participate in our campus placement season. Please set up your recruiter portal to configure your company's eligibility criteria, package details, and view student applications:\n\nComplete Recruiter Setup Link:\n<${directLink}>\n\n(This invitation link is unique to ${recipient} and will expire in 48 hours.)`;

  try {
    const result = await sendEmailViaResend({
      to: recipient,
      subject: 'Invitation to Onboard: Campus Placement Drive',
      html: htmlContent,
      text: plainText,
    });

    console.log(
      `[Email Service] Invitation email successfully sent to ${recipient} via Resend (ID: ${result.id})`
    );
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error(`[Email Service] Resend dispatch failure for ${recipient}:`, error.message);
    throw error;
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

  const cleanPortalUrl = cleanBaseUrl(
    process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173'
  );
  const dashboardLink = `${cleanPortalUrl}/student-dashboard`;

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

    plainText = `Hi ${studentName},\n\nCongratulations! You have received an official offer from ${companyName}. Log in to your dashboard to see full details and next steps:\n<${dashboardLink}>`;
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

    plainText = `Hi ${studentName},\n\nThank you for participating in the recruitment process with ${companyName}. While your application will not be advancing to the next round for this role, we encourage you to keep striving and check your dashboard for new upcoming placement drives:\n<${dashboardLink}>`;
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

    plainText = `Hi ${studentName},\n\nYour application to ${companyName} has moved to the ${stageCapitalized} round. Log in to your dashboard to see full details:\n<${dashboardLink}>`;
  }

  const htmlContent = `
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

      <!-- Bulletproof CTA Button -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 30px auto; width: auto;">
        <tr>
          <td align="center" style="border-radius: 6px; background-color: #2563eb;">
            <a href="${dashboardLink}" target="_blank" rel="noopener noreferrer" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; border: 1px solid #2563eb;">
              ${buttonText}
            </a>
          </td>
        </tr>
      </table>

      <p style="color: #64748b; font-size: 12px; margin-top: 25px; margin-bottom: 6px;">
        If the button above does not work, open the dashboard link below:
      </p>
      <p style="margin: 0; font-size: 13px;">
        <a href="${dashboardLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: 600; text-decoration: underline;">
          Open Placement Dashboard
        </a>
      </p>
      <p style="margin: 6px 0 15px 0; color: #94a3b8; font-size: 11px; font-family: Consolas, monospace; word-break: break-all; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 10px;">
        <a href="${dashboardLink}" target="_blank" rel="noopener noreferrer" style="color: #475569; text-decoration: none;">
          ${dashboardLink}
        </a>
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
        This is an automated notification from the Campus Placement Analytics & Management System.
      </p>
    </div>
  `;

  try {
    const result = await sendEmailViaResend({
      to: studentEmail,
      subject,
      text: plainText,
      html: htmlContent,
    });

    console.log(
      `[Email Service] Stage update email successfully sent to ${studentEmail} for ${companyName} (${newStage}) via Resend (ID: ${result.id})`
    );
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error(
      `[Email Service] Resend failure while sending stage update to ${studentEmail}:`,
      error.message
    );
    throw error;
  }
};

module.exports = {
  sendRecruiterInviteEmail,
  sendStageUpdateEmail,
};
