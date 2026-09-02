import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Wrapper Component
 * - Checks if user is authenticated (redirects to /login if not)
 * - Checks if user has required role (redirects to appropriate dashboard if unauthorized)
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  // Show temporary loader while checking localStorage auth session
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Not logged in -> Redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization if specific roles are required
  if (allowedRoles) {
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!rolesArray.includes(role)) {
      // Redirect unauthorized roles to their respective home dashboard
      const redirectPath =
        role === 'tpo'
          ? '/tpo-dashboard'
          : role === 'recruiter' || role === 'company_hr'
          ? '/recruiter-dashboard'
          : '/student-dashboard';
      return <Navigate to={redirectPath} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
