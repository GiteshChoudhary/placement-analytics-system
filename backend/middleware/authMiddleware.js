const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extract token from header (Format: "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch student from database excluding password and attach to req.student
      const student = await Student.findById(decoded.id).select('-password');

      if (!student) {
        console.warn(`[Auth] Student not found in DB for decoded token ID: ${decoded.id}`);
        return res.status(401).json({
          success: false,
          message: 'Not authorized, student not found',
        });
      }

      req.student = student;
      next();
    } catch (error) {
      console.error('[Auth] JWT verification error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed or expired',
      });
    }
  }

  if (!token) {
    console.warn('[Auth] No Bearer token provided in Authorization header');
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }
};

// Middleware to restrict access based on roles (e.g., 'tpo', 'student')
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.student || !roles.includes(req.student.role)) {
      console.warn(`[Auth] Forbidden: User role "${req.student?.role}" is not in authorized roles: [${roles.join(', ')}]`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
