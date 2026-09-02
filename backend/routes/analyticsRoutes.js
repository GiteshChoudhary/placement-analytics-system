const express = require('express');
const router = express.Router();
const {
  getOverallStats,
  getBranchWiseStats,
  getCompanyWiseStats,
  getAveragePackage,
  getPlacedStudents,
} = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Protect all analytics endpoints & restrict exclusively to TPO
router.use(protect);
router.use(restrictTo('tpo'));

// Analytics endpoints
router.get('/overview', getOverallStats);
router.get('/branch-wise', getBranchWiseStats);
router.get('/company-wise', getCompanyWiseStats);
router.get('/average-package', getAveragePackage);
router.get('/placed-students', getPlacedStudents);

module.exports = router;
