const Application = require('../models/Application');
const Company = require('../models/Company');

const VALID_STAGES = ['eligibility', 'aptitude', 'technical', 'offer', 'rejected'];

// @desc    Apply to a company
// @route   POST /api/applications
// @access  Private (Student)
const createApplication = async (req, res) => {
  try {
    const { companyId } = req.body;
    const student = req.student; // Attached by protect middleware

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a companyId',
      });
    }

    // 1. Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // 2. Check if student already applied
    const existingApplication = await Application.findOne({
      student: student._id,
      company: companyId,
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this company',
      });
    }

    // 3. Check Eligibility Criteria
    const minCGPA = company.eligibilityCriteria?.minCGPA || 0;
    const maxBacklogs = company.eligibilityCriteria?.maxBacklogs ?? 0;

    if (student.cgpa < minCGPA) {
      return res.status(400).json({
        success: false,
        message: `Eligibility failed: Your CGPA (${student.cgpa}) is below the required minimum (${minCGPA})`,
      });
    }

    if (student.backlogs > maxBacklogs) {
      return res.status(400).json({
        success: false,
        message: `Eligibility failed: Your backlogs (${student.backlogs}) exceed the maximum allowed (${maxBacklogs})`,
      });
    }

    // 4. Create Application
    const application = await Application.create({
      student: student._id,
      company: company._id,
      currentStage: 'eligibility',
      stageHistory: [
        {
          stage: 'eligibility',
          updatedAt: new Date(),
        },
      ],
    });

    // Populate company details for response
    await application.populate('company', 'name packageOffered rolesOffered');

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application,
    });
  } catch (error) {
    console.error('Error in createApplication:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating application',
      error: error.message,
    });
  }
};

// @desc    Update application stage & track stage history
// @route   PUT /api/applications/:id/stage
// @access  Private
const updateApplicationStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStage } = req.body;

    if (!newStage || !VALID_STAGES.includes(newStage)) {
      return res.status(400).json({
        success: false,
        message: `Invalid stage. Allowed stages: ${VALID_STAGES.join(', ')}`,
      });
    }

    const application = await Application.findById(id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    // If caller is HR, verify they own this company drive
    if (req.student && req.student.role === 'company_hr') {
      const company = await Company.findOne({
        $or: [{ hr: req.student._id }, { name: req.student.companyName }],
      });
      if (!company || application.company.toString() !== company._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update candidate stages for your own company drive',
        });
      }
    }

    // Update current stage and append to history
    application.currentStage = newStage;
    application.stageHistory.push({
      stage: newStage,
      updatedAt: new Date(),
    });

    await application.save();

    await application.populate([
      { path: 'student', select: 'name rollNumber branch cgpa email resumeUrl' },
      { path: 'company', select: 'name packageOffered' },
    ]);

    // Real-time Notification via Socket.io
    // Emit "stageUpdated" to that specific student's socket if connected
    const studentId = application.student?._id?.toString();
    const companyName = application.company?.name || 'Company';

    const io = req.app.get('io');
    const userSocketMap = req.app.get('userSocketMap');

    if (io && userSocketMap && studentId) {
      const targetSocketId = userSocketMap[studentId];
      if (targetSocketId) {
        console.log(`[Socket.io] Emitting "stageUpdated" to student ${studentId} on socket: ${targetSocketId}`);
        io.to(targetSocketId).emit('stageUpdated', {
          companyName,
          newStage,
          applicationId: application._id,
          message: `Your application to ${companyName} moved to ${newStage.charAt(0).toUpperCase() + newStage.slice(1)} round!`,
        });
      } else {
        console.log(`[Socket.io] Student ${studentId} is currently not connected to Socket.io`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Application stage updated to "${newStage}" successfully`,
      application,
    });
  } catch (error) {
    console.error('Error in updateApplicationStage:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating application stage',
      error: error.message,
    });
  }
};

// @desc    Get student's own applications
// @route   GET /api/applications/my
// @access  Private (Student)
const getMyApplications = async (req, res) => {
  try {
    const studentId = req.student._id;

    const applications = await Application.find({ student: studentId })
      .populate('company')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error('Error in getMyApplications:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching student applications',
      error: error.message,
    });
  }
};

// @desc    Get applications for logged-in recruiter's company
// @route   GET /api/applications/company
// @access  Private (Recruiter only)
const getCompanyApplications = async (req, res) => {
  try {
    const recruiter = req.student;
    let targetCompanyId = recruiter.companyId || recruiter.company;

    if (!targetCompanyId && recruiter.companyName) {
      const company = await Company.findOne({
        $or: [{ hr: recruiter._id }, { name: recruiter.companyName }],
      });
      if (company) {
        targetCompanyId = company._id;
      }
    }

    if (!targetCompanyId) {
      return res.status(200).json({
        success: true,
        count: 0,
        applications: [],
        message: 'No company associated with this recruiter account',
      });
    }

    const applications = await Application.find({ company: targetCompanyId })
      .populate('student', 'name rollNumber branch cgpa email resumeUrl')
      .populate('company', 'name packageOffered rolesOffered')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error('Error in getCompanyApplications:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching company applications',
      error: error.message,
    });
  }
};

// @desc    Get all applications (filtered for HR/Recruiter, all for TPO)
// @route   GET /api/applications
// @access  Private (TPO or recruiter)
const getAllApplications = async (req, res) => {
  try {
    let filter = {};

    // If caller is HR or Recruiter, filter to only candidates who applied to their company
    if (req.student && (req.student.role === 'company_hr' || req.student.role === 'recruiter')) {
      let companyId = req.student.companyId || req.student.company;
      if (!companyId && req.student.companyName) {
        const company = await Company.findOne({
          $or: [{ hr: req.student._id }, { name: req.student.companyName }],
        });
        if (company) {
          companyId = company._id;
        }
      }

      if (!companyId) {
        return res.status(200).json({
          success: true,
          count: 0,
          applications: [],
        });
      }
      filter.company = companyId;
    }

    const applications = await Application.find(filter)
      .populate('student', 'name rollNumber branch cgpa email resumeUrl')
      .populate('company', 'name packageOffered')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error('Error in getAllApplications:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching all applications',
      error: error.message,
    });
  }
};

module.exports = {
  createApplication,
  updateApplicationStage,
  getMyApplications,
  getAllApplications,
  getCompanyApplications,
};
