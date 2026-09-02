const express = require('express');
const router = express.Router();
const {
  uploadResume,
  getStudentProfile,
  getStudentResumeUrl,
  getStudentResumeUrlById,
} = require('../controllers/studentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { uploadResumeMiddleware } = require('../middleware/uploadMiddleware');

// Protect all student routes (requires valid JWT token)
router.use(protect);

// Student Profile routes (Student only)
router.get('/me', restrictTo('student'), getStudentProfile);
router.get('/profile', restrictTo('student'), getStudentProfile);

// Student: Get temporary presigned URL for own resume (Student only)
router.get('/resume-url', restrictTo('student'), getStudentResumeUrl);

// Student: Upload resume to S3 (Student only)
router.post('/upload-resume', restrictTo('student'), uploadResumeMiddleware, uploadResume);

// TPO Admin & Recruiter: Get temporary presigned URL for a student's resume
router.get('/:id/resume-url', restrictTo('tpo', 'recruiter', 'company_hr'), getStudentResumeUrlById);

module.exports = router;
