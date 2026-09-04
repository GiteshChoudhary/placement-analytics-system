const express = require('express');
const router = express.Router();
const {
  registerStudent,
  loginStudent,
  inviteHR,
  verifyInviteToken,
  registerHR,
} = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { uploadLogoMiddleware } = require('../middleware/uploadMiddleware');

// Standard user auth routes
router.post('/register', registerStudent);
router.post('/login', loginStudent);

// Recruiter Onboarding flow routes
router.post('/invite-hr', protect, restrictTo('tpo'), inviteHR);
router.get('/verify-invite', verifyInviteToken);
router.post('/register-hr', uploadLogoMiddleware, registerHR);

module.exports = router;

