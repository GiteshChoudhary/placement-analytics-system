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
    padding: '0.85rem 2rem',
    backgroundColor: 'var(--color-primary, #0f172a)',
    color: '#ffffff',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  brand: {
    fontSize: '1.15rem',
    fontWeight: '700',
    letterSpacing: '-0.01em',
  },
  brandLink: {
    color: '#ffffff',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  userInfo: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  authLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  navLink: {
    color: '#cbd5e1',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '0.875rem',
    transition: 'color 0.15s ease',
  },
  registerLink: {
    backgroundColor: 'var(--color-primary-action, #1d4ed8)',
    color: '#ffffff',
    padding: '0.45rem 0.95rem',
    borderRadius: 'var(--radius, 8px)',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '0.875rem',
    transition: 'background-color 0.15s ease',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    padding: '0.4rem 0.85rem',
    borderRadius: 'var(--radius, 8px)',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '0.85rem',
    transition: 'all 0.15s ease',
  },
};

export default Navbar;
