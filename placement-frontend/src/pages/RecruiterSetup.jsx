import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const RecruiterSetup = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  // Verification state
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState('');
  const [inviteData, setInviteData] = useState({
    email: '',
    companyName: '',
  });

  // Form state (credentials + company hiring details)
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
    packageOffered: '',
    minCGPA: '',
    maxBacklogs: '0',
    rolesOffered: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Verify invitation token on mount
  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setVerificationError('No invitation token was provided. Please use the complete link from your invitation email.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await API.get(`/auth/verify-invite?token=${encodeURIComponent(token)}`);
        if (res.data.success) {
          setInviteData({
            email: res.data.email,
            companyName: res.data.companyName,
          });

          // Pre-populate any existing company details if pre-configured by TPO
          if (res.data.companyDetails) {
            setFormData((prev) => ({
              ...prev,
              packageOffered: res.data.companyDetails.packageOffered !== '' ? String(res.data.companyDetails.packageOffered) : prev.packageOffered,
              minCGPA: res.data.companyDetails.minCGPA !== '' ? String(res.data.companyDetails.minCGPA) : prev.minCGPA,
              maxBacklogs: res.data.companyDetails.maxBacklogs !== '' ? String(res.data.companyDetails.maxBacklogs) : prev.maxBacklogs,
              rolesOffered: res.data.companyDetails.rolesOffered || prev.rolesOffered,
            }));
          }
        }
      } catch (err) {
        console.error('Invite verification failed:', err);
        setVerificationError(
          err.response?.data?.message || 'This invitation link is invalid or has expired (valid for 48 hours). Please request a new invite from the TPO.'
        );
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (formData.packageOffered === '' || parseFloat(formData.packageOffered) < 0) {
      setErrorMessage('Please provide a valid package offered (LPA).');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await API.post('/auth/register-hr', {
        token,
        name: formData.name.trim(),
        password: formData.password,
        packageOffered: formData.packageOffered,
        minCGPA: formData.minCGPA,
        maxBacklogs: formData.maxBacklogs,
        rolesOffered: formData.rolesOffered,
      });

      if (res.data.success && res.data.token) {
        // Authenticate immediately into session
        login(res.data.token, res.data.student);
        // Redirect directly to the Recruiter portal
        navigate('/recruiter-dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Error during recruiter onboarding:', err);
      setErrorMessage(
        err.response?.data?.message || 'Failed to complete registration. Please try again or contact the placement cell.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <h2>Verifying Invitation...</h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
            Validating your official campus recruitment onboarding token.
          </p>
        </div>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-header">
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <h2 style={{ color: '#dc2626', marginTop: '0.75rem' }}>Invalid or Expired Invitation</h2>
            <p style={{ color: '#475569', marginTop: '0.5rem' }}>{verificationError}</p>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <Link to="/login" className="auth-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '580px' }}>
        <div className="auth-header">
          <span style={{ fontSize: '2rem' }}>🏢</span>
          <h2>Recruiter Setup Portal</h2>
          <p>
            Welcome to the Campus Recruitment System for <strong>{inviteData.companyName}</strong>
          </p>
        </div>

        {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Read-only Company Name */}
          <div className="form-group">
            <label htmlFor="companyName">Company Name (Read-Only)</label>
            <input
              type="text"
              id="companyName"
              value={inviteData.companyName}
              readOnly
              disabled
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#1e293b', fontWeight: '600' }}
            />
          </div>

          {/* Read-only Email Address */}
          <div className="form-group">
            <label htmlFor="email">Official Email (Read-Only)</label>
            <input
              type="email"
              id="email"
              value={inviteData.email}
              readOnly
              disabled
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#1e293b' }}
            />
          </div>

          {/* HR Name */}
          <div className="form-group">
            <label htmlFor="name">Your Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="e.g. John Doe (Lead Campus Recruiter)"
              value={formData.name}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Create Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          {/* Section Divider: Hiring & Eligibility Criteria */}
          <div style={{ margin: '1.75rem 0 1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#0f172a', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>💼</span> Company Hiring & Eligibility Criteria
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
              Configure your recruitment drive criteria. These details will be displayed to eligible students in the placement portal.
            </p>
          </div>

          {/* Package Offered */}
          <div className="form-group">
            <label htmlFor="packageOffered">Package Offered (LPA) *</label>
            <input
              type="number"
              id="packageOffered"
              name="packageOffered"
              placeholder="e.g. 14.5"
              step="0.1"
              min="0"
              value={formData.packageOffered}
              onChange={handleChange}
              required
            />
          </div>

          {/* Roles Offered */}
          <div className="form-group">
            <label htmlFor="rolesOffered">Roles Offered (Comma-separated)</label>
            <input
              type="text"
              id="rolesOffered"
              name="rolesOffered"
              placeholder="e.g. Software Engineer, Backend Developer, QA Engineer"
              value={formData.rolesOffered}
              onChange={handleChange}
            />
          </div>

          {/* Eligibility Row: Min CGPA & Max Backlogs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="minCGPA">Minimum CGPA Required</label>
              <input
                type="number"
                id="minCGPA"
                name="minCGPA"
                placeholder="e.g. 7.5"
                step="0.1"
                min="0"
                max="10"
                value={formData.minCGPA}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="maxBacklogs">Max Backlogs Allowed</label>
              <input
                type="number"
                id="maxBacklogs"
                name="maxBacklogs"
                placeholder="e.g. 0"
                min="0"
                value={formData.maxBacklogs}
                onChange={handleChange}
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={isSubmitting} style={{ marginTop: '0.75rem' }}>
            {isSubmitting ? 'Configuring Drive & Finalizing Setup...' : '🚀 Complete Registration & Launch Drive →'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RecruiterSetup;
