const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    eligibilityCriteria: {
      minCGPA: {
        type: Number,
        default: 0,
        min: [0, 'Minimum CGPA cannot be negative'],
        max: [10, 'Minimum CGPA cannot exceed 10'],
      },
      maxBacklogs: {
        type: Number,
        default: 0,
        min: [0, 'Maximum backlogs cannot be negative'],
      },
    },
    packageOffered: {
      type: Number,
      required: [true, 'Package offered (LPA) is required'],
      min: [0, 'Package offered cannot be negative'],
    },
    rolesOffered: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    workCulture: {
      type: String,
      trim: true,
      default: '',
    },
    companyLogoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    industryType: {
      type: String,
      trim: true,
      default: '',
    },
    hr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

const Company = mongoose.model('Company', companySchema);

module.exports = Company;
