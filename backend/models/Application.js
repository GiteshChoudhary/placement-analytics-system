const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID reference is required'],
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID reference is required'],
    },
    currentStage: {
      type: String,
      enum: {
        values: ['eligibility', 'aptitude', 'technical', 'offer', 'rejected'],
        message: '{VALUE} is not a valid placement stage',
      },
      default: 'eligibility',
    },
    stageHistory: [
      {
        stage: {
          type: String,
          enum: ['eligibility', 'aptitude', 'technical', 'offer', 'rejected'],
          required: true,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Compound index to prevent duplicate applications for the same company by the same student
applicationSchema.index({ student: 1, company: 1 }, { unique: true });

// Pre-save hook: Automatically initialize stageHistory with the starting stage on creation
applicationSchema.pre('save', function () {
  if (this.isNew && (!this.stageHistory || this.stageHistory.length === 0)) {
    this.stageHistory.push({
      stage: this.currentStage,
      updatedAt: new Date(),
    });
  }
});

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;
