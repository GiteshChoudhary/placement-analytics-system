require('dotenv').config();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize AWS S3 v3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'gitesh-placement-resumes';

/**
 * Generate a temporary presigned GET URL for an S3 object (valid for 5 minutes).
 * Handles both plain S3 keys (e.g. "resumes/student_123.pdf") and legacy full URLs.
 *
 * @param {string} key - S3 object key or legacy full URL
 * @param {number} expiresIn - Expiration in seconds (default: 300 = 5 minutes)
 * @returns {Promise<string>} Presigned S3 URL
 */
const getPresignedUrl = async (key, expiresIn = 300) => {
  if (!key) {
    throw new Error('S3 object key is required to generate presigned URL');
  }

  // Sanitize key in case a legacy full URL was stored
  let objectKey = key;
  if (objectKey.includes('.amazonaws.com/')) {
    objectKey = objectKey.split('.amazonaws.com/')[1];
  } else if (objectKey.startsWith('http')) {
    try {
      const parsed = new URL(objectKey);
      objectKey = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
      if (objectKey.startsWith(BUCKET_NAME + '/')) {
        objectKey = objectKey.replace(BUCKET_NAME + '/', '');
      }
    } catch (_) {
      // Use original key if URL parse fails
    }
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
    ResponseContentType: 'application/pdf',
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
};

module.exports = {
  s3Client,
  BUCKET_NAME,
  getPresignedUrl,
};


