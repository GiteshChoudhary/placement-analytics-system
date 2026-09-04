import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './RecruiterDashboard.css';
import './StudentDashboard.css'; // Reuse stage badge colors

const RecruiterDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [viewingResumeId, setViewingResumeId] = useState(null);

  // Fetch applications for this recruiter's company on mount
  useEffect(() => {
    fetchCompanyApplications();
  }, []);

  const fetchCompanyApplications = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await API.get('/applications/company');
      if (response.data.success) {
        setApplications(response.data.applications || []);
      }
    } catch (error) {
      console.error('Error fetching company applications:', error);
      setErrorMessage(
        error.response?.data?.message ||
          'Failed to load applications. Please verify your recruiter session.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Securely open student's resume via presigned URL (scoped to applicants)
  const handleViewResume = async (studentId) => {
    if (!studentId) return;
    setViewingResumeId(studentId);
    try {
      const res = await API.get(`/students/${studentId}/resume-url`);
      if (res.data.success && res.data.presignedUrl) {
        window.open(res.data.presignedUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('Resume URL could not be generated.');
      }
    } catch (err) {
      console.error('Failed to retrieve resume URL:', err);
      alert(
        err.response?.data?.message ||
          'Failed to access student resume. Ensure the student has uploaded a resume.'
      );
    } finally {
      setViewingResumeId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Derived Company Info from first application or user profile
  const companyName =
    applications[0]?.company?.name || user?.companyName || 'Your Company';
  const packageOffered = applications[0]?.company?.packageOffered;

  // Filter applications by search term and stage
  const filteredApplications = applications.filter((app) => {
    const student = app.student || {};
    const query = searchTerm.toLowerCase();

    const matchesSearch =
      (student.name || '').toLowerCase().includes(query) ||
      (student.rollNumber || '').toLowerCase().includes(query) ||
      (student.branch || '').toLowerCase().includes(query);

    const matchesStage =
      stageFilter === 'all' || app.currentStage === stageFilter;

    return matchesSearch && matchesStage;
  });

  // Calculate quick summary metrics
  const totalCount = applications.length;
  const inTechCount = applications.filter(
    (a) => a.currentStage === 'technical'
  ).length;
  const offerCount = applications.filter(
    (a) => a.currentStage === 'offer'
  ).length;
  const avgCGPA =
    totalCount > 0
      ? (
          applications.reduce((acc, a) => acc + (a.student?.cgpa || 0), 0) /
          totalCount
        ).toFixed(2)
      : '0.00';

  return (
    <div className="recruiter-container">
      {/* Top Header */}
      <div className="recruiter-header">
        <div>
          <div className="recruiter-badge-row">
            <span className="role-tag-badge">RECRUITER PORTAL</span>
            <span className="company-badge-name">🏢 {companyName}</span>
          </div>
          <h1>Candidate Applications</h1>
          <p>
            Welcome, <strong>{user?.name || user?.email}</strong> | Campus
            Recruitment Drive Candidate Tracking
            {packageOffered !== undefined && ` (${packageOffered} LPA)`}
          </p>
        </div>
        <div className="recruiter-header-actions">
          <button
            onClick={fetchCompanyApplications}
            className="recruiter-refresh-btn"
            title="Refresh candidate list"
          >
            🔄 Refresh
          </button>
          <button onClick={handleLogout} className="recruiter-logout-btn">
            Logout
          </button>
        </div>
      </div>

      {/* Info Notice Banner */}
      <div className="recruiter-notice-banner">
        <span>ℹ️</span>
        <div>
          <strong>Read-Only Candidate View:</strong> You are viewing students
          who have applied to <strong>{companyName}</strong>. Official stage
          transitions (Aptitude, Technical, Final Offer) are recorded and managed
          by the campus Training & Placement Office (TPO).
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      {/* Summary KPI Cards */}
      <div className="recruiter-stats-grid">
        <div className="recruiter-stat-card">
          <div className="r-stat-icon icon-blue">📋</div>
          <div>
            <h3>{totalCount}</h3>
            <p>Total Applicants</p>
          </div>
        </div>

        <div className="recruiter-stat-card">
          <div className="r-stat-icon icon-amber">⚙️</div>
          <div>
            <h3>{inTechCount}</h3>
            <p>In Technical Round</p>
          </div>
        </div>

        <div className="recruiter-stat-card">
          <div className="r-stat-icon icon-green">🎉</div>
          <div>
            <h3>{offerCount}</h3>
            <p>Final Offers Extended</p>
          </div>
        </div>

        <div className="recruiter-stat-card">
          <div className="r-stat-icon icon-purple">🎓</div>
          <div>
            <h3>{avgCGPA}</h3>
            <p>Average Applicant CGPA</p>
          </div>
        </div>
      </div>

      {/* Candidates Management Card */}
      <div className="recruiter-table-card">
        <div className="recruiter-table-header">
          <div className="recruiter-search-box">
            <input
              type="text"
              placeholder="Search by student name, roll number, or branch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="recruiter-search-input"
            />
          </div>

          <div className="recruiter-filter-group">
            <label htmlFor="stageFilter">Filter by Stage:</label>
            <select
              id="stageFilter"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="recruiter-filter-select"
            >
              <option value="all">All Stages ({totalCount})</option>
              <option value="eligibility">Eligibility</option>
              <option value="aptitude">Aptitude</option>
              <option value="technical">Technical</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-box" style={{ padding: '3rem 1rem' }}>
            <p>Loading candidate applications...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="app-empty-state">
            <div className="app-empty-icon-box">📭</div>
            <h3 className="app-empty-title">
              {applications.length === 0
                ? 'No students have applied to this drive yet'
                : 'No candidates match your filters'}
            </h3>
            <p className="app-empty-desc">
              {applications.length === 0
                ? 'When eligible students apply to your placement drive from their portal, their applications will appear here in real-time.'
                : 'Try adjusting your search keywords or round stage filter.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Branch</th>
                  <th>CGPA</th>
                  <th>Current Stage</th>
                  <th>Resume</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((app) => {
                  const student = app.student;
                  const isOpeningResume =
                    viewingResumeId === student?._id;

                  return (
                    <tr key={app._id}>
                      <td>
                        <strong>{student?.name || 'N/A'}</strong>
                        {student?.email && (
                          <span className="student-email-sub">
                            {student.email}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="roll-number-tag">
                          {student?.rollNumber || 'N/A'}
                        </span>
                      </td>
                      <td>{student?.branch || 'N/A'}</td>
                      <td>
                        <strong>{student?.cgpa !== undefined ? student.cgpa : 'N/A'}</strong>
                      </td>
                      <td>
                        <span className={`stage-badge badge-${app.currentStage}`}>
                          {app.currentStage}
                        </span>
                      </td>
                      <td>
                        {student?.resumeUrl ? (
                          <button
                            type="button"
                            onClick={() => handleViewResume(student._id)}
                            disabled={isOpeningResume}
                            className="recruiter-resume-btn"
                          >
                            {isOpeningResume ? 'Opening...' : '📄 View Resume'}
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                            No Resume
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruiterDashboard;
