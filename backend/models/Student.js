const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    rollNumber: {
      type: String,
      required: [
        function () {
          return this.role === 'student';
        },
        'Roll number is required for students',
      ],
      unique: true,
      sparse: true, // Crucial: allows multiple TPOs without rollNumber without duplicate key errors
      trim: true,
      uppercase: true,
    },
    branch: {
      type: String,
      required: [
        function () {
          return this.role === 'student';
        },
        'Branch is required for students',
      ],
      trim: true,
    },
    cgpa: {
      type: Number,
      required: [
        function () {
          return this.role === 'student';
        },
        'CGPA is required for students',
      ],
      min: [0, 'CGPA cannot be less than 0'],
      max: [10, 'CGPA cannot be more than 10'],
    },
    backlogs: {
      type: Number,
      default: 0,
      min: [0, 'Backlogs cannot be negative'],
    },
    resumeUrl: {
      type: String,
      default: '',
      trim: true,
      // Stores S3 object key (e.g., "resumes/studentId_timestamp.pdf") for generating secure temporary presigned URLs
    },
    role: {
      type: String,
      enum: {
        values: ['student', 'tpo', 'recruiter', 'company_hr'],
        message: '{VALUE} is not a valid role',
      },
      default: 'student',
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Pre-save hook: Hash password before saving if modified
studentSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Helper method to compare passwords during login
studentSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
