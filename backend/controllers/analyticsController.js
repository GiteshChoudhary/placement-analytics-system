const Application = require('../models/Application');
const Student = require('../models/Student');
const Company = require('../models/Company');

/**
 * @desc    Get overall placement overview statistics
 * @route   GET /api/analytics/overview
 * @access  Private (TPO only)
 * 
 * Example Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalStudents": 120,
 *     "totalCompanies": 15,
 *     "totalApplications": 240,
 *     "studentsApplied": 95,
 *     "studentsPlaced": 60,
 *     "placementRate": "63.16%"
 *   }
 * }
 */
const getOverallStats = async (req, res) => {
  try {
    // 1. Total registered students (excluding TPO admins)
    const totalStudents = await Student.countDocuments({ role: 'student' });

    // 2. Total registered companies
    const totalCompanies = await Company.countDocuments();

    // 3. Total applications submitted
    const totalApplications = await Application.countDocuments();

    // 4. Distinct students who have applied to at least 1 company
    const studentsAppliedIds = await Application.distinct('student');
    const studentsAppliedCount = studentsAppliedIds.length;

    // 5. Distinct students who have received at least 1 'offer'
    const studentsPlacedIds = await Application.distinct('student', {
      currentStage: 'offer',
    });
    const studentsPlacedCount = studentsPlacedIds.length;

    // 6. Placement rate calculation (Placed students / Students who applied) * 100
    const placementRate = studentsAppliedCount > 0
      ? ((studentsPlacedCount / studentsAppliedCount) * 100).toFixed(2)
      : '0.00';

    return res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalCompanies,
        totalApplications,
        studentsApplied: studentsAppliedCount,
        studentsPlaced: studentsPlacedCount,
        placementRate: `${placementRate}%`,
      },
    });
  } catch (error) {
    console.error('Error in getOverallStats:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while calculating overall statistics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get branch-wise application and placement statistics
 * @route   GET /api/analytics/branch-wise
 * @access  Private (TPO only)
 * 
 * Example Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "branch": "Computer Science",
 *       "totalApplications": 85,
 *       "uniqueStudentsApplied": 40,
 *       "placedCount": 28,
 *       "branchPlacementRate": "70.00%"
 *     },
 *     {
 *       "branch": "Information Technology",
 *       "totalApplications": 60,
 *       "uniqueStudentsApplied": 30,
 *       "placedCount": 18,
 *       "branchPlacementRate": "60.00%"
 *     }
 *   ]
 * }
 */
const getBranchWiseStats = async (req, res) => {
  try {
    /**
     * Aggregation Pipeline Breakdown:
     * 1. $lookup: Joins Application with Student collection to get student details (branch).
     * 2. $unwind: Deconstructs the studentDetails array from lookup into a single object.
     * 3. $group: Groups documents by student's branch and calculates:
     *    - totalApplications: count of all applications in this branch
     *    - uniqueStudents: set of unique student IDs who applied
     *    - uniquePlacedStudents: set of unique student IDs who got an 'offer'
     * 4. $project: Formats the final output and calculates placement percentage per branch.
     * 5. $sort: Sorts branches alphabetically.
     */
    const branchStats = await Application.aggregate([
      // Stage 1: Join with students collection
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentDetails',
        },
      },
      // Stage 2: Flatten array from lookup
      {
        $unwind: '$studentDetails',
      },
      // Stage 3: Group by Branch
      {
        $group: {
          _id: '$studentDetails.branch',
          totalApplications: { $sum: 1 },
          uniqueStudents: { $addToSet: '$student' },
          uniquePlacedStudents: {
            $addToSet: {
              $cond: [{ $eq: ['$currentStage', 'offer'] }, '$student', '$$REMOVE'],
            },
          },
        },
      },
      // Stage 4: Reshape output and calculate branch placement rate
      {
        $project: {
          _id: 0,
          branch: '$_id',
          totalApplications: 1,
          uniqueStudentsApplied: { $size: '$uniqueStudents' },
          placedCount: { $size: '$uniquePlacedStudents' },
          branchPlacementRate: {
            $concat: [
              {
                $toString: {
                  $cond: [
                    { $gt: [{ $size: '$uniqueStudents' }, 0] },
                    {
                      $round: [
                        {
                          $multiply: [
                            {
                              $divide: [
                                { $size: '$uniquePlacedStudents' },
                                { $size: '$uniqueStudents' },
                              ],
                            },
                            100,
                          ],
                        },
                        2,
                      ],
                    },
                    0,
                  ],
                },
              },
              '%',
            ],
          },
        },
      },
      // Stage 5: Sort by branch name
      {
        $sort: { branch: 1 },
      },
    ]);

    return res.status(200).json({
      success: true,
      count: branchStats.length,
      data: branchStats,
    });
  } catch (error) {
    console.error('Error in getBranchWiseStats:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while calculating branch-wise statistics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get company-wise funnel statistics (applied, technical, offer)
 * @route   GET /api/analytics/company-wise
 * @access  Private (TPO only)
 * 
 * Example Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "companyId": "66d5b9...",
 *       "companyName": "Google",
 *       "packageOffered": 24,
 *       "totalApplicants": 50,
 *       "technicalStageCount": 12,
 *       "offerCount": 4
 *     }
 *   ]
 * }
 */
const getCompanyWiseStats = async (req, res) => {
  try {
    /**
     * Aggregation Pipeline Breakdown:
     * 1. $group: Groups applications by company ID and counts:
     *    - totalApplicants: total applications submitted
     *    - technicalStageCount: count where currentStage is 'technical'
     *    - offerCount: count where currentStage is 'offer'
     * 2. $lookup: Joins with companies collection to retrieve company name and package.
     * 3. $unwind: Flattens the companyDetails array.
     * 4. $project: Selects clean display fields.
     * 5. $sort: Sorts companies with the highest applicants first.
     */
    const companyStats = await Application.aggregate([
      // Stage 1: Group by Company ID and count funnel stages
      {
        $group: {
          _id: '$company',
          totalApplicants: { $sum: 1 },
          technicalStageCount: {
            $sum: { $cond: [{ $eq: ['$currentStage', 'technical'] }, 1, 0] },
          },
          offerCount: {
            $sum: { $cond: [{ $eq: ['$currentStage', 'offer'] }, 1, 0] },
          },
        },
      },
      // Stage 2: Join with companies collection
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: '_id',
          as: 'companyDetails',
        },
      },
      // Stage 3: Flatten companyDetails array
      {
        $unwind: '$companyDetails',
      },
      // Stage 4: Project clean format
      {
        $project: {
          _id: 0,
          companyId: '$_id',
          companyName: '$companyDetails.name',
          packageOffered: '$companyDetails.packageOffered',
          totalApplicants: 1,
          technicalStageCount: 1,
          offerCount: 1,
        },
      },
      // Stage 5: Sort by most applicants
      {
        $sort: { totalApplicants: -1 },
      },
    ]);

    return res.status(200).json({
      success: true,
      count: companyStats.length,
      data: companyStats,
    });
  } catch (error) {
    console.error('Error in getCompanyWiseStats:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while calculating company-wise statistics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get average package of placed companies
 * @route   GET /api/analytics/average-package
 * @access  Private (TPO only)
 * 
 * Example Response:
 * {
 *   "success": true,
 *   "data": {
 *     "averagePackageLPA": 14.5,
 *     "highestPackageLPA": 24,
 *     "lowestPackageLPA": 6.5,
 *     "companiesWithOffersCount": 3
 *   }
 * }
 */
const getAveragePackage = async (req, res) => {
  try {
    /**
     * Aggregation Pipeline Breakdown:
     * 1. $match: Filter applications that achieved an 'offer' stage.
     * 2. $group: Group by company to get unique placed companies.
     * 3. $lookup: Join with companies collection to fetch packageOffered.
     * 4. $unwind: Flatten companyDetails.
     * 5. $group: Group all results together (null ID) to compute $avg, $max, $min, $sum.
     * 6. $project: Format the response nicely.
     */
    const result = await Application.aggregate([
      // Stage 1: Only applications that resulted in an offer
      {
        $match: { currentStage: 'offer' },
      },
      // Stage 2: Group by company ID to avoid double-counting same company package
      {
        $group: {
          _id: '$company',
        },
      },
      // Stage 3: Fetch company details
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: '_id',
          as: 'companyDetails',
        },
      },
      // Stage 4: Flatten company details
      {
        $unwind: '$companyDetails',
      },
      // Stage 5: Calculate overall average, max, min across companies
      {
        $group: {
          _id: null,
          averagePackageLPA: { $avg: '$companyDetails.packageOffered' },
          highestPackageLPA: { $max: '$companyDetails.packageOffered' },
          lowestPackageLPA: { $min: '$companyDetails.packageOffered' },
          companiesWithOffersCount: { $sum: 1 },
        },
      },
      // Stage 6: Reshape final response
      {
        $project: {
          _id: 0,
          averagePackageLPA: { $round: ['$averagePackageLPA', 2] },
          highestPackageLPA: 1,
          lowestPackageLPA: 1,
          companiesWithOffersCount: 1,
        },
      },
    ]);

    // Handle case where no offers exist yet
    const data = result.length > 0
      ? result[0]
      : {
          averagePackageLPA: 0,
          highestPackageLPA: 0,
          lowestPackageLPA: 0,
          companiesWithOffersCount: 0,
        };

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error in getAveragePackage:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while calculating average package',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all placed students (applications where currentStage is 'offer')
 * @route   GET /api/analytics/placed-students
 * @access  Private (TPO only)
 */
const getPlacedStudents = async (req, res) => {
  try {
    const placedStudents = await Application.find({ currentStage: 'offer' })
      .populate('student', 'name rollNumber branch email')
      .populate('company', 'name packageOffered')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: placedStudents.length,
      data: placedStudents,
    });
  } catch (error) {
    console.error('Error in getPlacedStudents:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching placed students',
      error: error.message,
    });
  }
};

module.exports = {
  getOverallStats,
  getBranchWiseStats,
  getCompanyWiseStats,
  getAveragePackage,
  getPlacedStudents,
};
