const express = require('express');
const router = express.Router();
const {
  createApplication,
  updateApplicationStage,
  getMyApplications,
  getAllApplications,
  getCompanyApplications,
} = require('../controllers/applicationController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Protect all routes below
router.use(protect);

// Student accessible routes
router.post('/', createApplication);
router.get('/my', getMyApplications);

// Recruiter specific route: only applications for their company
router.get('/company', restrictTo('recruiter', 'company_hr'), getCompanyApplications);

// TPO (Admin) and HR routes
router.get('/', restrictTo('tpo', 'recruiter', 'company_hr'), getAllApplications);

// Stage progression is TPO ONLY (read-only for recruiters)
router.put('/:id/stage', restrictTo('tpo'), updateApplicationStage);

module.exports = router;
