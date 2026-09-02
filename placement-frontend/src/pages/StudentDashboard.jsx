import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './StudentDashboard.css';

// Ordered sequence of placement stages for the progress stepper
const STAGE_ORDER = ['eligibility', 'aptitude', 'technical', 'offer'];

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State management
  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [applyingCompanyId, setApplyingCompanyId] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // Real-time notification state (from Socket.io)
  const [realtimeNotification, setRealtimeNotification] = useState(null);

  // Resume state management
  const [resumeUrl, setResumeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isViewingResume, setIsViewingResume] = useState(false);
  const [resumeAlert, setResumeAlert] = useState(null); // { type: 'success' | 'error', text: string }
  const fileInputRef = useRef(null);

  // Fetch student applications, companies, and profile on mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // =========================================================================
  // REAL-TIME NOTIFICATIONS VIA SOCKET.IO
  // =========================================================================
  // 1. Establishes a persistent WebSocket connection to backend (http://localhost:5000)
  // 2. Emits "register" event with the logged-in student's ID so backend can map studentId -> socket.id
  // 3. Listens for "stageUpdated" event emitted whenever a TPO updates the student's interview stage
  // 4. On event: displays a toast notification and refreshes application data silently without page reload
  // 5. Cleanup: disconnects socket when component unmounts to prevent memory leaks and ghost listeners
  useEffect(() => {
    const studentId = user?._id || user?.id;
    if (!studentId) return;

    // Connect to Socket.io server on backend
    const getSocketUrl = () => {
      if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
      if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return window.location.origin;
      }
      return 'http://localhost:5000';
    };

    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log(`[Socket.io] Connected to server with socket ID: ${socket.id}`);
      // Register this student's ID on the server
      socket.emit('register', studentId);
    });

    // Listen for real-time application stage updates from TPO
    socket.on('stageUpdated', (data) => {
      console.log('[Socket.io] Real-time stage update received:', data);

      const stageDisplay = data.newStage
        ? data.newStage.charAt(0).toUpperCase() + data.newStage.slice(1)
        : 'new stage';
      const company = data.companyName || 'the company';

      // Show real-time notification toast banner
      setRealtimeNotification({
        title: 'Application Stage Updated!',
        text: `Your application to ${company} moved to ${stageDisplay} round!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // Automatically refresh applications list without a full page reload
      fetchApplicationsOnly();
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected from server');
    });

    // Cleanup: Disconnect socket when component unmounts
    return () => {
      console.log('[Socket.io] Cleaning up socket connection on unmount...');
      socket.disconnect();
    };
  }, [user]);

  // Silent refresh of applications data without toggling the full-page isLoading spinner
  const fetchApplicationsOnly = async () => {
    try {
      const appsRes = await API.get('/applications/my');
      setApplications(appsRes.data.applications || []);
    } catch (error) {
      console.error('Error refreshing applications on socket event:', error);
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Execute all requests concurrently using Promise.allSettled
      const [appsRes, companiesRes, profileRes] = await Promise.allSettled([
        API.get('/applications/my'),
        API.get('/companies'),
        API.get('/students/me'),
      ]);

      if (appsRes.status === 'fulfilled') {
        setApplications(appsRes.value.data.applications || []);
      }
      if (companiesRes.status === 'fulfilled') {
        setCompanies(companiesRes.value.data.companies || []);
      }
      if (profileRes.status === 'fulfilled' && profileRes.value.data.student?.resumeUrl) {
        setResumeUrl(profileRes.value.data.student.resumeUrl);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setAlertMessage({
        type: 'error',
        text:
          error.response?.data?.message ||
          'Failed to load dashboard data. Please ensure the backend is running.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: check if student has already applied to a company
  const hasApplied = (companyId) => {
    return applications.some((app) => app.company?._id === companyId);
  };

  // View resume via temporary presigned URL
  const handleViewResume = async (e) => {
    if (e) e.preventDefault();
    setIsViewingResume(true);
    setResumeAlert(null);

    try {
      const response = await API.get('/students/resume-url');
      if (response.data.success && response.data.presignedUrl) {
        window.open(response.data.presignedUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Failed to retrieve secure resume download link');
      }
    } catch (error) {
      console.error('Error fetching presigned resume URL:', error);
      setResumeAlert({
        type: 'error',
        text:
          error.response?.data?.message ||
          'Failed to open resume. Please try again.',
      });
    } finally {
      setIsViewingResume(false);
    }
  };

  // Resume File Selection Handler with validation
  const handleFileChange = (e) => {
    setResumeAlert(null);
    const file = e.target.files[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // 1. Validate file type (PDF only)
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setResumeAlert({
        type: 'error',
        text: 'Only PDF files allowed. Please select a valid .pdf file.',
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Validate file size (max 5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setResumeAlert({
        type: 'error',
        text: 'File too large - max 5MB. Please choose a smaller PDF file.',
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  // Resume Upload / Replace Handler
  const handleResumeUpload = async (e) => {
    e.preventDefault();
    setResumeAlert(null);

    if (!selectedFile) {
      setResumeAlert({
        type: 'error',
        text: 'Please select a PDF file first.',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('resume', selectedFile);

      const token = localStorage.getItem('token');
      const response = await API.post('/students/upload-resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        const newUrl = response.data.resumeKey || response.data.resumeUrl;
        setResumeUrl(newUrl);
        setResumeAlert({
          type: 'success',
          text: resumeUrl
            ? 'Resume replaced successfully!'
            : 'Resume uploaded successfully!',
        });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      const errorMsg =
        error.response?.data?.message ||
        'Failed to upload resume. Please try again.';
      setResumeAlert({
        type: 'error',
        text: errorMsg,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Apply to a company
  const handleApply = async (companyId) => {
    setAlertMessage(null);
    setApplyingCompanyId(companyId);

    try {
      const response = await API.post('/applications', { companyId });

      if (response.data.success) {
        setAlertMessage({
          type: 'success',
          text: `🎉 Successfully applied to ${response.data.application.company?.name || 'the company'}!`,
        });

        // Automatically refresh applications list
        await fetchDashboardData();
      }
    } catch (error) {
      // Capture eligibility error (e.g. 400 CGPA / backlog criteria)
      const errorMsg =
        error.response?.data?.message ||
        'Failed to submit application. Please try again.';
      setAlertMessage({
        type: 'error',
        text: `Application Failed: ${errorMsg}`,
      });
    } finally {
      setApplyingCompanyId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Render visual progress stepper for an application
  const renderProgressStepper = (currentStage) => {
    const isRejected = currentStage === 'rejected';
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    if (isRejected) {
      return (
        <span className="stage-badge badge-rejected">
          ❌ Application Rejected
        </span>
      );
    }

    return (
      <div className="stage-stepper">
        {STAGE_ORDER.map((stage, idx) => {
          const isCompleted = currentIndex > idx;
          const isActive = currentIndex === idx;

          return (
            <React.Fragment key={stage}>
              <div
                className={`step-node ${isCompleted ? 'completed' : ''} ${
                  isActive ? 'active' : ''
                }`}
              >
                <div className="step-circle">
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span className="step-label">
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </span>
              </div>
              {idx < STAGE_ORDER.length - 1 && (
                <div
                  className={`step-line ${isCompleted ? 'completed' : ''}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="loading-box">
        <p>Loading your placement dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Top Student Profile Header */}
      <div className="profile-card">
        <div className="profile-info">
          <h1>Welcome, {user?.name || 'Student'} 👋</h1>
          <div className="profile-meta">
            <span><strong>Roll No:</strong> {user?.rollNumber || 'N/A'}</span>
            <span><strong>Branch:</strong> {user?.branch || 'N/A'}</span>
            <span><strong>CGPA:</strong> {user?.cgpa !== undefined ? user.cgpa : 'N/A'}</span>
            <span><strong>Backlogs:</strong> {user?.backlogs !== undefined ? user.backlogs : 0}</span>
          </div>
        </div>
        <div className="profile-actions">
          <button onClick={handleLogout} className="logout-header-btn">
            Logout
          </button>
        </div>
      </div>

      {/* Global Alert Notification */}
      {alertMessage && (
        <div
          className={`alert ${
            alertMessage.type === 'success' ? 'alert-success' : 'alert-error'
          }`}
          style={{ marginBottom: '0' }}
        >
          {alertMessage.text}
        </div>
      )}

      {/* Real-time Socket.io Stage Update Toast Banner */}
      {realtimeNotification && (
        <div className="realtime-notification-banner">
          <div className="realtime-notification-left">
            <span className="realtime-bell-icon">🔔</span>
            <div>
              <div className="realtime-notification-title">
                {realtimeNotification.title}
                <span className="realtime-time-badge">{realtimeNotification.time}</span>
              </div>
              <p className="realtime-notification-text">{realtimeNotification.text}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRealtimeNotification(null)}
            className="realtime-dismiss-btn"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION: My Resume (Top Section) */}
      <section className="dashboard-section resume-section">
        <div className="section-header">
          <h2>
            📄 My Resume
            {resumeUrl && <span className="count-badge resume-badge-active">Uploaded</span>}
          </h2>
        </div>

        {/* Resume-specific Alert */}
        {resumeAlert && (
          <div
            className={`alert ${
              resumeAlert.type === 'success' ? 'alert-success' : 'alert-error'
            }`}
          >
            <span>{resumeAlert.text}</span>
            {resumeAlert.type === 'success' && resumeUrl && (
              <button
                type="button"
                onClick={handleViewResume}
                disabled={isViewingResume}
                className="resume-alert-btn"
              >
                {isViewingResume ? 'Opening...' : 'View Resume ↗'}
              </button>
            )}
          </div>
        )}

        <div className="resume-card-body">
          {/* Resume status summary */}
          {resumeUrl ? (
            <div className="resume-status-box has-resume">
              <div className="resume-status-left">
                <span className="resume-status-icon">✅</span>
                <div>
                  <div className="resume-status-title">Current Resume on file</div>
                  <div className="resume-status-desc">
                    Your PDF resume is uploaded and ready for job applications.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleViewResume}
                disabled={isViewingResume}
                className="view-current-resume-link"
              >
                {isViewingResume ? 'Opening...' : 'View Current Resume ↗'}
              </button>
            </div>
          ) : (
            <div className="resume-status-box no-resume">
              <div className="resume-status-left">
                <span className="resume-status-icon">⚠️</span>
                <div>
                  <div className="resume-status-title">No resume uploaded</div>
                  <div className="resume-status-desc">
                    Upload your PDF resume (max 5MB) so companies can review your profile.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload / Replace Form */}
          <form onSubmit={handleResumeUpload} className="resume-upload-form">
            <div className="resume-input-group">
              <input
                type="file"
                id="resume-file"
                ref={fileInputRef}
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                disabled={isUploading}
                className="resume-hidden-input"
              />
              <label htmlFor="resume-file" className="resume-file-label">
                <span className="resume-browse-btn">Choose PDF</span>
                <span className="resume-file-name">
                  {selectedFile
                    ? selectedFile.name
                    : resumeUrl
                    ? 'Choose a new PDF file to replace resume...'
                    : 'No file chosen (PDF only, max 5MB)'}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="resume-submit-btn"
            >
              {isUploading ? (
                <>
                  <span className="spinner-inline"></span>
                  Uploading...
                </>
              ) : resumeUrl ? (
                'Replace Resume'
              ) : (
                'Upload Resume'
              )}
            </button>
          </form>
        </div>
      </section>

      {/* SECTION A: My Applications */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>
            📋 My Applications
            <span className="count-badge">{applications.length}</span>
          </h2>
        </div>

        {applications.length === 0 ? (
          <div className="empty-state">
            <p>You haven't applied anywhere yet.</p>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              Check out the available companies below and submit your application!
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Package</th>
                  <th>Current Stage</th>
                  <th>Hiring Progress</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app._id}>
                    <td>
                      <strong>{app.company?.name || 'Company Profile'}</strong>
                    </td>
                    <td>
                      <span className="package-badge">
                        {app.company?.packageOffered} LPA
                      </span>
                    </td>
                    <td>
                      <span className={`stage-badge badge-${app.currentStage}`}>
                        {app.currentStage}
                      </span>
                    </td>
                    <td>{renderProgressStepper(app.currentStage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION B: Available Companies */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>
            🏢 Available Companies
            <span className="count-badge">{companies.length}</span>
          </h2>
        </div>

        {companies.length === 0 ? (
          <div className="empty-state">
            <p>No placement drives are active at the moment.</p>
          </div>
        ) : (
          <div className="companies-grid">
            {companies.map((company) => {
              const alreadyApplied = hasApplied(company._id);
              const isApplying = applyingCompanyId === company._id;

              return (
                <div key={company._id} className="company-card">
                  <div>
                    <div className="company-card-header">
                      <h3 className="company-name">{company.name}</h3>
                      <span className="package-badge">
                        {company.packageOffered} LPA
                      </span>
                    </div>

                    {/* Roles Offered */}
                    {company.rolesOffered?.length > 0 && (
                      <div className="roles-container">
                        {company.rolesOffered.map((role, idx) => (
                          <span key={idx} className="role-tag">
                            {role}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Eligibility Criteria */}
                    <div className="criteria-box">
                      <div>
                        <strong>Min CGPA:</strong>{' '}
                        {company.eligibilityCriteria?.minCGPA || '0.0'}
                      </div>
                      <div>
                        <strong>Max Backlogs Allowed:</strong>{' '}
                        {company.eligibilityCriteria?.maxBacklogs ?? '0'}
                      </div>
                    </div>
                  </div>

                  {/* Apply Action Button */}
                  <div>
                    {alreadyApplied ? (
                      <div className="applied-btn">
                        <span>✓</span> Already Applied
                      </div>
                    ) : (
                      <button
                        className="apply-btn"
                        onClick={() => handleApply(company._id)}
                        disabled={isApplying}
                      >
                        {isApplying ? 'Submitting...' : 'Apply Now'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default StudentDashboard;
