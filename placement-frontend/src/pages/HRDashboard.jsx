import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './HRDashboard.css';
import './StudentDashboard.css';

const STAGES = ['eligibility', 'aptitude', 'technical', 'offer', 'rejected'];

const HRDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active tab state ('profile' | 'applicants')
  const [activeTab, setActiveTab] = useState('profile');

  // Company Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: user?.companyName || '',
    packageOffered: '',
    minCGPA: '',
    maxBacklogs: '0',
    rolesOffered: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // Applicants State
  const [applicants, setApplicants] = useState([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingAppId, setUpdatingAppId] = useState(null);
  const [viewingResumeStudentId, setViewingResumeStudentId] = useState(null);

  // Notifications
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch HR's company profile and applicants on mount
  useEffect(() => {
    fetchCompanyData();
    fetchApplicants();
  }, []);

  // 1. Fetch HR's configured company profile
  const fetchCompanyData = async () => {
    try {
      const res = await API.get('/companies/my');
      if (res.data.success && res.data.company) {
        const comp = res.data.company;
        setProfileForm({
          name: comp.name || user?.companyName || '',
          packageOffered: comp.packageOffered !== undefined ? comp.packageOffered.toString() : '',
          minCGPA: comp.eligibilityCriteria?.minCGPA !== undefined ? comp.eligibilityCriteria.minCGPA.toString() : '',
          maxBacklogs: comp.eligibilityCriteria?.maxBacklogs !== undefined ? comp.eligibilityCriteria.maxBacklogs.toString() : '0',
          rolesOffered: Array.isArray(comp.rolesOffered) ? comp.rolesOffered.join(', ') : '',
        });
      } else if (res.data.companyName) {
        setProfileForm((prev) => ({ ...prev, name: res.data.companyName }));
      }
    } catch (err) {
      console.error('Error loading recruiter company profile:', err);
    }
  };

  // 2. Fetch candidates who applied to this company
  const fetchApplicants = async () => {
    setIsLoadingApplicants(true);
    try {
      const res = await API.get('/applications');
      if (res.data.success) {
        setApplicants(res.data.applications || []);
      }
    } catch (err) {
      console.error('Error loading applicants:', err);
    } finally {
      setIsLoadingApplicants(false);
    }
  };

  // Handle profile form input changes
  const handleProfileChange = (e) => {
    setProfileForm({
      ...profileForm,
      [e.target.name]: e.target.value,
    });
    if (profileErrorMsg) setProfileErrorMsg('');
    if (profileSuccessMsg) setProfileSuccessMsg('');
  };

  // Submit Company Profile changes
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSuccessMsg('');
    setProfileErrorMsg('');
    setIsSavingProfile(true);

    try {
      const roles = profileForm.rolesOffered
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      const payload = {
        name: profileForm.name.trim(),
        packageOffered: parseFloat(profileForm.packageOffered),
        minCGPA: profileForm.minCGPA ? parseFloat(profileForm.minCGPA) : 0,
        maxBacklogs: profileForm.maxBacklogs ? parseInt(profileForm.maxBacklogs, 10) : 0,
        rolesOffered: roles,
      };

      const res = await API.post('/companies', payload);
      if (res.data.success) {
        setProfileSuccessMsg('🎉 Company profile and eligibility criteria updated successfully!');
        setToastMessage('Company drive parameters saved!');
        setTimeout(() => setToastMessage(null), 4000);
        await fetchCompanyData();
      }
    } catch (err) {
      console.error('Error saving company profile:', err);
      setProfileErrorMsg(
        err.response?.data?.message || 'Failed to save company profile. Please check input values.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Recruiter handler to view student resume via presigned URL
  const handleViewStudentResume = async (studentId) => {
    if (!studentId) return;
    setViewingResumeStudentId(studentId);
    try {
      const response = await API.get(`/students/${studentId}/resume-url`);
      if (response.data.success && response.data.presignedUrl) {
        window.open(response.data.presignedUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Could not retrieve presigned URL');
      }
    } catch (err) {
      console.error('Error opening student resume:', err);
      alert(err.response?.data?.message || 'No resume uploaded for this student or access denied.');
    } finally {
      setViewingResumeStudentId(null);
    }
  };

  // Recruiter stage change handler
  const handleStageChange = async (applicationId, newStage) => {
    setUpdatingAppId(applicationId);
    try {
      const res = await API.put(`/applications/${applicationId}/stage`, { newStage });
      if (res.data.success) {
        setApplicants((prev) =>
          prev.map((app) =>
            app._id === applicationId ? { ...app, currentStage: newStage } : app
          )
        );
        setToastMessage(`Updated candidate status to "${newStage.toUpperCase()}"!`);
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.error('Error updating candidate stage:', err);
      alert(err.response?.data?.message || 'Failed to update candidate stage.');
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Search filter for applicants
  const filteredApplicants = applicants.filter((app) => {
    const q = searchTerm.toLowerCase();
    const sName = app.student?.name?.toLowerCase() || '';
    const sRoll = app.student?.rollNumber?.toLowerCase() || '';
    const sBranch = app.student?.branch?.toLowerCase() || '';
    const sStage = app.currentStage?.toLowerCase() || '';
    return sName.includes(q) || sRoll.includes(q) || sBranch.includes(q) || sStage.includes(q);
  });

  return (
    <div className="hr-container">
      {/* Top Header Banner */}
      <div className="hr-header">
        <div>
          <h1>
            🏢 Recruiter Placement Portal
            <span className="company-badge">{user?.companyName || 'Partner Recruiter'}</span>
            <span className="hr-badge">HR ACCESS</span>
          </h1>
          <p>
            Welcome, <strong>{user?.name || 'Recruiter'}</strong> | Manage your campus recruitment drive and interview pipeline
          </p>
        </div>
        <button onClick={handleLogout} className="hr-logout-btn">
          Logout
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && <div className="toast-banner">{toastMessage}</div>}

      {/* Tab Navigation */}
      <div className="hr-tabs">
        <button
          className={`hr-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          ⚙️ Company Drive Profile
        </button>
        <button
          className={`hr-tab-btn ${activeTab === 'applicants' ? 'active' : ''}`}
          onClick={() => setActiveTab('applicants')}
        >
          👥 Student Applicants ({applicants.length})
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: Company Profile Configuration */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'profile' && (
        <div className="hr-card">
          <div className="hr-card-header">
            <h2>🏢 Configure Campus Recruitment Drive</h2>
            <p>
              Set eligibility criteria and compensation details. Eligible students will immediately be able to view and apply for your drive.
            </p>
          </div>

          {profileSuccessMsg && <div className="alert alert-success">{profileSuccessMsg}</div>}
          {profileErrorMsg && <div className="alert alert-error">{profileErrorMsg}</div>}

          <form onSubmit={handleProfileSubmit} className="hr-form">
            <div className="form-group">
              <label htmlFor="comp-name">Company Name *</label>
              <input
                type="text"
                id="comp-name"
                name="name"
                value={profileForm.name}
                onChange={handleProfileChange}
                required
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="packageOffered">Package Offered (LPA) *</label>
                <input
                  type="number"
                  id="packageOffered"
                  name="packageOffered"
                  placeholder="e.g. 24.5"
                  step="0.1"
                  min="0"
                  value={profileForm.packageOffered}
                  onChange={handleProfileChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="minCGPA">Minimum Required CGPA (0 - 10)</label>
                <input
                  type="number"
                  id="minCGPA"
                  name="minCGPA"
                  placeholder="e.g. 7.5 (leave 0 for none)"
                  step="0.01"
                  min="0"
                  max="10"
                  value={profileForm.minCGPA}
                  onChange={handleProfileChange}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="maxBacklogs">Maximum Allowed Backlogs</label>
                <input
                  type="number"
                  id="maxBacklogs"
                  name="maxBacklogs"
                  placeholder="e.g. 0"
                  min="0"
                  value={profileForm.maxBacklogs}
                  onChange={handleProfileChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rolesOffered">Roles Offered (comma-separated)</label>
                <input
                  type="text"
                  id="rolesOffered"
                  name="rolesOffered"
                  placeholder="e.g. Software Engineer, Systems Engineer, SRE"
                  value={profileForm.rolesOffered}
                  onChange={handleProfileChange}
                />
              </div>
            </div>

            <button type="submit" className="hr-save-btn" disabled={isSavingProfile}>
              {isSavingProfile ? 'Saving Profile...' : '💾 Save Company Drive Profile'}
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: Applicants Management */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'applicants' && (
        <div className="hr-card">
          <div className="applicants-toolbar">
            <h2>All Applicants for {user?.companyName || 'Your Company'}</h2>
            <input
              type="text"
              className="applicant-search"
              placeholder="Search by name, roll no, branch, stage..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isLoadingApplicants ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Loading candidate applications...
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div className="empty-state">
              <p>No student applications found for this drive.</p>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                When eligible students apply from their dashboard, they will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="applications-table">
                <thead>
                  <tr>
                    <th>Candidate Name</th>
                    <th>Roll No</th>
                    <th>Branch / CGPA</th>
                    <th>Resume</th>
                    <th>Current Round</th>
                    <th>Update Round (Recruiter Action)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.map((app) => (
                    <tr key={app._id}>
                      <td>
                        <strong>{app.student?.name || 'N/A'}</strong>
                      </td>
                      <td>{app.student?.rollNumber || 'N/A'}</td>
                      <td>
                        {app.student?.branch || 'N/A'} (CGPA: {app.student?.cgpa ?? 'N/A'})
                      </td>
                      <td>
                        {app.student?.resumeUrl ? (
                          <button
                            type="button"
                            onClick={() => handleViewStudentResume(app.student._id)}
                            disabled={viewingResumeStudentId === app.student._id}
                            className="btn-view-resume"
                          >
                            {viewingResumeStudentId === app.student._id ? 'Opening...' : '📄 View Resume'}
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No Resume</span>
                        )}
                      </td>
                      <td>
                        <span className={`stage-badge badge-${app.currentStage}`}>
                          {app.currentStage}
                        </span>
                      </td>
                      <td>
                        <select
                          className="stage-select"
                          value={app.currentStage}
                          onChange={(e) => handleStageChange(app._id, e.target.value)}
                          disabled={updatingAppId === app._id}
                        >
                          {STAGES.map((st) => (
                            <option key={st} value={st}>
                              {st.charAt(0).toUpperCase() + st.slice(1)}
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
    </div>
  );
};

export default HRDashboard;
