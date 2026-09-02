import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isRecruiterSetup = location.pathname === '/recruiter-setup';

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <Link to="/" style={styles.brandLink}>
          🎓 Placement Analytics
        </Link>
      </div>

      <div style={styles.links}>
        {isRecruiterSetup ? (
          <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>
            🏢 Recruiter Onboarding Mode
          </span>
        ) : isAuthenticated ? (
          <div style={styles.userSection}>
            <span style={styles.userInfo}>
              <strong>{user?.name || user?.email}</strong> ({role === 'recruiter' || role === 'company_hr' ? 'RECRUITER' : role?.toUpperCase()})
            </span>

            {role === 'tpo' ? (
              <Link to="/tpo-dashboard" style={styles.navLink}>
                TPO Analytics
              </Link>
            ) : role === 'recruiter' || role === 'company_hr' ? (
              <Link to="/recruiter-dashboard" style={styles.navLink}>
                Recruiter Portal
              </Link>
            ) : (
              <Link to="/student-dashboard" style={styles.navLink}>
                My Dashboard
              </Link>
            )}

            <button onClick={handleLogout} style={styles.logoutBtn}>
              Logout
            </button>
          </div>
        ) : (
          <div style={styles.authLinks}>
            <Link to="/login" style={styles.navLink}>
              Login
            </Link>
            <Link to="/register" style={styles.registerLink}>
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#1e293b',
    color: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  brand: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
  },
  brandLink: {
    color: '#ffffff',
    textDecoration: 'none',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  userInfo: {
    fontSize: '0.9rem',
    color: '#94a3b8',
  },
  authLinks: {
    display: 'flex',
    gap: '1rem',
  },
  navLink: {
    color: '#cbd5e1',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '0.95rem',
  },
  registerLink: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '0.45rem 0.9rem',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '0.95rem',
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    padding: '0.45rem 0.9rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
};

export default Navbar;
