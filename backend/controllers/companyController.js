const Company = require('../models/Company');
const { getPresignedUrl } = require('../config/s3Config');

// @desc    Create or update a company drive profile
// @route   POST /api/companies
// @access  Private (TPO or company_hr)
const createCompany = async (req, res) => {
  try {
    const {
      eligibilityCriteria,
      packageOffered,
      rolesOffered,
      description,
      workCulture,
      industryType,
      companyLogoUrl,
    } = req.body;
    let name = req.body.name;

    // If recruiter/company_hr, prioritize their registered companyName
    if (req.student && (req.student.role === 'company_hr' || req.student.role === 'recruiter')) {
      name = req.student.companyName || name;
    }

    // Validation
    if (!name || packageOffered === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide company name and package offered',
      });
    }

    // Support both string "Role 1, Role 2" and array ["Role 1", "Role 2"]
    let parsedRoles = [];
    if (Array.isArray(rolesOffered)) {
      parsedRoles = rolesOffered.map((r) => String(r).trim()).filter(Boolean);
    } else if (typeof rolesOffered === 'string') {
      parsedRoles = rolesOffered
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
    }

    // Support both flat minCGPA/maxBacklogs and nested eligibilityCriteria
    const minCGPA =
      req.body.minCGPA !== undefined
        ? parseFloat(req.body.minCGPA)
        : eligibilityCriteria?.minCGPA ?? 0;

    const maxBacklogs =
      req.body.maxBacklogs !== undefined
        ? parseInt(req.body.maxBacklogs, 10)
        : eligibilityCriteria?.maxBacklogs ?? 0;

    const isHR = req.student && (req.student.role === 'company_hr' || req.student.role === 'recruiter');

    // If HR, check if company already exists to perform update/link
    let company = null;
    if (isHR) {
      company = await Company.findOne({
        $or: [{ hr: req.student._id }, { name: name.trim() }],
      });
    }

    if (company) {
      // Update existing company record
      company.name = name.trim();
      company.packageOffered = parseFloat(packageOffered);
      company.eligibilityCriteria = {
        minCGPA: isNaN(minCGPA) ? 0 : minCGPA,
        maxBacklogs: isNaN(maxBacklogs) ? 0 : maxBacklogs,
      };
      company.rolesOffered = parsedRoles;
      if (description !== undefined) company.description = description.trim();
      if (workCulture !== undefined) company.workCulture = workCulture.trim();
      if (industryType !== undefined) company.industryType = industryType.trim();
      if (companyLogoUrl !== undefined) company.companyLogoUrl = companyLogoUrl.trim();
      if (isHR) company.hr = req.student._id;
      await company.save();
    } else {
      // Create new company
      company = await Company.create({
        name: name.trim(),
        eligibilityCriteria: {
          minCGPA: isNaN(minCGPA) ? 0 : minCGPA,
          maxBacklogs: isNaN(maxBacklogs) ? 0 : maxBacklogs,
        },
        packageOffered: parseFloat(packageOffered),
        rolesOffered: parsedRoles,
        description: (description && description.trim()) || '',
        workCulture: (workCulture && workCulture.trim()) || '',
        industryType: (industryType && industryType.trim()) || '',
        companyLogoUrl: (companyLogoUrl && companyLogoUrl.trim()) || '',
        hr: isHR ? req.student._id : undefined,
      });
    }

    // Link company to HR user document
    if (isHR && req.student) {
      req.student.company = company._id;
      await req.student.save();
    }

    return res.status(201).json({
      success: true,
      message: 'Company profile saved successfully',
      company,
    });
  } catch (error) {
    console.error('Error in createCompany:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating company',
      error: error.message,
    });
  }
};

// @desc    Get all companies with presigned logo URLs for public S3 items
// @route   GET /api/companies
// @access  Public
const getAllCompanies = async (req, res) => {
  try {
    const rawCompanies = await Company.find().sort({ createdAt: -1 }).lean();

    const companies = await Promise.all(
      rawCompanies.map(async (comp) => {
        if (comp.companyLogoUrl) {
          // If stored as an S3 key or S3 URL from our bucket, generate presigned URL
          if (
            comp.companyLogoUrl.startsWith('company-logos/') ||
            comp.companyLogoUrl.includes('.amazonaws.com/')
          ) {
            try {
              comp.companyLogoUrl = await getPresignedUrl(comp.companyLogoUrl, 86400); // 24hr validity
            } catch (err) {
              console.warn(`[Presigned URL] Failed to sign logo for ${comp.name}:`, err.message);
            }
          }
        }
        return comp;
      })
    );

    return res.status(200).json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (error) {
    console.error('Error fetching companies:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching companies',
      error: error.message,
    });
  }
};

// @desc    Get current HR's company profile
// @route   GET /api/companies/my
// @access  Private (company_hr)
const getMyCompanyProfile = async (req, res) => {
  try {
    const hrId = req.student._id;
    const companyId = req.student.companyId || req.student.company;
    const companyName = req.student.companyName;

    let company = null;
    if (companyId) {
      company = await Company.findById(companyId);
    }
    if (!company) {
      company = await Company.findOne({
        $or: [{ hr: hrId }, { name: companyName }],
      });
    }

    return res.status(200).json({
      success: true,
      company: company || null,
      companyName: company ? company.name : req.student.companyName,
    });
  } catch (error) {
    console.error('Error in getMyCompanyProfile:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching your company profile',
      error: error.message,
    });
  }
};

module.exports = {
  createCompany,
  getAllCompanies,
  getMyCompanyProfile,
};

