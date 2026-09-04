/**
 * urlHelper.js
 * Utility to safely normalize and construct unbroken URLs for emails and auth redirects.
 */

/**
 * Safely cleans and standardizes base URLs for web portals and invitation links.
 * Handles surrounding quotes, newlines, carriage returns, trailing slashes, and missing protocols.
 *
 * @param {string} rawUrl - Raw input URL from env, header, or payload
 * @param {string} [fallback='http://localhost:5173'] - Default fallback if url is invalid
 * @returns {string} Sanitized absolute base URL (e.g. 'https://placement-analytics-system-y3ky.vercel.app')
 */
const cleanBaseUrl = (rawUrl, fallback = 'http://localhost:5173') => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback;
  }

  // 1. Remove surrounding whitespace, newlines, carriage returns, and tabs
  let clean = rawUrl.replace(/[\r\n\t]/g, '').trim();

  // 2. Remove accidental surrounding quotes (common when copying from .env or dashboards)
  clean = clean.replace(/^["'`]+|["'`]+$/g, '').trim();

  if (!clean) {
    return fallback;
  }

  // 3. Ensure a valid http or https protocol is attached
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }

  // 4. Remove all trailing slashes to ensure clean concatenation
  clean = clean.replace(/\/+$/, '');

  // 5. Validate using the URL constructor to extract origin protocol + host
  try {
    const parsed = new URL(clean);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_) {
    return clean;
  }
};

/**
 * Builds a bulletproof, unbroken recruiter setup invitation URL.
 *
 * @param {string} baseUrl - Base URL (from FRONTEND_URL, origin, referer, etc.)
 * @param {string} token - JWT invitation token
 * @returns {string} Fully formed, clean URL
 */
const buildRecruiterInviteLink = (baseUrl, token) => {
  const cleanBase = cleanBaseUrl(baseUrl, 'http://localhost:5173');
  const cleanToken = (token || '').toString().trim();
  return `${cleanBase}/recruiter-setup?token=${cleanToken}`;
};

module.exports = {
  cleanBaseUrl,
  buildRecruiterInviteLink,
};
