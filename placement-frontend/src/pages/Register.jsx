import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import './Auth.css';

const Register = () => {
  // Active role toggle ('student' | 'tpo')
  const [role, setRole] = useState('student');

  // State for registration form inputs
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    rollNumber: '',
    branch: '',
    cgpa: '',
    backlogs: '0',
  });

  // UI state
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Handle input changes
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (errorMessage) setErrorMessage('');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      // 1. Prepare payload based on selected role
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role,
      };

      // Only attach student-specific fields when registering as a student
      if (role === 'student') {
        payload.rollNumber = formData.rollNumber.trim().toUpperCase();
        payload.branch = formData.branch;
        payload.cgpa = parseFloat(formData.cgpa);
        payload.backlogs = parseInt(formData.backlogs, 10) || 0;
      }

      // 2. Call backend registration API
      const response = await API.post('/auth/register', payload);

      if (response.data.success) {
        // 3. Redirect to login with flash success message
        navigate('/login', {
          state: {
            message: `🎉 ${role === 'tpo' ? 'TPO Officer' : 'Student'} registration successful! Please log in with your credentials.`,
          },
        });
      }
    } catch (error) {
      // 4. Capture backend validation or duplicate key errors
      const message =
        error.response?.data?.message ||
        'Registration failed. Please verify your details and try again.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className={`auth-card ${role === 'student' ? 'auth-card-wide' : ''}`}>
        <div className="auth-header">
          <h2>{role === 'tpo' ? 'TPO Officer Registration' : 'Student Registration'}</h2>
          <p>
            {role === 'tpo'
              ? 'Create an administrative profile to manage placement drives and view analytics'
              : 'Create your student profile to apply for placement drives'}
          </p>
        </div>

        {/* Role Selection Toggle */}
        <div className="role-toggle-group">
          <button
            type="button"
            className={`role-toggle-btn ${role === 'student' ? 'active' : ''}`}
            onClick={() => {
              setRole('student');
              setErrorMessage('');
            }}
          >
            👨‍🎓 Student
          </button>
          <button
            type="button"
            className={`role-toggle-btn ${role === 'tpo' ? 'active' : ''}`}
            onClick={() => {
              setRole('tpo');
              setErrorMessage('');
            }}
          >
            💼 TPO Officer
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder={role === 'tpo' ? 'e.g. Dr. A. Sharma' : 'e.g. Rahul Sharma'}
              value={formData.name}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">College Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder={role === 'tpo' ? 'tpo@college.edu' : 'rahul.sharma@college.edu'}
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password (min 6 chars) *</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
                minLength="6"
                required
              />
            </div>
          </div>

          {/* Student-only Fields */}
          {role === 'student' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="rollNumber">Roll Number *</label>
                  <input
                    type="text"
                    id="rollNumber"
                    name="rollNumber"
                    placeholder="e.g. 20CS101"
                    value={formData.rollNumber}
                    onChange={handleChange}
                    required={role === 'student'}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="branch">Branch / Department *</label>
                  <select
                    id="branch"
                    name="branch"
                    value={formData.branch}
                    onChange={handleChange}
                    required={role === 'student'}
                  >
                    <option value="">-- Select Branch --</option>
                    <option value="Computer Science">Computer Science & Engineering (CSE)</option>
                    <option value="Information Technology">Information Technology (IT)</option>
                    <option value="Electronics & Communication">Electronics & Communication (ECE)</option>
                    <option value="Mechanical Engineering">Mechanical Engineering (ME)</option>
                    <option value="Civil Engineering">Civil Engineering (CE)</option>
                    <option value="Electrical Engineering">Electrical Engineering (EE)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cgpa">Current CGPA (0 - 10) *</label>
                  <input
                    type="number"
                    id="cgpa"
                    name="cgpa"
                    placeholder="e.g. 8.45"
                    step="0.01"
                    min="0"
                    max="10"
                    value={formData.cgpa}
                    onChange={handleChange}
                    required={role === 'student'}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="backlogs">Active Backlogs</label>
                  <input
                    type="number"
                    id="backlogs"
                    name="backlogs"
                    placeholder="0"
                    min="0"
                    value={formData.backlogs}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </>
          )}

          <button type="submit" className="auth-btn" disabled={isLoading}>
            {isLoading ? 'Registering...' : `Create ${role === 'tpo' ? 'TPO' : 'Student'} Account`}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;

