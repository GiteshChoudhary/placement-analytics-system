import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './TPODashboard.css';
import './StudentDashboard.css'; // Reusing stage badge styling

// Register ChartJS modules (required for Chart.js v3/v4 in React)
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const STAGES = ['eligibility', 'aptitude', 'technical', 'offer', 'rejected'];

const TPODashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active tab state ('analytics' | 'applications')
  // Active tab state ('analytics' | 'applications' | 'add-company')
  const [activeTab, setActiveTab] = useState('analytics');

  // Analytics Data States
  const [overview, setOverview] = useState(null);
  const [branchWise, setBranchWise] = useState([]);
  const [companyWise, setCompanyWise] = useState([]);
  const [avgPackage, setAvgPackage] = useState(null);
  const [placedStudents, setPlacedStudents] = useState([]);

  // Applications Management States
  const [allApplications, setAllApplications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingAppId, setUpdatingAppId] = useState(null);
  const [viewingResumeStudentId, setViewingResumeStudentId] = useState(null);

  // Participating Companies States
  const [companiesList, setCompaniesList] = useState([]);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const companiesSectionRef = useRef(null);

  // Invite Recruiter Form State
  const [inviteForm, setInviteForm] = useState({
    email: '',
    companyName: '',
  });
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  const [inviteErrorMsg, setInviteErrorMsg] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState('');

  // General UI States
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch data on initial load
  useEffect(() => {
    fetchAllTPOData();
  }, []);

  const fetchAllTPOData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Concurrently fetch all analytics endpoints + applications + placed students + companies list
      const [
        overviewRes,
        branchRes,
        companyRes,
        pkgRes,
        appsRes,
        placedRes,
        compListRes,
      ] = await Promise.all([
        API.get('/analytics/overview'),
        API.get('/analytics/branch-wise'),
        API.get('/analytics/company-wise'),
        API.get('/analytics/average-package'),
        API.get('/applications'),
        API.get('/analytics/placed-students'),
        API.get('/companies'),
      ]);

      setOverview(overviewRes.data.data);
      setBranchWise(branchRes.data.data || []);
      setCompanyWise(companyRes.data.data || []);
      setAvgPackage(pkgRes.data.data);
      setAllApplications(appsRes.data.applications || []);
      setPlacedStudents(placedRes.data.data || []);
      setCompaniesList(compListRes.data.companies || []);
    } catch (error) {
      console.error('Error fetching TPO data:', error);
      setErrorMessage(
        error.response?.data?.message ||
          'Failed to load TPO dashboard data. Please verify your TPO permissions.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Click handler to open/scroll directly to the participating companies list
  const handleTotalCompaniesClick = () => {
    if (activeTab !== 'analytics') {
      setActiveTab('analytics');
    }
    setTimeout(() => {
      if (companiesSectionRef.current) {
        companiesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  // Invite Form Input Change Handler
  const handleInviteFormChange = (e) => {
    setInviteForm({
      ...inviteForm,
      [e.target.name]: e.target.value,
    });
    if (inviteErrorMsg) setInviteErrorMsg('');
    if (inviteSuccessMsg) setInviteSuccessMsg('');
  };

  // Send Recruiter Invite Handler (Production/Vercel URL resolved automatically)
  const handleSendInvite = async (e) => {
    e.preventDefault();
    setInviteSuccessMsg('');
    setInviteErrorMsg('');
    setLastInviteLink('');
    setIsSendingInvite(true);

    const frontendUrl = import.meta.env.VITE_APP_URL || window.location.origin;

    const payload = {
      companyName: inviteForm.companyName.trim(),
      email: inviteForm.email.trim(),
      frontendUrl,
    };

    console.log('[TPODashboard] Dispatching recruiter invitation payload:', payload);

    try {
      const res = await API.post('/auth/invite-hr', payload);
      console.log('[TPODashboard] Invitation response from server:', res.data);

      if (res.data.success) {
        setToastMessage(`📨 Invitation sent to ${payload.email}!`);
        setTimeout(() => setToastMessage(null), 6000);
        setInviteSuccessMsg(res.data.message);
        if (res.data.inviteLink) {
          setLastInviteLink(res.data.inviteLink);
        }
        setInviteForm({ email: '', companyName: '' });

        // Refresh companies list in case a new draft company was registered
        API.get('/companies').then((cRes) => setCompaniesList(cRes.data.companies || []));
        API.get('/analytics/overview').then((oRes) => setOverview(oRes.data.data));
      }
    } catch (err) {
      console.error('[TPODashboard] Error sending recruiter invite:', err);
      const serverErrMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to send invitation. Please verify the email and company name.';
      setInviteErrorMsg(serverErrMsg);
      alert(`Invitation Error: ${serverErrMsg}`);
    } finally {
      setIsSendingInvite(false);
    }
  };

  // TPO Handler to securely view student resume via presigned URL
  const handleViewStudentResume = async (studentId) => {
    if (!studentId) return;
    setViewingResumeStudentId(studentId);
    try {
      const response = await API.get(`/students/${studentId}/resume-url`);
      if (response.data.success && response.data.presignedUrl) {
        window.open(response.data.presignedUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Failed to retrieve presigned URL');
      }
    } catch (err) {
      console.error('Error opening student resume:', err);
      alert(err.response?.data?.message || 'No resume uploaded for this student or failed to load resume.');
    } finally {
      setViewingResumeStudentId(null);
    }
  };

  // Stage change handler for Tab 2
  const handleStageChange = async (applicationId, newStage) => {
    setUpdatingAppId(applicationId);
    try {
      const response = await API.put(`/applications/${applicationId}/stage`, {
        newStage,
      });

      if (response.data.success) {
        // Update local state immediately without full page reload
        setAllApplications((prev) =>
          prev.map((app) =>
            app._id === applicationId
              ? { ...app, currentStage: newStage }
              : app
          )
        );

        // Show brief success toast
        setToastMessage(`✓ Stage updated to "${newStage}" successfully!`);
        setTimeout(() => setToastMessage(null), 3500);

        // Re-sync analytics in the background
        API.get('/analytics/overview').then((res) => setOverview(res.data.data));
        API.get('/analytics/branch-wise').then((res) => setBranchWise(res.data.data));
        API.get('/analytics/company-wise').then((res) => setCompanyWise(res.data.data));
      }
    } catch (error) {
      alert(
        error.response?.data?.message || 'Failed to update application stage.'
      );
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // -------------------------------------------------------------
  // CHART DATA TRANSFORMATION (For Viva explanation)
  // -------------------------------------------------------------

  // 1. Branch-Wise Bar Chart Data
  const branchChartData = {
    labels: branchWise.map((item) => item.branch),
    datasets: [
      {
        label: 'Total Applications',
        data: branchWise.map((item) => item.totalApplications),
        backgroundColor: 'rgba(99, 102, 241, 0.7)', // Indigo
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
      {
        label: 'Offers Extended',
        data: branchWise.map((item) => item.placedCount),
        backgroundColor: 'rgba(16, 185, 129, 0.75)', // Emerald
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
    ],
  };

  // 2. Company-Wise Recruitment Funnel Bar Chart Data
  const companyChartData = {
    labels: companyWise.map((item) => item.companyName),
    datasets: [
      {
        label: 'Total Applied',
        data: companyWise.map((item) => item.totalApplicants),
        backgroundColor: 'rgba(59, 130, 246, 0.7)', // Blue
      },
      {
        label: 'Technical Round',
        data: companyWise.map((item) => item.technicalStageCount),
        backgroundColor: 'rgba(245, 158, 11, 0.7)', // Amber
      },
      {
        label: 'Offers Extended',
        data: companyWise.map((item) => item.offerCount),
        backgroundColor: 'rgba(16, 185, 129, 0.75)', // Emerald
      },
    ],
  };

  // Chart options to ensure responsive display inside fixed containers
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // Filter applications by student name or company name for search box
  const filteredApplications = allApplications.filter((app) => {
    const studentName = app.student?.name?.toLowerCase() || '';
    const companyName = app.company?.name?.toLowerCase() || '';
    const rollNo = app.student?.rollNumber?.toLowerCase() || '';
    const query = searchTerm.toLowerCase();

    return (
      studentName.includes(query) ||
      companyName.includes(query) ||
      rollNo.includes(query)
    );
  });

  // Filtered participating companies
  const filteredCompanies = companiesList.filter((comp) => {
    const q = companySearchTerm.toLowerCase();
    const nameMatch = comp.name?.toLowerCase().includes(q);
    const roleMatch = comp.rolesOffered?.some((r) => r.toLowerCase().includes(q));
    return nameMatch || roleMatch;
  });

  if (isLoading) {
    return (
      <div className="loading-box">
        <p>Loading TPO Analytics & Management Portal...</p>
      </div>
    );
  }

  return (
    <div className="tpo-container">
      {/* Top TPO Header */}
      <div className="tpo-header">
        <div>
          <h1>
            📊 TPO Placement Portal
            <span className="tpo-badge">ADMIN</span>
          </h1>
          <p>
            Welcome, <strong>{user?.name || 'Placement Officer'}</strong> |
            College Placement Analytics & Candidate Tracking
          </p>
        </div>
        <button onClick={handleLogout} className="tpo-logout-btn">
          Logout
        </button>
      </div>

      {/* Global Error Alert */}
      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      {/* Toast Notification Banner */}
      {toastMessage && <div className="toast-banner">{toastMessage}</div>}

      {/* Tab Navigation Switcher */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics Overview
        </button>
        <button
          className={`tab-button ${
            activeTab === 'applications' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('applications')}
        >
          📋 Manage Applications ({allApplications.length})
        </button>
        <button
          className={`tab-button ${
            activeTab === 'invite-recruiter' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('invite-recruiter')}
        >
          📩 Invite Recruiter
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: Analytics Overview */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'analytics' && (
        <>
          {/* Top Row: 5 Summary Stat Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon icon-blue">👨‍🎓</div>
              <div className="stat-content">
                <h3>{overview?.totalStudents || 0}</h3>
                <p>Registered Students</p>
              </div>
            </div>

            <div
              className="stat-card stat-card-clickable"
              onClick={handleTotalCompaniesClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTotalCompaniesClick(); }}
              title="Click to view all participating companies"
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-icon icon-purple">🏢</div>
              <div className="stat-content">
                <h3>{overview?.totalCompanies || companiesList.length || 0}</h3>
                <p>Participating Companies</p>
                <span className="stat-card-badge">Click to view list ↓</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon icon-amber">📄</div>
              <div className="stat-content">
                <h3>{overview?.totalApplications || 0}</h3>
                <p>Total Applications</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon icon-green">🎯</div>
              <div className="stat-content">
                <h3>{overview?.placementRate || '0.00%'}</h3>
                <p>Overall Placement Rate</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon icon-gold">🏆</div>
              <div className="stat-content">
                <h3>{avgPackage?.highestPackageLPA || 0} LPA</h3>
                <p>Highest Package</p>
              </div>
            </div>
          </div>

          {/* Average Package Highlight Banner */}
          <div className="package-highlight-card">
            <div className="pkg-item">
              <h4>Average Package</h4>
              <div className="pkg-value">
                {avgPackage?.averagePackageLPA || 0} LPA
              </div>
            </div>
            <div className="pkg-item">
              <h4>Highest Package</h4>
              <div className="pkg-value">
                {avgPackage?.highestPackageLPA || 0} LPA
              </div>
            </div>
            <div className="pkg-item">
              <h4>Lowest Package</h4>
              <div className="pkg-value">
                {avgPackage?.lowestPackageLPA || 0} LPA
              </div>
            </div>
            <div className="pkg-item">
              <h4>Recruiting Companies with Offers</h4>
              <div className="pkg-value">
                {avgPackage?.companiesWithOffersCount || 0}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-grid">
            {/* Chart 1: Branch-wise Placement Stats */}
            <div className="chart-card">
              <h3>🎓 Branch-Wise Applications vs Placed</h3>
              {branchWise.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No application data yet.</p>
              ) : (
                <div className="chart-wrapper">
                  <Bar data={branchChartData} options={chartOptions} />
                </div>
              )}
            </div>

            {/* Chart 2: Company-wise Funnel */}
            <div className="chart-card">
              <h3>🏢 Company-Wise Recruitment Funnel</h3>
              {companyWise.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No company data yet.</p>
              ) : (
                <div className="chart-wrapper">
                  <Bar data={companyChartData} options={chartOptions} />
                </div>
              )}
            </div>
          </div>

          {/* Placed Students Table */}
          <div className="placed-section-card">
            <div className="placed-section-header">
              <div>
                <h2>
                  🎉 Placed Students
                  <span className="count-badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                    {placedStudents.length} {placedStudents.length === 1 ? 'Offer' : 'Offers'}
                  </span>
                </h2>
                <p>Students who have successfully cleared interviews and secured final job offers</p>
              </div>
            </div>

            {placedStudents.length === 0 ? (
              <div className="empty-state">
                <p>No students have reached the Offer stage yet.</p>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  When students advance to the "offer" stage in Manage Applications, they will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="applications-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Roll No</th>
                      <th>Branch</th>
                      <th>Company</th>
                      <th>Package Offered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placedStudents.map((app) => (
                      <tr key={app._id}>
                        <td>
                          <strong>{app.student?.name || 'N/A'}</strong>
                        </td>
                        <td>{app.student?.rollNumber || 'N/A'}</td>
                        <td>{app.student?.branch || 'N/A'}</td>
                        <td>
                          <strong>{app.company?.name || 'N/A'}</strong>
                        </td>
                        <td>
                          <span className="package-badge">
                            {app.company?.packageOffered} LPA
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Participating Companies Section (Revealed/Scrolled upon clicking Total Companies stat card) */}
          <div
            ref={companiesSectionRef}
            id="participating-companies-section"
            className="placed-section-card"
            style={{ marginTop: '2rem' }}
          >
            <div className="placed-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2>
                  🏢 Participating Companies
                  <span className="count-badge" style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}>
                    {companiesList.length} {companiesList.length === 1 ? 'Drive' : 'Drives'}
                  </span>
                </h2>
                <p>All recruiting organizations registered in the placement portal with job roles and packages</p>
              </div>
              <input
                type="text"
                className="search-input"
                style={{ maxWidth: '300px' }}
                placeholder="Search companies or roles..."
                value={companySearchTerm}
                onChange={(e) => setCompanySearchTerm(e.target.value)}
              />
            </div>

            {filteredCompanies.length === 0 ? (
              <div className="empty-state">
                <p>{companiesList.length === 0 ? 'No companies registered yet.' : 'No companies match your search criteria.'}</p>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Use the "Invite Recruiter" tab to invite new companies and HR representatives to onboard.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="applications-table">
                  <thead>
                    <tr>
                      <th>Company Name</th>
                      <th>Package Offered</th>
                      <th>Roles Offered</th>
                      <th>Eligibility Criteria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((comp) => (
                      <tr key={comp._id}>
                        <td>
                          <strong>{comp.name}</strong>
                        </td>
                        <td>
                          <span className="package-badge">
                            {comp.packageOffered} LPA
                          </span>
                        </td>
                        <td>
                          {comp.rolesOffered && comp.rolesOffered.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {comp.rolesOffered.map((role, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#334155',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '4px',
                                    fontSize: '0.78rem',
                                    fontWeight: '500',
                                  }}
                                >
                                  {role}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>General Drive</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                            Min CGPA: <strong>{comp.eligibilityCriteria?.minCGPA ?? 0}</strong> | Max Backlogs: <strong>{comp.eligibilityCriteria?.maxBacklogs ?? 0}</strong>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: Manage Applications */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'applications' && (
        <div className="management-card">
          <div className="management-header">
            <h2>All Student Applications</h2>
            <input
              type="text"
              className="search-input"
              placeholder="Search by student, company, roll no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredApplications.length === 0 ? (
            <div className="empty-state">
              <p>No applications match your search criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="applications-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Roll No</th>
                    <th>Branch / CGPA</th>
                    <th>Resume</th>
                    <th>Company</th>
                    <th>Package</th>
                    <th>Current Stage</th>
                    <th>Update Stage (TPO Action)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => (
                    <tr key={app._id}>
                      <td>
                        <strong>{app.student?.name || 'N/A'}</strong>
                      </td>
                      <td>{app.student?.rollNumber || 'N/A'}</td>
                      <td>
                        {app.student?.branch || 'N/A'} (CGPA: {app.student?.cgpa})
                      </td>
                      <td>
                        {app.student?.resumeUrl ? (
                          <button
                            type="button"
                            onClick={() => handleViewStudentResume(app.student._id)}
                            disabled={viewingResumeStudentId === app.student._id}
                            className="view-current-resume-link"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            {viewingResumeStudentId === app.student._id ? 'Opening...' : '📄 View Resume'}
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No Resume</span>
                        )}
                      </td>
                      <td>
                        <strong>{app.company?.name || 'N/A'}</strong>
                      </td>
                      <td>
                        <span className="package-badge">
                          {app.company?.packageOffered} LPA
                        </span>
                      </td>
                      <td>
                        <span
                          className={`stage-badge badge-${app.currentStage}`}
                        >
                          {app.currentStage}
                        </span>
                      </td>
                      <td>
                        {/* Stage Dropdown Selector */}
                        <select
                          className="stage-select"
                          value={app.currentStage}
                          onChange={(e) =>
                            handleStageChange(app._id, e.target.value)
                          }
                          disabled={updatingAppId === app._id}
                        >
                          {STAGES.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage.charAt(0).toUpperCase() + stage.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: Invite Recruiter */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'invite-recruiter' && (
        <div className="add-company-card">
          <div className="section-header">
            <h2>📩 Invite Recruiter to Onboard</h2>
            <p>
              Send an official campus recruitment invitation to the HR or Hiring Manager. They will receive a secure 48-hour onboarding link to configure their recruitment drive and access student applicants.
            </p>
          </div>

          {inviteSuccessMsg && (
            <div className="alert alert-success">
              <p><strong>{inviteSuccessMsg}</strong></p>
              {lastInviteLink && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.88rem' }}>
                  <span>Direct Setup Link (for local testing): </span>
                  <a
                    href={lastInviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#15803d', textDecoration: 'underline', wordBreak: 'break-all' }}
                  >
                    {lastInviteLink}
                  </a>
                </div>
              )}
            </div>
          )}

          {inviteErrorMsg && (
            <div className="alert alert-error">{inviteErrorMsg}</div>
          )}

          <form onSubmit={handleSendInvite} className="add-company-form">
            <div className="form-group">
              <label htmlFor="companyName">Company Name *</label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                placeholder="e.g. Microsoft, Google, Goldman Sachs"
                value={inviteForm.companyName}
                onChange={handleInviteFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">HR / Recruiter Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="e.g. recruiter@company.com"
                value={inviteForm.email}
                onChange={handleInviteFormChange}
                required
              />
            </div>

            <button
              type="submit"
              className="add-company-submit-btn"
              disabled={isSendingInvite}
            >
              {isSendingInvite ? 'Sending Invitation...' : '📨 Send Onboarding Invite'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default TPODashboard;
