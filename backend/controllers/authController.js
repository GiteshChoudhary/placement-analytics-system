const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Company = require('../models/Company');
const { sendRecruiterInviteEmail } = require('../utils/emailService');

// Helper function to generate JWT token
const generateToken = (id, email, role) => {
  return jwt.sign({ id, email, role }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  });
};

// @desc    Register a new student
// @route   POST /api/auth/register
// @access  Public
const registerStudent = async (req, res) => {
  try {
    const { name, email, password, rollNumber, branch, cgpa, backlogs, role } = req.body;
    const userRole = role === 'tpo' ? 'tpo' : 'student';

    // 1. Validate common mandatory credentials
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // 2. Student-specific validations (only if role is "student")
    if (userRole === 'student') {
      if (!rollNumber || !branch || cgpa === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Please provide all required student fields (rollNumber, branch, cgpa)',
        });
      }
    }

    // 3. Check for duplicates: email check for all, rollNumber check for students
    const duplicateChecks = [{ email: email.toLowerCase().trim() }];
    if (userRole === 'student' && rollNumber) {
      duplicateChecks.push({ rollNumber: rollNumber.toUpperCase().trim() });
    }

    const existingUser = await Student.findOne({ $or: duplicateChecks });

    if (existingUser) {
      const field = existingUser.email.toLowerCase() === email.toLowerCase().trim() ? 'Email' : 'Roll number';
      return res.status(400).json({
        success: false,
        message: `${field} is already registered`,
      });
    }

    // 4. Build creation payload
    const newUserData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: userRole,
    };

    if (userRole === 'student') {
      newUserData.rollNumber = rollNumber.toUpperCase().trim();
      newUserData.branch = branch;
      newUserData.cgpa = parseFloat(cgpa);
      newUserData.backlogs = backlogs !== undefined ? parseInt(backlogs, 10) || 0 : 0;
    }

    // Create user (password is hashed automatically by Mongoose pre-save hook)
    const student = await Student.create(newUserData);

    // 5. Return user details without password
    return res.status(201).json({
      success: true,
      message: `${userRole === 'tpo' ? 'TPO Officer' : 'Student'} registered successfully`,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber || null,
        branch: student.branch || null,
        cgpa: student.cgpa !== undefined ? student.cgpa : null,
        backlogs: student.backlogs || 0,
        resumeUrl: student.resumeUrl || '',
        role: student.role,
        createdAt: student.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in registerStudent:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
};

// @desc    Authenticate student & get token
// @route   POST /api/auth/login
// @access  Public
const loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email and password presence
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // Find student by email
    const student = await Student.findOne({ email: email.toLowerCase().trim() });

    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare password using helper method
    const isPasswordMatch = await student.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token with role included
    const token = generateToken(student._id, student.email, student.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        branch: student.branch,
        cgpa: student.cgpa,
        backlogs: student.backlogs,
        resumeUrl: student.resumeUrl,
        role: student.role,
        companyName: student.companyName || '',
        company: student.company || null,
        companyId: student.companyId || student.company || null,
      },
    });
  } catch (error) {
    console.error('Error in loginStudent:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
};

// @desc    Invite a Recruiter to onboard for a company
// @route   POST /api/auth/invite-hr
// @access  Private (TPO only)
const inviteHR = async (req, res) => {
  try {
    const { email, companyName, companyId, portalUrl, frontendUrl, clientUrl } = req.body;

    if (!email || (!companyName && !companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide recruiter email and company name',
      });
    }

    // Resolve or find existing Company (read-only; does not create dummy/draft company)
    let company = null;
    if (companyId) {
      company = await Company.findById(companyId);
    }
    if (!company && companyName) {
      company = await Company.findOne({
        name: new RegExp('^' + companyName.trim() + '$', 'i'),
      });
    }

    const resolvedCompanyName = company ? company.name : companyName.trim();
    const resolvedCompanyId = company ? company._id : null;

    // Generate signed invitation token valid for 48 hours
    const inviteToken = jwt.sign(
      {
        email: email.toLowerCase().trim(),
        companyId: resolvedCompanyId,
        companyName: resolvedCompanyName,
        type: 'recruiter_invite',
      },
      process.env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    // Dynamically resolve portal base URL (prefer Vercel/production env var)
    let resolvedUrl =
      process.env.FRONTEND_URL ||
      frontendUrl ||
      portalUrl ||
      clientUrl ||
      process.env.CLIENT_URL;

    if (!resolvedUrl || resolvedUrl.includes('localhost')) {
      if (frontendUrl && !frontendUrl.includes('localhost')) {
        resolvedUrl = frontendUrl;
      } else if (req.headers.origin && !req.headers.origin.includes('localhost')) {
        resolvedUrl = req.headers.origin;
      } else if (req.headers.referer && !req.headers.referer.includes('localhost')) {
        try {
          resolvedUrl = new URL(req.headers.referer).origin;
        } catch (e) {}
      }
    }

    if (!resolvedUrl) {
      resolvedUrl = frontendUrl || 'http://localhost:5173';
    }

    resolvedUrl = resolvedUrl.replace(/\/+$/, '');
    const inviteLink = `${resolvedUrl}/recruiter-setup?token=${inviteToken}`;

    // Send invitation email via Nodemailer
    await sendRecruiterInviteEmail({
      recipientEmail: email.toLowerCase().trim(),
      companyName: resolvedCompanyName,
      token: inviteToken,
      inviteLink,
    });

    return res.status(200).json({
      success: true,
      message: `Invitation email successfully dispatched to ${email} for ${resolvedCompanyName}!`,
      inviteLink,
      companyId: resolvedCompanyId,
      companyName: resolvedCompanyName,
    });
  } catch (error) {
    console.error('[inviteHR Controller Error]:', error.message || error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while sending recruiter invitation',
    });
  }
};

// @desc    Verify recruiter invite token on page load
// @route   GET /api/auth/verify-invite
// @access  Public
const verifyInviteToken = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is missing',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invitation link is invalid or has expired (valid for 48 hours). Please request a new invite from the TPO.',
      });
    }

    if (!decoded.email || (!decoded.companyName && !decoded.companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Malformed invitation token',
      });
    }

    let companyName = decoded.companyName;
    let companyDetails = null;
    if (decoded.companyId) {
      const comp = await Company.findById(decoded.companyId);
      if (comp) {
        companyName = comp.name;
        companyDetails = {
          packageOffered: comp.packageOffered || '',
          minCGPA: comp.eligibilityCriteria?.minCGPA !== undefined ? comp.eligibilityCriteria.minCGPA : '',
          maxBacklogs: comp.eligibilityCriteria?.maxBacklogs !== undefined ? comp.eligibilityCriteria.maxBacklogs : '',
          rolesOffered: Array.isArray(comp.rolesOffered) ? comp.rolesOffered.join(', ') : '',
          description: comp.description || '',
          workCulture: comp.workCulture || '',
          industryType: comp.industryType || '',
          companyLogoUrl: comp.companyLogoUrl || '',
        };
      }
    }

    return res.status(200).json({
      success: true,
      email: decoded.email,
      companyId: decoded.companyId,
      companyName: companyName || 'Company',
      companyDetails,
    });
  } catch (error) {
    console.error('Error in verifyInviteToken:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying invitation',
      error: error.message,
    });
  }
};

// @desc    Register a new Recruiter user via valid invite token (sets password + company hiring details)
// @route   POST /api/auth/register-hr
// @access  Public (Requires valid invite token)
const registerHR = async (req, res) => {
  try {
    const {
      token,
      name,
      password,
      minCGPA,
      maxBacklogs,
      packageOffered,
      rolesOffered,
      description,
      workCulture,
      industryType,
      companyLogoUrl,
    } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide invite token and password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // Verify invitation token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invitation link is invalid or has expired. Please request a new invite from the TPO.',
      });
    }

    const { email, companyId, companyName } = decoded;

    // Check if an account with this email already exists
    let existingUser = await Student.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please log in directly.',
      });
    }

    let resolvedCompany = null;
    if (companyId) {
      resolvedCompany = await Company.findById(companyId);
    }
    if (!resolvedCompany && companyName) {
      resolvedCompany = await Company.findOne({ name: companyName.trim() });
    }

    // Parse and normalize hiring details submitted by recruiter
    const parsedMinCGPA =
      minCGPA !== undefined && minCGPA !== '' ? parseFloat(minCGPA) : 0;
    const parsedMaxBacklogs =
      maxBacklogs !== undefined && maxBacklogs !== '' ? parseInt(maxBacklogs, 10) : 0;
    const parsedPackage =
      packageOffered !== undefined && packageOffered !== '' ? parseFloat(packageOffered) : 0;

    let parsedRoles = [];
    if (Array.isArray(rolesOffered)) {
      parsedRoles = rolesOffered.map((r) => String(r).trim()).filter(Boolean);
    } else if (typeof rolesOffered === 'string') {
      parsedRoles = rolesOffered
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
    }

    // Logo resolution: file upload takes precedence over text field
    const finalLogoUrl = req.file?.key || req.file?.location || (companyLogoUrl && companyLogoUrl.trim()) || '';

    // Create or update the Company record with full hiring and profile details
    if (!resolvedCompany) {
      resolvedCompany = await Company.create({
        name: (companyName && companyName.trim()) || 'Company',
        packageOffered: parsedPackage,
        rolesOffered: parsedRoles,
        description: (description && description.trim()) || '',
        workCulture: (workCulture && workCulture.trim()) || '',
        industryType: (industryType && industryType.trim()) || '',
        companyLogoUrl: finalLogoUrl,
        eligibilityCriteria: {
          minCGPA: parsedMinCGPA,
          maxBacklogs: parsedMaxBacklogs,
        },
      });
    } else {
      if (packageOffered !== undefined && packageOffered !== '') {
        resolvedCompany.packageOffered = parsedPackage;
      }
      if (rolesOffered !== undefined) {
        resolvedCompany.rolesOffered = parsedRoles;
      }
      if (description !== undefined) {
        resolvedCompany.description = description.trim();
      }
      if (workCulture !== undefined) {
        resolvedCompany.workCulture = workCulture.trim();
      }
      if (industryType !== undefined) {
        resolvedCompany.industryType = industryType.trim();
      }
      if (finalLogoUrl) {
        resolvedCompany.companyLogoUrl = finalLogoUrl;
      }
      resolvedCompany.eligibilityCriteria = {
        minCGPA: parsedMinCGPA,
        maxBacklogs: parsedMaxBacklogs,
      };
    }


    const finalCompanyId = resolvedCompany._id;
    const finalCompanyName = resolvedCompany.name;

    const recruiterName = (name && name.trim()) || `${finalCompanyName} Recruiter`;

    // Create user with role "recruiter" and companyId (password hashed by Student pre-save hook)
    const recruiterUser = await Student.create({
      name: recruiterName,
      email: email.toLowerCase().trim(),
      password,
      role: 'recruiter',
      companyId: finalCompanyId,
      company: finalCompanyId,
      companyName: finalCompanyName,
    });

    // Link recruiter to company
    resolvedCompany.hr = recruiterUser._id;
    await resolvedCompany.save();

    // Generate standard authentication token
    const authToken = generateToken(recruiterUser._id, recruiterUser.email, recruiterUser.role);

    return res.status(201).json({
      success: true,
      message: 'Recruiter account registered and company drive configured successfully!',
      token: authToken,
      student: {
        id: recruiterUser._id,
        name: recruiterUser.name,
        email: recruiterUser.email,
        role: recruiterUser.role,
        companyName: recruiterUser.companyName,
        companyId: recruiterUser.companyId || recruiterUser.company || null,
        company: recruiterUser.company || null,
      },
      company: resolvedCompany,
    });
  } catch (error) {
    console.error('Error in registerHR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during recruiter registration',
      error: error.message,
    });
  }
};

module.exports = {
  registerStudent,
  loginStudent,
  inviteHR,
  verifyInviteToken,
  registerHR,
};
