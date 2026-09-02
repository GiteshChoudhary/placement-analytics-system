const express = require('express');
const router = express.Router();
const {
  createCompany,
  getAllCompanies,
  getMyCompanyProfile,
} = require('../controllers/companyController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Get current logged-in Recruiter's company profile
router.get('/my', protect, restrictTo('recruiter', 'company_hr'), getMyCompanyProfile);

// Routes for companies
router.route('/')
  .post(protect, restrictTo('tpo', 'company_hr'), createCompany)
  .get(getAllCompanies);

module.exports = router;

