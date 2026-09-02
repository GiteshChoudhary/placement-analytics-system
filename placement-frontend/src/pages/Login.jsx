import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  // Visual role tab ('student' | 'tpo')
  const [activeTabRole, setActiveTabRole] = useState('student');

  // State for form inputs
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // UI status states
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Optional success message passed via navigation (e.g., after registering)
  const successMessage = location.state?.message;

  // Handle input changes
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error message when user starts typing again
    if (errorMessage) setErrorMessage('');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      // 1. Call Backend Login API
      const response = await API.post('/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      const { token, student } = response.data;

      // Validate that account role matches the active tab
      const isStudentTab = activeTabRole === 'student';
      const isTpoTab = activeTabRole === 'tpo';
      const isRecruiterTab = activeTabRole === 'recruiter';

      const isAccountStudent = student.role === 'student';
      const isAccountTpo = student.role === 'tpo';
      const isAccountRecruiter = student.role === 'recruiter' || student.role === 'company_hr';

      if (isStudentTab && !isAccountStudent) {
        const correctTab = isAccountTpo ? 'TPO Officer' : 'Recruiter';
        setErrorMessage(`This account is registered as a ${isAccountTpo ? 'TPO Officer' : 'Recruiter'}. Please select the "${correctTab}" tab to sign in.`);
        setIsLoading(false);
        return;
      }

      if (isTpoTab && !isAccountTpo) {
        const correctTab = isAccountStudent ? 'Student' : 'Recruiter';
        setErrorMessage(`This account is registered as a ${isAccountStudent ? 'Student' : 'Recruiter'}. Please select the "${correctTab}" tab to sign in.`);
        setIsLoading(false);
        return;
      }

      if (isRecruiterTab && !isAccountRecruiter) {
        const correctTab = isAccountTpo ? 'TPO Officer' : 'Student';
        setErrorMessage(`This account is registered as a ${isAccountTpo ? 'TPO Officer' : 'Student'}. Please select the "${correctTab}" tab to sign in.`);
        setIsLoading(false);
        return;
      }

      // 2. Save token and user details to AuthContext (and localStorage)
      login(token, student);

      // 3. Role-based redirect
      if (student.role === 'tpo') {
        navigate('/tpo-dashboard', { replace: true });
      } else if (student.role === 'recruiter' || student.role === 'company_hr') {
        navigate('/recruiter-dashboard', { replace: true });
      } else {
        navigate('/student-dashboard', { replace: true });
      }
    } catch (error) {
      // 4. Capture backend error response
      const message =
        error.response?.data?.message ||
        'Unable to connect to the server. Please check your backend.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Sign in to access your placement portal</p>
        </div>

        {/* Role Toggle Switcher */}
        <div className="role-toggle-group">
          <button
            type="button"
            className={`role-toggle-btn ${activeTabRole === 'student' ? 'active' : ''}`}
            onClick={() => { setActiveTabRole('student'); setErrorMessage(''); }}
          >
            👨‍🎓 Student
          </button>
          <button
            type="button"
            className={`role-toggle-btn ${activeTabRole === 'tpo' ? 'active' : ''}`}
            onClick={() => { setActiveTabRole('tpo'); setErrorMessage(''); }}
          >
            💼 TPO Officer
          </button>
          <button
            type="button"
            className={`role-toggle-btn ${activeTabRole === 'recruiter' ? 'active' : ''}`}
            onClick={() => { setActiveTabRole('recruiter'); setErrorMessage(''); }}
          >
            🏢 Recruiter
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && <div className="alert alert-success">{successMessage}</div>}

        {/* Error Alert */}
        {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder={
                activeTabRole === 'tpo'
                  ? 'e.g. tpo@college.edu'
                  : activeTabRole === 'recruiter'
                  ? 'e.g. recruiter@company.com'
                  : 'e.g. rahul.sharma@college.edu'
              }
              value={formData.email}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="auth-btn" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          {activeTabRole === 'recruiter' ? (
            <span style={{ color: '#64748b', fontSize: '0.88rem' }}>
              🔒 Recruiter accounts are by invitation only. Contact the college TPO for an onboarding link.
            </span>
          ) : (
            <>
              Don't have an account?{' '}
              <Link to="/register">Register here</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
