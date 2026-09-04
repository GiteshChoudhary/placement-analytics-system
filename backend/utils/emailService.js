let BrevoClient;
try {
  BrevoClient = require('@getbrevo/brevo').BrevoClient;
} catch (_) {
  // Direct HTTPS fetch fallback will be used if SDK is not present
}

const { cleanBaseUrl, buildRecruiterInviteLink } = require('./urlHelper');

/**
 * Resolves the sender email and name.
 * Uses process.env.BREVO_SENDER_EMAIL or process.env.EMAIL_USER.
 */
const getSenderInfo = () => {
  const email =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    'placementcell@college.edu';
  const name = process.env.EMAIL_FROM_NAME || 'Campus Placement Cell';
  return { name, email: email.trim() };
};

/**
 * Core email dispatcher using Brevo (Sendinblue) v3 API via HTTPS (Port 443).
 * Bypasses Render free tier SMTP blocking completely.
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} [options.recipientName] - Recipient name
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @param {string} [options.text] - Plain text fallback
 * @returns {Promise<{id: string}>} Result object with message ID
 */
const sendEmailViaBrevo = async ({ to, recipientName, subject, html, text }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'Missing Brevo API Key: BREVO_API_KEY must be defined in your backend .env file or Render environment variables. Get your free key at https://app.brevo.com/settings/keys/api'
    );
  }

  const sender = getSenderInfo();
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({
    email: typeof email === 'string' ? email.trim() : email.email,
    name: recipientName || (typeof email === 'object' ? email.name : undefined) || 'Recipient',
  }));

  console.log(
    `[Brevo API] Sending email via HTTPS (Port 443) from "${sender.name} <${sender.email}>" to: ${recipients.map((r) => r.email).join(', ')}`
  );

  // 1. Try Brevo SDK if available
  if (BrevoClient) {
    try {
      const client = new BrevoClient({ apiKey: apiKey.trim() });
      const result = await client.transactionalEmails.sendTransacEmail({
        sender,
        to: recipients,
        subject,
        htmlContent: html,
        textContent: text || undefined,
      });

      console.log(`[Brevo SDK Success] Email dispatched successfully. ID: ${result?.messageId || 'brevo_ok'}`);
      return { id: result?.messageId || 'brevo_ok' };
    } catch (sdkErr) {
      if (sdkErr.body && sdkErr.body.message) {
        console.error('[Brevo SDK API Error]:', sdkErr.body);
        throw new Error(`Brevo delivery failed: ${sdkErr.body.message}`);
      }
      console.warn('[Brevo SDK] Encountered error, trying direct HTTPS fetch fallback:', sdkErr.message);
    }
  }

  // 2. Direct HTTPS v3 endpoint request (Render allows port 443 outbound without firewall blocking)
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey.trim(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: recipients,
      subject,
      htmlContent: html,
      textContent: text || undefined,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Brevo HTTPS Error]:', data);
    throw new Error(`Brevo delivery failed: ${data.message || JSON.stringify(data)}`);
  }

  console.log(`[Brevo HTTPS Success] Email dispatched successfully. ID: ${data.messageId || 'brevo_ok'}`);
  return { id: data.messageId || 'brevo_ok' };
};

/**
 * Dispatches an email invitation to a Recruiter / HR using Brevo HTTPS API.
 *
 * @param {Object} options
 * @param {string} [options.to] - Recruiter's email address
 * @param {string} [options.recipientEmail] - Alternative alias for recipient email
 * @param {string} [options.companyName] - Name of the inviting company
 * @param {string} [options.token] - Signed invitation JWT
 * @param {string} [options.inviteLink] - Complete registration link
 * @throws {Error} If credentials are missing or Brevo API call fails
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

  // Ensure direct setup link is completely clean, unbroken, and points to the frontend /recruiter-setup route
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

      <!-- Primary Setup Anchor Button (Mobile safe with inline styling) -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px auto; width: 100%; max-width: 320px;">
        <tr>
          <td align="center" style="border-radius: 8px; background-color: #2563eb;">
            <a href="${directLink}" target="_blank" rel="noopener noreferrer" style="background-color: #2563eb; color: #ffffff; padding: 16px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; display: block; text-align: center; border: 1px solid #2563eb; -webkit-text-size-adjust: none;">
              Complete Recruiter Setup →
            </a>
          </td>
        </tr>
      </table>

      <!-- Fallback Anchor Link (Prevents email clients from line-wrapping raw URL strings) -->
      <div style="text-align: center; margin: 24px 0;">
        <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">
          If the button above does not open, tap the link below:
        </p>
        <a href="${directLink}" target="_blank" rel="noopener noreferrer" style="word-break: break-all; white-space: normal; color: #2563eb; font-size: 15px; font-weight: 600; text-decoration: underline; display: inline-block;">
          Click Here to Setup Account
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
        ⚠️ This invitation link is unique to ${recipient} and will expire in <strong>48 hours</strong>.
      </p>
    </div>
  `;

  const plainText = `Dear Recruitment Team at ${companyName},\n\nThe College Training & Placement Office cordially invites you to participate in our campus placement season. Please set up your recruiter portal to configure your company's eligibility criteria, package details, and view student applications.\n\nPlease open this invitation in your email app and click "Complete Recruiter Setup" or "Click Here to Setup Account" to finish onboarding.\n\nSetup Link: ${directLink}\n\nThis invitation link is unique to ${recipient} and will expire in 48 hours.`;

  try {
    const result = await sendEmailViaBrevo({
      to: recipient,
      recipientName: companyName ? `${companyName} Recruiter` : 'Recruiter',
      subject: 'Invitation to Onboard: Campus Placement Drive',
      html: htmlContent,
      text: plainText,
    });

    console.log(
      `[Email Service] Invitation email successfully sent to ${recipient} via Brevo (ID: ${result.id})`
    );
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error(`[Email Service] Brevo dispatch failure for ${recipient}:`, error.message);
    throw error;
  }
};

/**
 * Dispatches an email notification to a student when their application stage changes using Brevo HTTPS API.
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

    plainText = `Hi ${studentName},\n\nCongratulations! You have received an official offer from ${companyName}. Log in to your dashboard to see full details and next steps:\n${dashboardLink}`;
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

    plainText = `Hi ${studentName},\n\nThank you for participating in the recruitment process with ${companyName}. While your application will not be advancing to the next round for this role, we encourage you to keep striving and check your dashboard for new upcoming placement drives:\n${dashboardLink}`;
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

    plainText = `Hi ${studentName},\n\nYour application to ${companyName} has moved to the ${stageCapitalized} round. Log in to your dashboard to see full details:\n${dashboardLink}`;
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
            <a href="${dashboardLink}" target="_blank" rel="noopener noreferrer" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; border: 1px solid #2563eb;">
              ${buttonText}
            </a>
          </td>
        </tr>
      </table>

      <!-- Text Link Fallback -->
      <div style="text-align: center; margin: 20px 0;">
        <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0;">
          If the button above does not work, tap the link below:
        </p>
        <a href="${dashboardLink}" target="_blank" rel="noopener noreferrer" style="word-break: break-all; white-space: normal; color: #2563eb; font-size: 14px; font-weight: 600; text-decoration: underline; display: inline-block;">
          Click Here to Open Placement Dashboard
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
        This is an automated notification from the Campus Placement Analytics & Management System.
      </p>
    </div>
  `;

  try {
    const result = await sendEmailViaBrevo({
      to: studentEmail,
      recipientName: studentName,
      subject,
      text: plainText,
      html: htmlContent,
    });

    console.log(
      `[Email Service] Stage update email successfully sent to ${studentEmail} for ${companyName} (${newStage}) via Brevo (ID: ${result.id})`
    );
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error(
      `[Email Service] Brevo failure while sending stage update to ${studentEmail}:`,
      error.message
    );
    throw error;
  }
};

module.exports = {
  sendRecruiterInviteEmail,
  sendStageUpdateEmail,
};
