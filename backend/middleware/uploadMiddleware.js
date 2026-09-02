const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client, BUCKET_NAME } = require('../config/s3Config');

// S3 Storage engine configuration with multer-s3
const s3Storage = multerS3({
  s3: s3Client,
  // Pass bucket as a string so multer-s3 invokes staticValue and does not stall run-parallel
  bucket: BUCKET_NAME || process.env.AWS_BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, {
      fieldName: file.fieldname,
      studentId: req.student?._id?.toString() || 'anonymous',
    });
  },
  key: (req, file, cb) => {
    const studentId = req.student?._id?.toString() || 'student';
    const timestamp = Date.now();
    const fileName = `resumes/${studentId}_${timestamp}.pdf`;
    
    // Step 3: Right before the S3 upload call starts
    console.log(`[Upload Flow - Step 3] Right before S3 upload call starts:`);
    console.log(`  -> Target Bucket: "${BUCKET_NAME || process.env.AWS_BUCKET_NAME}"`);
    console.log(`  -> Target S3 Key: "${fileName}"`);
    console.log(`  -> File Original Name: "${file.originalname}"`);
    console.log(`  -> Content-Type: "${file.mimetype}"`);
    
    cb(null, fileName);
  },
});

// File filter: Accept PDF files only
const fileFilter = (req, file, cb) => {
  console.log(`[Upload Flow - Step 2] Multer fileFilter inspecting: name="${file.originalname}", mimetype="${file.mimetype}"`);
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    console.error(`[Upload Flow - Step 2] Rejected file: "${file.originalname}" has invalid mimetype "${file.mimetype}" (PDF only)`);
    cb(new Error('Invalid file type. Only PDF documents are allowed!'), false);
  }
};

// Multer upload configuration with 5MB file size limit
const upload = multer({
  storage: s3Storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB in bytes
  },
}).single('resume');

// Wrapper middleware to execute upload with detailed logging, try-catch, and error handling
const uploadResumeMiddleware = async (req, res, next) => {
  // Step 1: When the request first hits the route
  console.log('\n=================== [UPLOAD FLOW START] ===================');
  console.log('[Upload Flow - Step 1] Request hit the route: POST /api/students/upload-resume');
  console.log('  -> Authenticated student:', req.student ? `${req.student.name} (${req.student.email}, ID: ${req.student._id})` : 'None');
  console.log('  -> Content-Type Header:', req.headers['content-type']);
  console.log('  -> Content-Length Header:', req.headers['content-length']);

  // Step 2: When multer starts processing the file
  console.log('[Upload Flow - Step 2] Multer starts processing the multipart form-data...');

  const uploadPromise = new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  // Step 5: Wrap the S3 upload logic in a try-catch
  try {
    await uploadPromise;

    // Step 4: Right after the S3 upload call completes successfully
    console.log('[Upload Flow - Step 4] Right after S3 upload call completed successfully!');
    console.log('  -> S3 Location URL:', req.file?.location);
    console.log('  -> S3 Bucket:', req.file?.bucket);
    console.log('  -> S3 Key:', req.file?.key);
    console.log('  -> File Size:', req.file?.size, 'bytes');
    console.log('=================== [UPLOAD FLOW END] =====================\n');
    next();
  } catch (err) {
    // Step 4 (fails) & Step 5: Log full error object including error.name and error.message
    console.error('\n================ [UPLOAD FLOW ERROR] ================');
    console.error('[Upload Flow - Step 4 & 5] S3 upload call failed or encountered an error:');
    console.error('  -> error.name:', err.name);
    console.error('  -> error.message:', err.message);
    console.error('  -> Full error object:', err);
    if (err.stack) {
      console.error('  -> Error stack trace:\n', err.stack);
    }
    console.error('=====================================================\n');

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the maximum limit of 5MB.',
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        error: {
          name: err.name,
          message: err.message,
        },
      });
    }

    if (err.message && err.message.includes('Only PDF documents are allowed')) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || 'File upload failed.',
      error: {
        name: err.name,
        message: err.message,
      },
    });
  }
};

module.exports = {
  uploadResumeMiddleware,
};

