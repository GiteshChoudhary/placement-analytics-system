const Student = require('../models/Student');
const Application = require('../models/Application');
const Company = require('../models/Company');
const { getPresignedUrl } = require('../config/s3Config');

// @desc    Upload student resume to AWS S3 & update MongoDB profile with S3 key
// @route   POST /api/students/upload-resume
// @access  Private (Student only)
const uploadResume = async (req, res) => {
  console.log('[Upload Controller] Entering uploadResume controller...');
  try {
    // 1. Verify file presence
    if (!req.file) {
      console.log('[Upload Controller] req.file is missing. File might not have been provided or field name is incorrect.');
      return res.status(400).json({
        success: false,
        message: 'Please select a PDF resume file to upload (field name: "resume")',
      });
    }

    // 2. Extract S3 object key (e.g. "resumes/studentId_timestamp.pdf")
    const resumeKey = req.file.key;
    console.log('[Upload Controller] File uploaded successfully to S3. Object Key:', resumeKey);

    // 3. Save S3 key to the student record in MongoDB (instead of full public URL)
    console.log('[Upload Controller] Updating MongoDB student profile for ID:', req.student._id);
    const updatedStudent = await Student.findByIdAndUpdate(
      req.student._id,
      { resumeUrl: resumeKey },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedStudent) {
      console.log('[Upload Controller] Student profile not found in MongoDB.');
      return res.status(404).json({
        success: false,
        message: 'Student profile not found',
      });
    }

    console.log('[Upload Controller] MongoDB update successful. Generating initial presigned URL...');
    const presignedUrl = await getPresignedUrl(resumeKey, 300);

    return res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully to AWS S3',
      resumeKey: updatedStudent.resumeUrl,
      resumeUrl: presignedUrl, // returns presigned URL for immediate frontend access
      student: updatedStudent,
    });
  } catch (error) {
    console.error('[Upload Controller] Error in uploadResume:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while saving resume',
      error: error.message,
    });
  }
};

// @desc    Get current student profile (supports /profile and /me)
// @route   GET /api/students/profile or GET /api/students/me
// @access  Private (Student only)
const getStudentProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.student._id).select('-password');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found',
      });
    }
    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error('Error in getStudentProfile:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching student profile',
      error: error.message,
    });
  }
};

// @desc    Get temporary presigned URL for logged-in student's resume
// @route   GET /api/students/resume-url
// @access  Private (Student only)
const getStudentResumeUrl = async (req, res) => {
  try {
    const student = await Student.findById(req.student._id);
    if (!student || !student.resumeUrl) {
      return res.status(404).json({
        success: false,
        message: 'No resume uploaded yet for this student',
      });
    }

    const presignedUrl = await getPresignedUrl(student.resumeUrl, 300);

    return res.status(200).json({
      success: true,
      presignedUrl,
      expiresIn: 300,
    });
  } catch (error) {
    console.error('[Resume URL] Error generating presigned URL:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate secure resume URL',
      error: error.message,
    });
  }
};

// @desc    Get temporary presigned URL for a student's resume (TPO & Recruiter view)
// @route   GET /api/students/:id/resume-url
// @access  Private (TPO, Recruiter)
const getStudentResumeUrlById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // If caller is a recruiter, verify student applied to this recruiter's company first
    if (req.student && (req.student.role === 'recruiter' || req.student.role === 'company_hr')) {
      let companyId = req.student.companyId || req.student.company;
      if (!companyId && req.student.companyName) {
        const comp = await Company.findOne({
          $or: [{ hr: req.student._id }, { name: req.student.companyName }],
        });
        if (comp) companyId = comp._id;
      }

      if (!companyId) {
        return res.status(403).json({
          success: false,
          message: 'No company drive associated with your recruiter account',
        });
      }

      const application = await Application.findOne({
        student: student._id,
        company: companyId,
      });

      if (!application) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view resumes of students who applied to your company',
        });
      }
    }

    if (!student.resumeUrl) {
      return res.status(404).json({
        success: false,
        message: 'No resume found for this student',
      });
    }

    const presignedUrl = await getPresignedUrl(student.resumeUrl, 300);

    return res.status(200).json({
      success: true,
      studentName: student.name,
      studentId: student._id,
      presignedUrl,
      expiresIn: 300,
    });
  } catch (error) {
    console.error('[Resume URL] Error generating presigned URL:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate secure resume URL',
      error: error.message,
    });
  }
};

const getStudentMe = getStudentProfile;

module.exports = {
  uploadResume,
  getStudentProfile,
  getStudentMe,
  getStudentResumeUrl,
  getStudentResumeUrlById,
};

